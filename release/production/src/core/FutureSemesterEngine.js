(function (global) {
  'use strict';

  const NumberParser = (typeof require !== 'undefined')
    ? require('../parsers/NumberParser.js')
    : (global.IUHGPA && global.IUHGPA.parsers && global.IUHGPA.parsers.NumberParser
        ? global.IUHGPA.parsers.NumberParser
        : (global._IUHNumberParser || {
            formatAverage4: (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(4).replace('.', ',') : ''),
            formatScore2: (v) => (typeof v === 'number' && !isNaN(v) ? v.toFixed(2).replace('.', ',') : '')
          }));

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('./GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core.GradingRuleEngine : null);

    const GPAEngine = (typeof require !== 'undefined')
    ? require('./GPAEngine.js').GPAEngine
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core.GPAEngine : null);

  const CourseIdentityMatcher = (typeof require !== 'undefined')
    ? require('./CourseIdentityMatcher.js').CourseIdentityMatcher
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core.CourseIdentityMatcher : null);

  const MAX_FUTURE_SEMESTERS = 9;

  const PLANNING_TYPES = {
    NORMAL: 'NORMAL',
    RETAKE_SIMULATION: 'RETAKE_SIMULATION'
  };

  const ELECTIVE_GROUP_STATUS = {
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    SATISFIED: 'SATISFIED',
    OVER_PLANNED: 'OVER_PLANNED',
    UNKNOWN: 'UNKNOWN'
  };

  class FutureSemesterEngine {
    /**
     * Phân tích nhãn học kỳ thành cấu trúc chuẩn
     * Hỗ trợ các định dạng phổ biến:
     * - "HK1 (2024 - 2025)"
     * - "Học kỳ 2 - Năm học 2025 - 2026"
     * - "HK3 (2025-2026)"
     * @param {string} rawLabel
     * @returns {{ term: number, startYear: number, endYear: number, rawLabel: string } | null}
     */
    static parseSemesterLabel(rawLabel) {
      if (!rawLabel || typeof rawLabel !== 'string') return null;

      const cleaned = rawLabel.trim();
      const termMatch = cleaned.match(/(?:HK|Học kỳ|Hoc ky)\s*(\d)/i);
      const yearMatch = cleaned.match(/(\d{4})\s*[-–—]\s*(\d{4})/);

      if (!termMatch || !yearMatch) {
        return null;
      }

      const term = parseInt(termMatch[1], 10);
      const startYear = parseInt(yearMatch[1], 10);
      const endYear = parseInt(yearMatch[2], 10);

      if (term < 1 || term > 3 || startYear >= endYear) {
        return null;
      }

      return {
        term,
        startYear,
        endYear,
        rawLabel: cleaned
      };
    }

    /**
     * Xác định học kỳ thực tế cuối cùng từ danh sách học kỳ bảng điểm
     * @param {Array<Object>} semesters
     * @returns {{ term: number, startYear: number, endYear: number, rawLabel: string, isActual: true, isFuture: false } | null}
     */
    static parseLatestActualSemester(semesters) {
      if (!Array.isArray(semesters) || semesters.length === 0) {
        return null;
      }

      // Lấy các học kỳ hợp lệ (bỏ qua future semesters nếu có trong danh sách)
      const actualSemesters = semesters.filter(s => !s.isFuture);
      if (actualSemesters.length === 0) return null;

      // Duyệt từ cuối lên để tìm học kỳ có nhãn hợp lệ
      for (let i = actualSemesters.length - 1; i >= 0; i--) {
        const sem = actualSemesters[i];
        const label = sem.semesterName || sem.label || sem.rawLabel || '';
        const parsed = this.parseSemesterLabel(label);
        if (parsed) {
          return {
            ...parsed,
            isActual: true,
            isFuture: false
          };
        }
      }

      return null;
    }

    /**
     * Tạo nhãn học kỳ tiếp theo dựa trên quy tắc chu kỳ IUH:
     * HK1 -> HK2 (cùng năm học)
     * HK2 -> HK3 (cùng năm học - học kỳ hè mô phỏng)
     * HK3 -> HK1 (năm học kế tiếp, vd: 2025-2026 -> 2026-2027)
     * @param {{ term: number, startYear: number, endYear: number }} currentSem
     * @param {boolean} [skipHK3=false] - Cho phép bỏ qua HK3 nếu muốn nhảy thẳng HK1 năm sau
     * @returns {{ term: number, startYear: number, endYear: number, label: string, isSimulatedHK3: boolean }}
     */
    static getNextSemester(currentSem, skipHK3 = false) {
      if (!currentSem || typeof currentSem.term !== 'number') {
        throw new Error('Học kỳ đầu vào không hợp lệ để tính học kỳ tiếp theo');
      }

      let nextTerm = currentSem.term + 1;
      let nextStartYear = currentSem.startYear;
      let nextEndYear = currentSem.endYear;

      if (skipHK3 && nextTerm === 3) {
        nextTerm = 1;
        nextStartYear += 1;
        nextEndYear += 1;
      } else if (nextTerm > 3) {
        nextTerm = 1;
        nextStartYear += 1;
        nextEndYear += 1;
      }

      const label = `HK${nextTerm} (${nextStartYear} - ${nextEndYear})`;
      return {
        term: nextTerm,
        startYear: nextStartYear,
        endYear: nextEndYear,
        label,
        termName: label,
        displayLabel: nextTerm === 3 ? `${label} (Mô phỏng)` : label,
        isSimulatedHK3: nextTerm === 3
      };
    }

    /**
     * Sinh danh sách các học kỳ tương lai hợp lệ cho dropdown chọn
     * @param {Object} latestActual - Học kỳ thực tế mới nhất
     * @param {Object} futurePlan - Kế hoạch tương lai hiện tại
     * @param {number} [maxCount=9] - Số lượng tối đa tạo ra
     * @returns {Array<{ term: number, startYear: number, endYear: number, label: string, isSimulatedHK3: boolean, isAvailable: boolean }>}
     */
    static generateNextSemesterOptions(latestActual, futurePlan, maxCount = 9) {
      if (!latestActual) return [];

      const plannedLabels = new Set();
      if (Array.isArray(futurePlan)) {
        futurePlan.forEach(item => {
          if (typeof item === 'string') plannedLabels.add(item);
          else if (item && item.label) plannedLabels.add(item.label);
          else if (item && item.termName) plannedLabels.add(item.termName);
        });
      } else if (futurePlan && Array.isArray(futurePlan.semesters)) {
        futurePlan.semesters.forEach(s => {
          if (s.label) plannedLabels.add(s.label);
          if (s.termName) plannedLabels.add(s.termName);
        });
      }

      const options = [];
      let cursor = {
        term: latestActual.term,
        startYear: latestActual.startYear,
        endYear: latestActual.endYear
      };

      // Nếu đã có các future semesters dạng object, cursor bắt đầu từ semester cuối cùng của futurePlan
      if (futurePlan && Array.isArray(futurePlan.semesters) && futurePlan.semesters.length > 0) {
        const lastFuture = futurePlan.semesters[futurePlan.semesters.length - 1];
        const parsedLast = this.parseSemesterLabel(lastFuture.label || lastFuture.termName);
        if (parsedLast) {
          cursor = parsedLast;
        }
      }

      // Tạo chuỗi các kỳ tiếp theo
      for (let i = 0; i < maxCount; i++) {
        const next = this.getNextSemester(cursor);
        cursor = next;

        if (!plannedLabels.has(next.label)) {
          options.push({
            ...next,
            isAvailable: true
          });
        }
      }

      return options;
    }

    /**
     * Khởi tạo đối tượng học kỳ tương lai rỗng
     * @param {number} term
     * @param {number} startYear
     * @param {number} endYear
     * @returns {{ id: string, term: number, startYear: number, endYear: number, label: string, isFuture: true, courses: Array<Object> }}
     */
    static createFutureSemester(term, startYear, endYear) {
      const label = `HK${term} (${startYear} - ${endYear})`;
      const id = `future_sem_${term}_${startYear}_${endYear}`;
      return {
        id,
        term,
        startYear,
        endYear,
        label,
        isFuture: true,
        isSimulatedHK3: term === 3,
        courses: []
      };
    }

    /**
     * Tính toán tổng quan tiến độ của các nhóm tự chọn (Elective Groups)
     * @param {Object} curriculumModel
     * @param {Array<Object>} gradeCourses - Danh sách môn từ bảng điểm thực tế
     * @param {Object} futurePlan - Kế hoạch tương lai
     * @returns {Map<string, Object>}
     */
    static calculateElectiveSummary(curriculumModel, gradeCourses, futurePlan) {
      // Hỗ trợ truyền trực tiếp một object group đơn lẻ (ví dụ trong test hoặc tính nhanh)
      if (curriculumModel && !Array.isArray(curriculumModel.electiveGroups) && typeof curriculumModel.requiredCredits === 'number') {
        const group = curriculumModel;
        const completedSet = new Set(Array.isArray(gradeCourses) ? gradeCourses.map(c => typeof c === 'string' ? c : (c.curriculumCourseCode || c.code)) : []);
        const plannedSet = new Set(Array.isArray(futurePlan) ? futurePlan.map(c => typeof c === 'string' ? c : (c.curriculumCourseCode || c.code)) : []);
        let completedCredits = 0;
        let plannedCredits = 0;
        (group.courses || []).forEach(c => {
          const code = c.curriculumCourseCode || c.code;
          if (completedSet.has(code)) {
            completedCredits += (c.credits || 0);
          } else if (plannedSet.has(code)) {
            plannedCredits += (c.credits || 0);
          }
        });
        const requiredCredits = group.requiredCredits || 0;
        const remainingRequiredCredits = Math.max(0, requiredCredits - completedCredits - plannedCredits);
        let status = 'NOT_STARTED';
        if (completedCredits >= requiredCredits) {
          status = 'SATISFIED';
        } else if (completedCredits + plannedCredits > requiredCredits) {
          status = 'OVER_PLANNED';
        } else if (completedCredits + plannedCredits === requiredCredits) {
          status = 'SATISFIED';
        } else if (completedCredits > 0 || plannedCredits > 0) {
          status = 'IN_PROGRESS';
        }
        return {
          groupName: group.groupName,
          requiredCredits,
          completedCredits,
          plannedCredits,
          remainingRequiredCredits,
          status,
          availableCourses: group.courses || []
        };
      }

      const summary = new Map();
      if (!curriculumModel || !Array.isArray(curriculumModel.electiveGroups)) {
        return summary;
      }

      // Tập hợp các môn đã đạt trên bảng điểm thực tế
      const completedCodeSet = new Set();
      if (Array.isArray(gradeCourses)) {
        gradeCourses.forEach(gc => {
          const isPassed = gc.isPassed === true || gc.passed === true ||
            (gc.officialResult && gc.officialResult.passed === true) ||
            (typeof gc.score10 === 'number' && gc.score10 >= 4.0) ||
            (typeof gc.score4 === 'number' && gc.score4 >= 1.0);
          if (isPassed) {
            const candidateCodes = [
              gc.courseCode,
              gc.code,
              gc.curriculumCourseCode,
              gc.courseClassCode,
              gc.curriculumCourse ? gc.curriculumCourse.code : null
            ].filter(Boolean);

            candidateCodes.forEach(rawCode => {
              const norm = CourseIdentityMatcher ? CourseIdentityMatcher.normalizeCode(rawCode) : String(rawCode).trim();
              if (norm) completedCodeSet.add(norm);
              if (norm && norm.length >= 10) completedCodeSet.add(norm.slice(0, 10));
            });
          }
        });
      }

      // Tập hợp các môn đã lên kế hoạch trong future plan
      const plannedCodeMap = new Map();
      if (futurePlan && Array.isArray(futurePlan.semesters)) {
        futurePlan.semesters.forEach(sem => {
          if (Array.isArray(sem.courses)) {
            sem.courses.forEach(fc => {
              const cCd = fc.curriculumCourseCode || fc.code;
              if (cCd) plannedCodeMap.set(cCd, fc);
            });
          }
        });
      }

      curriculumModel.electiveGroups.forEach(group => {
        const reqCr = (typeof group.requiredCredits === 'number' && Number.isFinite(group.requiredCredits)) ? group.requiredCredits : 0;
        let completedCr = 0;
        let plannedCr = 0;
        const groupCourses = (group.courses && group.courses.length > 0)
          ? group.courses
          : (curriculumModel.courses || []).filter(c => (c.electiveGroup === group.id || c.electiveGroupId === group.id));

        groupCourses.forEach(c => {
          const isPassInCTK = c.passState === 'PASS';
          const isPassInGrade = completedCodeSet.has(c.code);

          if (isPassInCTK || isPassInGrade) {
            completedCr += (c.credits || 0);
          } else if (plannedCodeMap.has(c.code)) {
            plannedCr += (c.credits || 0);
          }
        });

        const remainingRequiredCredits = Math.max(0, reqCr - completedCr - plannedCr);

        let status = ELECTIVE_GROUP_STATUS.NOT_STARTED;
        if (completedCr >= reqCr) {
          status = ELECTIVE_GROUP_STATUS.SATISFIED;
        } else if (completedCr + plannedCr >= reqCr) {
          status = (completedCr + plannedCr > reqCr)
            ? ELECTIVE_GROUP_STATUS.OVER_PLANNED
            : ELECTIVE_GROUP_STATUS.SATISFIED;
        } else if (completedCr > 0 || plannedCr > 0) {
          status = ELECTIVE_GROUP_STATUS.IN_PROGRESS;
        }

        summary.set(group.id, {
          groupId: group.id,
          label: group.label,
          requiredCredits: reqCr,
          completedCredits: completedCr,
          plannedCredits: plannedCr,
          remainingRequiredCredits,
          status,
          totalCourses: groupCourses.length
        });
      });

      return summary;
    }

    /**
     * Trích xuất danh mục các môn học khả dụng từ CTK để chọn vào học kỳ tương lai
     * Phân loại:
     * - mandatoryRemaining: Bắt buộc còn lại
     * - electiveRemaining: Tự chọn còn thiếu (chỉ từ nhóm chưa đủ tín chỉ)
     * - unregistered: Chưa đăng ký học
     * - failedRetake: Môn đã học nhưng chưa đạt (cho phép học lại)
     * - completed: Môn đã hoàn thành (ẩn mặc định)
     * @param {Object} curriculumModel
     * @param {Array<Object>} gradeCourses
     * @param {Object} futurePlan
     * @returns {Object} CoursePool
     */
    static getCoursePool(curriculumModel, gradeCourses, futurePlan) {
      if (!curriculumModel || !Array.isArray(curriculumModel.courses)) {
        return {
          mandatoryRemaining: [],
          electiveRemaining: [],
          unregistered: [],
          failedRetake: [],
          completed: [],
          allAvailable: []
        };
      }

      const electiveSummary = this.calculateElectiveSummary(curriculumModel, gradeCourses, futurePlan);

      // 1. Tập hợp các môn đã có trên bảng điểm thực tế (hỗ trợ cả mảng flat hoặc mảng semesters)
      const gradeMap = new Map();
      const flatGradeCourses = [];
      if (Array.isArray(gradeCourses)) {
        gradeCourses.forEach(item => {
          if (item && Array.isArray(item.courses)) {
            flatGradeCourses.push(...item.courses);
          } else if (item) {
            flatGradeCourses.push(item);
          }
        });
      }

      flatGradeCourses.forEach(gc => {
        const code10 = (gc.curriculumCourse && gc.curriculumCourse.code)
          ? gc.curriculumCourse.code
          : (gc.curriculumCourseCode || (gc.courseClassCode ? gc.courseClassCode.slice(0, 10) : ''));
        if (code10) gradeMap.set(code10, gc);
        if (gc.courseClassCode) gradeMap.set(gc.courseClassCode, gc);
      });

      // 2. Tập hợp các môn đã có trong futurePlan
      const plannedCodeSet = new Set();
      if (futurePlan && Array.isArray(futurePlan.semesters)) {
        futurePlan.semesters.forEach(s => {
          if (Array.isArray(s.courses)) {
            s.courses.forEach(fc => plannedCodeSet.add(fc.curriculumCourseCode || fc.code));
          }
        });
      }

      const mandatoryRemaining = [];
      const electiveRemaining = [];
      const unregistered = [];
      const failedRetake = [];
      const completed = [];

      curriculumModel.courses.forEach(course => {
        const cCode = course.curriculumCourseCode || course.code;
        const isPlanned = plannedCodeSet.has(cCode);

        // Kiểm tra trạng thái hoàn thành từ Grade Page hoặc CTK
        const matchedGrade = gradeMap.get(cCode);
        const isPassedOnGrade = matchedGrade && (matchedGrade.isPassed || (matchedGrade.officialResult && matchedGrade.officialResult.passed) || (typeof matchedGrade.score10 === 'number' && matchedGrade.score10 >= 4.0));
        const isPassedOnCTK = course.passState === 'PASS';
        const isCompleted = Boolean(isPassedOnGrade || isPassedOnCTK);

        // Kiểm tra môn rớt (chưa đạt)
        const isFailedOnGrade = matchedGrade && (matchedGrade.isPassed === false || (matchedGrade.officialResult && matchedGrade.officialResult.passed === false) || (typeof matchedGrade.score10 === 'number' && matchedGrade.score10 < 4.0));
        const isFailedOnCTK = course.passState === 'NOT_PASSED';
        const isFailed = Boolean((isFailedOnGrade || isFailedOnCTK) && !isCompleted);

        const isUnregistered = (course.studiedState === 'UNREGISTERED' || !matchedGrade) && !isCompleted && !isFailed;

        const poolItem = {
          ...course,
          code: cCode,
          curriculumCourseCode: cCode,
          isCompleted,
          isFailed,
          isPlanned,
          isUnregistered
        };

        if (isCompleted) {
          completed.push(poolItem);
          return;
        }

        if (isPlanned) {
          // Môn đã lên kế hoạch
          return;
        }

        if (isFailed) {
          failedRetake.push(poolItem);
        }

        if (course.isMandatory || course.requirementType === 'MANDATORY') {
          mandatoryRemaining.push(poolItem);
        } else if ((course.isElective || course.requirementType === 'ELECTIVE') && (course.electiveGroup || course.electiveGroupId)) {
          const gId = course.electiveGroup || course.electiveGroupId;
          const groupSum = electiveSummary.get ? electiveSummary.get(gId) : null;
          // Chỉ đưa vào electiveRemaining nếu nhóm tự chọn đó vẫn còn thiếu tín chỉ (Section 15)
          const isSatisfied = groupSum && (groupSum.isSatisfied || groupSum.remainingRequiredCredits === 0 || groupSum.remainingCredits === 0);
          if (!isSatisfied) {
            electiveRemaining.push(poolItem);
          }
        }

        if (isUnregistered) {
          unregistered.push(poolItem);
        }
      });

      // Danh sách khả dụng tổng hợp (không trùng lặp, ưu tiên: Bắt buộc > Chưa đạt > Tự chọn còn thiếu > Khác)
      const allAvailableMap = new Map();
      mandatoryRemaining.forEach(c => allAvailableMap.set(c.code, c));
      failedRetake.forEach(c => allAvailableMap.set(c.code, c));
      electiveRemaining.forEach(c => allAvailableMap.set(c.code, c));
      unregistered.forEach(c => allAvailableMap.set(c.code, c));

      return {
        mandatoryRemaining,
        electiveRemaining,
        unregistered,
        failedRetake,
        completed,
        allAvailable: Array.from(allAvailableMap.values()),
        electiveSummary
      };
    }

    /**
     * Tạo một đối tượng FutureCourse từ CurriculumCourse
     * @param {Object} curriculumCourse
     * @param {string} semesterId
     * @param {Object} [options]
     * @returns {Object} FutureCourse
     */
    static createFutureCourse(curriculumCourse, semesterId, options = {}) {
      const code = curriculumCourse?.curriculumCourseCode || curriculumCourse?.code;
      const name = curriculumCourse?.courseName || curriculumCourse?.name || '';
      if (!curriculumCourse || !code) {
        throw new Error('Dữ liệu môn học CTK không hợp lệ');
      }

      const isSpecialCourse = this.isSpecialCourseName(curriculumCourse);
      const inferredType = isSpecialCourse
        ? 'SPECIAL'
        : (curriculumCourse.inferredCourseType || 'UNKNOWN');
      const courseTypeOverride = options.courseTypeOverride
        || (isSpecialCourse ? 'SPECIAL' : null);
      const countsTowardGPA = curriculumCourse.countsTowardCumulativeGPA !== false;

      return {
        id: `fc_${code}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        curriculumCourseCode: code,
        code,
        semesterId,
        courseName: name,
        rawName: curriculumCourse.rawName || name,
        credits: curriculumCourse.credits || 0,
        theoryHours: curriculumCourse.theoryHours || 0,
        practiceHours: curriculumCourse.practiceHours || 0,
        curriculumSemester: curriculumCourse.curriculumSemester || null,
        requirementType: curriculumCourse.requirementType || 'MANDATORY',
        electiveGroup: curriculumCourse.electiveGroup || null,

        // Thuộc tính mô phỏng
        inferredCourseType: inferredType,
        courseTypeOverride,
        countsTowardCumulativeGPA: countsTowardGPA,
        included: countsTowardGPA, // Mặc định ON trừ khi môn non-GPA
        isSelectionOverridden: false,
        isTypeOverridden: Boolean(courseTypeOverride),
        planningType: options.planningType || PLANNING_TYPES.NORMAL,

        // Điểm số ban đầu: NULL (không tự điền 0)
        scores: {
          midterm: null,
          regular: [null, null, null, null, null, null, null, null, null],
          practice: [null, null, null, null, null],
          final: null
        },

        // Kết quả tính toán
        score10: null,
        score10Raw: null,
        score4: null,
        score4Raw: null,
        letter: null,
        classification: null,
        isPassed: null
      };
    }

    static isSpecialCourseName(course) {
      const name = String(course?.courseName || course?.name || course?.rawName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return /\b(thuc tap|khoa luan)\b/.test(name);
    }

    /**
     * Thêm môn học vào một học kỳ tương lai (chống trùng lặp tuyệt đối)
     * @param {Object} futurePlan
     * @param {string} semesterId
     * @param {Object} curriculumCourse
     * @param {Object} [options]
     * @returns {{ ok: boolean, error?: string, course?: Object, existingSemesterLabel?: string }}
     */
    static addCourseToSemester(futurePlan, semesterId, curriculumCourse, options = {}) {
      if (!futurePlan || !Array.isArray(futurePlan.semesters)) {
        return { ok: false, error: 'PLAN_INVALID' };
      }

      const targetSem = futurePlan.semesters.find(s => s.id === semesterId);
      if (!targetSem) {
        return { ok: false, error: 'SEMESTER_NOT_FOUND' };
      }

      const courseCodeToFind = curriculumCourse.curriculumCourseCode || curriculumCourse.code;
      // Kiểm tra trùng lặp trên toàn bộ kế hoạch tương lai
      for (const sem of futurePlan.semesters) {
        const found = sem.courses.find(c => c.curriculumCourseCode === courseCodeToFind || c.code === courseCodeToFind);
        if (found) {
          return {
            ok: false,
            error: 'DUPLICATE_COURSE',
            existingSemesterId: sem.id,
            existingSemesterLabel: sem.label
          };
        }
      }

      const newCourse = this.createFutureCourse(curriculumCourse, semesterId, options);
      targetSem.courses.push(newCourse);

      return { ok: true, course: newCourse };
    }

    /**
     * Di chuyển học phần giữa các học kỳ tương lai mà giữ nguyên điểm mô phỏng
     * @param {Object} futurePlan
     * @param {string} courseCode
     * @param {string} targetSemesterId
     * @returns {{ ok: boolean, error?: string }}
     */
    static moveCourse(futurePlan, courseCode, targetSemesterId) {
      if (!futurePlan || !Array.isArray(futurePlan.semesters)) {
        return { ok: false, error: 'PLAN_INVALID' };
      }

      const targetSem = futurePlan.semesters.find(s => s.id === targetSemesterId);
      if (!targetSem) {
        return { ok: false, error: 'TARGET_SEMESTER_NOT_FOUND' };
      }

      let courseToMove = null;

      // Tìm và xóa khỏi học kỳ hiện tại
      for (const sem of futurePlan.semesters) {
        const idx = sem.courses.findIndex(c => c.curriculumCourseCode === courseCode);
        if (idx !== -1) {
          courseToMove = sem.courses.splice(idx, 1)[0];
          break;
        }
      }

      if (!courseToMove) {
        return { ok: false, error: 'COURSE_NOT_FOUND' };
      }

      // Gán vào học kỳ mới
      courseToMove.semesterId = targetSemesterId;
      targetSem.courses.push(courseToMove);

      return { ok: true };
    }

    /**
     * Xóa một học phần khỏi kế hoạch tương lai
     * @param {Object} futurePlan
     * @param {string} courseCode
     * @returns {{ ok: boolean, error?: string }}
     */
    static removeCourse(futurePlan, courseCode) {
      if (!futurePlan || !Array.isArray(futurePlan.semesters)) {
        return { ok: false, error: 'PLAN_INVALID' };
      }

      for (const sem of futurePlan.semesters) {
        const idx = sem.courses.findIndex(c => c.curriculumCourseCode === courseCode);
        if (idx !== -1) {
          sem.courses.splice(idx, 1);
          return { ok: true };
        }
      }

      return { ok: false, error: 'COURSE_NOT_FOUND' };
    }

    /**
     * Xóa toàn bộ một học kỳ tương lai và giải phóng các môn học bên trong
     * @param {Object} futurePlan
     * @param {string} semesterId
     * @returns {{ ok: boolean, error?: string }}
     */
    static removeSemester(futurePlan, semesterId) {
      if (!futurePlan || !Array.isArray(futurePlan.semesters)) {
        return { ok: false, error: 'PLAN_INVALID' };
      }

      const idx = futurePlan.semesters.findIndex(s => s.id === semesterId);
      if (idx === -1) {
        return { ok: false, error: 'SEMESTER_NOT_FOUND' };
      }

      futurePlan.semesters.splice(idx, 1);
      return { ok: true };
    }

    /**
     * Tính toán điểm tổng kết và GPA cho một môn học tương lai
     * @param {Object} futureCourse
     * @returns {Object} Updated futureCourse
     */
    
    /**
     * Pure helper tính display ordinal liên tục cho các môn học tương lai
     * Bắt đầu từ maxActualDisplaySTT + 1, không reset theo học kỳ, duy trì thứ tự visual plan.
     * @param {Object} params
     * @param {Array<Object>} [params.actualCourses] - Danh sách môn thực tế hoặc mảng semesters thực tế
     * @param {Array<Object>} [params.futureSemesters] - Danh sách học kỳ tương lai
     * @returns {Object.<string, number>} Mapping futureCourseId -> displayOrdinal
     */
    static assignFutureDisplayOrdinals({ actualCourses = [], futureSemesters = [], maxActualSTT: inputMaxActualSTT = null } = {}) {
      let maxActualSTT = 0;
      if (typeof inputMaxActualSTT === 'number' && !isNaN(inputMaxActualSTT) && inputMaxActualSTT > 0) {
        maxActualSTT = inputMaxActualSTT;
      }

      let coursesList = [];
      if (Array.isArray(actualCourses)) {
        if (actualCourses.length > 0 && Array.isArray(actualCourses[0]?.courses)) {
          coursesList = actualCourses.flatMap(s => s.courses || []);
        } else {
          coursesList = actualCourses;
        }
      }

      for (const c of coursesList) {
        if (!c) continue;
        let ord = null;
        if (typeof c.ordinal === 'number' && !isNaN(c.ordinal)) {
          ord = c.ordinal;
        } else if (typeof c.stt === 'number' && !isNaN(c.stt)) {
          ord = c.stt;
        } else if (typeof c.displayOrdinal === 'number' && !isNaN(c.displayOrdinal)) {
          ord = c.displayOrdinal;
        } else if (typeof c.ordinal === 'string' || typeof c.stt === 'string') {
          const parsed = parseInt(c.ordinal || c.stt, 10);
          if (!isNaN(parsed)) ord = parsed;
        }
        if (ord !== null && ord > maxActualSTT) {
          maxActualSTT = ord;
        }
      }

      if (maxActualSTT === 0 && coursesList.length > 0) {
        maxActualSTT = coursesList.length;
      }

      const mapping = Object.create(null);
      let currentOrdinal = maxActualSTT;

      if (Array.isArray(futureSemesters)) {
        for (const fSem of futureSemesters) {
          const courses = fSem?.courses || [];
          for (const fc of courses) {
            if (!fc) continue;
            currentOrdinal += 1;
            const code = fc.curriculumCourseCode || fc.code;
            const id = fc.id;
            if (code) mapping[code] = currentOrdinal;
            if (id) mapping[id] = currentOrdinal;
          }
        }
      }

      return mapping;
    }

    static recalculateFutureCourse(futureCourse) {
      if (!futureCourse) return null;

      const scores = futureCourse.scores || {};
      const hasComponentScores = (scores.final !== null && scores.final !== undefined) ||
        (scores.midterm !== null && scores.midterm !== undefined) ||
        (Array.isArray(scores.regular) && scores.regular.some(s => s !== null && s !== undefined)) ||
        (Array.isArray(scores.practice) && scores.practice.some(s => s !== null && s !== undefined));

      if (hasComponentScores) {
        // Component-based calculation takes STRICT PRIORITY over high-level preset (Requirement 31)
        futureCourse.plannedGradePointOverride = null;
        futureCourse.plannedLetterGradeOverride = null;
        futureCourse.plannedScore10Override = null;
        futureCourse.isPlannedPreset = false;

        if (futureCourse.courseTypeOverride === 'AUTO') futureCourse.courseTypeOverride = null;
        const rawType = futureCourse.courseTypeOverride || futureCourse.inferredCourseType || 'UNKNOWN';
        const isExcluded = rawType === 'EXCLUDED';
        futureCourse.isExcludedFromGpa = isExcluded;

        // If EXCLUDED, use inferredCourseType or THEORY for calculating score/letter/pass status
        const effectiveType = isExcluded
          ? (futureCourse.inferredCourseType && futureCourse.inferredCourseType !== 'UNKNOWN' ? futureCourse.inferredCourseType : 'THEORY')
          : rawType;

        if (effectiveType === 'UNKNOWN' || !GradingRuleEngine) {
          futureCourse.score10 = null;
          futureCourse.score10Raw = null;
          futureCourse.score4 = null;
          futureCourse.score4Raw = null;
          futureCourse.letter = null;
          futureCourse.classification = null;
          futureCourse.isPassed = null;
          return futureCourse;
        }

        const input = {
          scores: futureCourse.scores || {},
          credits: futureCourse.credits,
          courseTypeOverride: effectiveType
        };

        const result = GradingRuleEngine.calculateCourse(input, effectiveType);

        if (result && typeof result.score10Raw === 'number' && !isNaN(result.score10Raw)) {
          futureCourse.score10Raw = result.score10Raw;
          futureCourse.score10 = result.score10;
          futureCourse.score4Raw = result.score4Raw;
          futureCourse.score4 = result.score4;
          futureCourse.letter = result.letter;
          futureCourse.classification = result.classification;
          futureCourse.isPassed = result.isPassed;
        } else {
          futureCourse.score10Raw = null;
          futureCourse.score10 = null;
          futureCourse.score4Raw = null;
          futureCourse.score4 = null;
          futureCourse.letter = null;
          futureCourse.classification = null;
          futureCourse.isPassed = null;
        }

        return futureCourse;
      }

      // Nếu không có component scores nhưng có high-level result override (Requirement 29, 30)
      if (typeof futureCourse.plannedGradePointOverride === 'number') {
        futureCourse.score4Raw = futureCourse.plannedGradePointOverride;
        futureCourse.score4 = futureCourse.plannedGradePointOverride;
        futureCourse.score10Raw = futureCourse.plannedScore10Override ?? null;
        futureCourse.score10 = futureCourse.plannedScore10Override ?? null;
        futureCourse.letter = futureCourse.plannedLetterGradeOverride || '';
        futureCourse.classification = 'Giả định';
        futureCourse.isPassed = futureCourse.plannedGradePointOverride >= 1.0;
        futureCourse.isPlannedPreset = true;
        return futureCourse;
      }

      futureCourse.score10Raw = null;
      futureCourse.score10 = null;
      futureCourse.score4Raw = null;
      futureCourse.score4 = null;
      futureCourse.letter = null;
      futureCourse.classification = null;
      futureCourse.isPassed = null;
      futureCourse.isPlannedPreset = false;

      return futureCourse;
    }

    /**
     * Tính GPA học kỳ tương lai
     * Quy tắc:
     * - Chỉ tính các môn có đủ điểm (`score10Raw` hợp lệ)
     * - Môn chưa có điểm: KHÔNG tính là 0, KHÔNG đưa vào mẫu số
     * - Môn non-GPA (`included === false`): KHÔNG tính vào mẫu số
     * - Giữ nguyên unrounded floats, hiển thị 4 chữ số thập phân
     * @param {Object} futureSemester
     * @returns {Object}
     */
    static calculateFutureSemesterGPA(futureSemester) {
      const courses = Array.isArray(futureSemester)
        ? futureSemester
        : (futureSemester && Array.isArray(futureSemester.courses) ? futureSemester.courses : []);

      let totalPlannedCredits = 0;
      let gpaEligibleCredits = 0;
      let sumWeight10 = 0;
      let sumWeight4 = 0;
      let coursesCompletedCount = 0;

      let earnedCredits = 0;
      let failedCredits = 0;

      courses.forEach(fc => {
        const credits = fc.credits || 0;
        totalPlannedCredits += credits;

        // Chỉ tính môn được chọn tính GPA và không bị EXCLUDED
        const isEligible = fc.included !== false && fc.courseTypeOverride !== 'EXCLUDED' && !fc.isExcludedFromGpa && credits > 0;
        const score10 = (typeof fc.score10Raw === 'number' && !isNaN(fc.score10Raw))
          ? fc.score10Raw
          : (typeof fc.score10 === 'number' && !isNaN(fc.score10)
              ? fc.score10
              : (typeof fc.plannedScore10Override === 'number' ? fc.plannedScore10Override : null));
        const score4 = (typeof fc.score4Raw === 'number' && !isNaN(fc.score4Raw))
          ? fc.score4Raw
          : (typeof fc.score4 === 'number' && !isNaN(fc.score4)
              ? fc.score4
              : (typeof fc.plannedGradePointOverride === 'number' ? fc.plannedGradePointOverride : null));
        const hasScore = score10 !== null || score4 !== null;

        if (hasScore) {
          coursesCompletedCount++;
        }

        if (isEligible && hasScore) {
          gpaEligibleCredits += credits;
          sumWeight10 += (score10 * credits);
          sumWeight4 += (score4 * credits);
        }
      });

      // Track earned and failed credits
      courses.forEach(fc => {
        const credits = fc.credits || 0;
        if (fc.isPassed === true) {
          earnedCredits += credits;
        } else if (fc.isPassed === false) {
          failedCredits += credits;
        }
      });

      const hasSufficientData = gpaEligibleCredits > 0;
      const gpa10Raw = hasSufficientData ? (sumWeight10 / gpaEligibleCredits) : null;
      const gpa4Raw = hasSufficientData ? (sumWeight4 / gpaEligibleCredits) : null;

      let classification = null;
      if (hasSufficientData && gpa4Raw !== null) {
        if (GPAEngine && typeof GPAEngine.getClassification === 'function') {
          classification = GPAEngine.getClassification(gpa4Raw);
        } else if (gpa4Raw >= 3.6) {
          classification = 'Xuất sắc';
        } else if (gpa4Raw >= 3.2) {
          classification = 'Giỏi';
        } else if (gpa4Raw >= 2.5) {
          classification = 'Khá';
        } else if (gpa4Raw >= 2.0) {
          classification = 'Trung bình';
        } else if (gpa4Raw >= 1.0) {
          classification = 'Yếu';
        } else {
          classification = 'Kém';
        }
      }

      return {
        totalPlannedCredits,
        gpaEligibleCredits,
        earnedCredits,
        passedCredits: earnedCredits,
        failedCredits,
        gpa10Raw,
        gpa4Raw,
        gpa10: gpa10Raw !== null ? NumberParser.formatAverage4(gpa10Raw) : null,
        gpa4: gpa4Raw !== null ? NumberParser.formatAverage4(gpa4Raw) : null,
        hasSufficientData,
        coursesTotalCount: courses.length,
        coursesCompletedCount,
        classification
      };
    }

    /**
     * Tính GPA tích lũy dự kiến (Projected Cumulative GPA) sau các học kỳ tương lai
     * Kết hợp điểm số thực tế + điểm số mô phỏng tương lai của các môn đủ điều kiện
     * Tuyệt đối KHÔNG trung bình cộng GPA các kỳ!
     * @param {Array<Object>} actualSemesters - Dữ liệu học kỳ thực tế từ SimulationStore
     * @param {Array<Object>} futureSemesters - Danh sách học kỳ tương lai đến kỳ đang xét
     * @returns {Object}
     */
    static calculateProjectedCumulativeGPA(actualSemestersOrSummary, futureSemesters) {
      let totalEligibleCredits = 0;
      let totalWeight10 = 0;
      let totalWeight4 = 0;

      // 1. Tích lũy từ các học kỳ thực tế (hỗ trợ cả summary object hoặc semesters array)
      if (actualSemestersOrSummary && !Array.isArray(actualSemestersOrSummary) && typeof actualSemestersOrSummary.gradedCredits === 'number') {
        totalEligibleCredits += actualSemestersOrSummary.gradedCredits;
        const gpa4 = actualSemestersOrSummary.gpa4Raw ?? actualSemestersOrSummary.gpa4 ?? 0;
        totalWeight4 += (actualSemestersOrSummary.sumWeighted4 ?? (gpa4 * actualSemestersOrSummary.gradedCredits));
        const gpa10 = actualSemestersOrSummary.gpa10Raw ?? actualSemestersOrSummary.gpa10 ?? 0;
        totalWeight10 += (actualSemestersOrSummary.sumWeighted10 ?? (gpa10 * actualSemestersOrSummary.gradedCredits));
      } else if (Array.isArray(actualSemestersOrSummary)) {
        actualSemestersOrSummary.forEach(sem => {
          if (Array.isArray(sem.courses)) {
            sem.courses.forEach(c => {
              const credits = c.credits || 0;
              const isEligible = c.included !== false && credits > 0;
              const score10 = typeof c.score10Raw === 'number' ? c.score10Raw : c.score10;
              const score4 = typeof c.score4Raw === 'number' ? c.score4Raw : c.score4;

              if (isEligible && typeof score10 === 'number' && !isNaN(score10)) {
                totalEligibleCredits += credits;
                totalWeight10 += (score10 * credits);
                totalWeight4 += ((score4 || 0) * credits);
              }
            });
          }
        });
      }

      // 2. Tích lũy thêm từ các học kỳ tương lai đã có giả định điểm
      if (Array.isArray(futureSemesters)) {
        futureSemesters.forEach(fSem => {
          if (Array.isArray(fSem.courses)) {
            fSem.courses.forEach(fc => {
              const credits = fc.credits || 0;
              const isEligible = fc.included !== false && fc.courseTypeOverride !== "EXCLUDED" && !fc.isExcludedFromGpa && credits > 0;
              const score10 = (typeof fc.score10Raw === 'number' && !isNaN(fc.score10Raw))
                ? fc.score10Raw
                : (typeof fc.score10 === 'number' && !isNaN(fc.score10)
                    ? fc.score10
                    : (typeof fc.plannedScore10Override === 'number' ? fc.plannedScore10Override : null));
              const score4 = (typeof fc.score4Raw === 'number' && !isNaN(fc.score4Raw))
                ? fc.score4Raw
                : (typeof fc.score4 === 'number' && !isNaN(fc.score4)
                    ? fc.score4
                    : (typeof fc.plannedGradePointOverride === 'number' ? fc.plannedGradePointOverride : null));
              const hasScore = score10 !== null || score4 !== null;

              if (isEligible && hasScore) {
                totalEligibleCredits += credits;
                if (score10 !== null) totalWeight10 += (score10 * credits);
                if (score4 !== null) totalWeight4 += (score4 * credits);
              }
            });
          }
        });
      }

      const hasData = totalEligibleCredits > 0;
      const gpa10Raw = hasData ? (totalWeight10 / totalEligibleCredits) : null;
      const gpa4Raw = hasData ? (totalWeight4 / totalEligibleCredits) : null;

      let cumulativeClassification = null;
      if (hasData && gpa4Raw !== null) {
        if (GPAEngine && typeof GPAEngine.getClassification === 'function') {
          cumulativeClassification = GPAEngine.getClassification(gpa4Raw);
        } else if (gpa4Raw >= 3.6) {
          cumulativeClassification = 'Xuất sắc';
        } else if (gpa4Raw >= 3.2) {
          cumulativeClassification = 'Giỏi';
        } else if (gpa4Raw >= 2.5) {
          cumulativeClassification = 'Khá';
        } else if (gpa4Raw >= 2.0) {
          cumulativeClassification = 'Trung bình';
        } else if (gpa4Raw >= 1.0) {
          cumulativeClassification = 'Yếu';
        } else {
          cumulativeClassification = 'Kém';
        }
      }

      return {
        totalEligibleCredits,
        projectedGradedCredits: totalEligibleCredits,
        cumulativeCredits: totalEligibleCredits,
        gpa10Raw,
        gpa4Raw,
        projectedCumulativeGPA4Raw: gpa4Raw,
        projectedCumulativeGPA10Raw: gpa10Raw,
        gpa10: gpa10Raw !== null ? NumberParser.formatAverage4(gpa10Raw) : null,
        gpa4: gpa4Raw !== null ? NumberParser.formatAverage4(gpa4Raw) : null,
        projectedCumulativeGPA4: gpa4Raw !== null ? NumberParser.formatAverage4(gpa4Raw) : null,
        projectedCumulativeGPA10: gpa10Raw !== null ? NumberParser.formatAverage4(gpa10Raw) : null,
        classification: cumulativeClassification,
        hasData,
        hasSufficientData: hasData
      };
    }

    /**
     * Áp dụng giả lập nhanh kết quả cho các môn trong kế hoạch tương lai (What-if Presets)
     * Tuyệt đối KHÔNG bịa điểm thành phần GK, CK, TX, TH (Requirement 28)
     * @param {Object} futurePlan
     * @param {string} targetGradeLetter - e.g. 'A', 'B+', 'B'
     * @param {Array<Object>} [gradeBands] - Bảng quy đổi điểm từ GradingRuleEngine
     * @returns {{ ok: boolean, modifiedCount: number, previousSnapshot: string, error?: string }}
     */
    static applyWhatIfPreset(futurePlan, targetGradeLetter, gradeBands = null) {
      if (!futurePlan || !Array.isArray(futurePlan.semesters)) {
        return { ok: false, error: 'PLAN_INVALID' };
      }

      const bands = gradeBands || (GradingRuleEngine ? GradingRuleEngine.DEFAULT_GRADE_BANDS : [
        { letter: 'A+', gradePoint: 4.0, min10: 9.0, max10: 10.0 },
        { letter: 'A', gradePoint: 3.8, min10: 8.5, max10: 8.99 },
        { letter: 'B+', gradePoint: 3.5, min10: 8.0, max10: 8.49 },
        { letter: 'B', gradePoint: 3.0, min10: 7.0, max10: 7.99 },
        { letter: 'C+', gradePoint: 2.5, min10: 6.0, max10: 6.99 },
        { letter: 'C', gradePoint: 2.0, min10: 5.5, max10: 5.99 },
        { letter: 'D+', gradePoint: 1.5, min10: 5.0, max10: 5.49 },
        { letter: 'D', gradePoint: 1.0, min10: 4.0, max10: 4.99 },
        { letter: 'F', gradePoint: 0.0, min10: 0.0, max10: 3.99 },
      ]);

      const targetBand = bands.find(b => b.letter.trim().toUpperCase() === targetGradeLetter.trim().toUpperCase());
      if (!targetBand) {
        return { ok: false, error: 'UNKNOWN_GRADE_BAND' };
      }

      // Lưu snapshot trước khi áp dụng để hỗ trợ Undo (Requirement 32)
      const previousSnapshot = JSON.stringify(futurePlan.semesters);
      let modifiedCount = 0;

      futurePlan.semesters.forEach(sem => {
        if (Array.isArray(sem.courses)) {
          sem.courses.forEach(fc => {
            // Chỉ áp dụng nếu môn đó chưa có điểm thành phần thực tế
            const scores = fc.scores || {};
            const hasScores = (scores.final !== null && scores.final !== undefined) ||
              (scores.midterm !== null && scores.midterm !== undefined);

            if (!hasScores) {
              fc.plannedGradePointOverride = targetBand.gradePoint;
              fc.plannedLetterGradeOverride = targetBand.letter;
              fc.plannedScore10Override = (targetBand.min10 + targetBand.max10) / 2;
              fc.isPlannedPreset = true;

              this.recalculateFutureCourse(fc);
              modifiedCount++;
            }
          });
        }
      });

      return {
        ok: true,
        modifiedCount,
        targetGradeLetter: targetBand.letter,
        gradePoint: targetBand.gradePoint,
        previousSnapshot
      };
    }

    /**
     * Hoàn tác preset giả lập nhanh (Undo)
     * @param {Object} futurePlan
     * @param {string} previousSnapshot
     * @returns {{ ok: boolean, error?: string }}
     */
    static restoreWhatIfPreset(futurePlan, previousSnapshot) {
      if (!futurePlan || !previousSnapshot) {
        return { ok: false, error: 'INVALID_ARGUMENTS' };
      }

      try {
        const parsed = JSON.parse(previousSnapshot);
        if (Array.isArray(parsed)) {
          futurePlan.semesters = parsed;
          return { ok: true };
        }
        return { ok: false, error: 'MALFORMED_SNAPSHOT' };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }
  }

  FutureSemesterEngine.MAX_FUTURE_SEMESTERS = MAX_FUTURE_SEMESTERS;
  FutureSemesterEngine.PLANNING_TYPES = PLANNING_TYPES;
  FutureSemesterEngine.ELECTIVE_GROUP_STATUS = ELECTIVE_GROUP_STATUS;

  const assignFutureDisplayOrdinals = FutureSemesterEngine.assignFutureDisplayOrdinals;

  const api = {
    FutureSemesterEngine,
    assignFutureDisplayOrdinals,
    MAX_FUTURE_SEMESTERS,
    PLANNING_TYPES,
    ELECTIVE_GROUP_STATUS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.FutureSemesterEngine = FutureSemesterEngine;
    root.core.assignFutureDisplayOrdinals = assignFutureDisplayOrdinals;
    global._IUHFutureSemesterEngine = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
