(function (global) {
  'use strict';

  const CourseIdentityMatcher = (typeof require !== 'undefined')
    ? require('./CourseIdentityMatcher.js').CourseIdentityMatcher
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core.CourseIdentityMatcher : null);

  const { PROVENANCE } = (typeof require !== 'undefined')
    ? require('./DataProvenance.js')
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.DataProvenance
        ? global.IUHGPA.core.DataProvenance
        : { PROVENANCE: {} });

  const ELECTIVE_STATUS = {
    SATISFIED_COMPLETED: 'SATISFIED_COMPLETED',
    SATISFIED_WITH_PLAN: 'SATISFIED_WITH_PLAN',
    IN_PROGRESS: 'IN_PROGRESS',
    NOT_STARTED: 'NOT_STARTED',
    UNKNOWN: 'UNKNOWN',
    OVER_PLANNED: 'OVER_PLANNED'
  };

  /**
   * Chuẩn hóa mã học phần
   * @param {string} code
   * @returns {string}
   */
  function normalizeCode(code) {
    if (!code || typeof code !== 'string') return '';
    return code.trim().replace(/\s+/g, '');
  }

  function getCreditValue(value) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return value;
    }
    if (value && value.status === 'ok' && typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0) {
      return value.value;
    }
    return null;
  }

  /**
   * Kiểm tra một môn học từ bảng điểm đã ĐẠT (PASS) hay chưa
   * Bắt buộc có chứng cứ đầy đủ:
   * 1. officialResult.passed === true hoặc gc.passed === true hoặc gc.isPassed === true
   * 2. Hoặc điểm hệ 10 >= 4.0 hoặc điểm hệ 4 >= 1.0
   * 3. Điểm chữ khác 'F'
   * @param {Object} gradeCourse
   * @returns {boolean}
   */
  function isGradeCoursePassed(gradeCourse) {
    if (!gradeCourse) return false;

    if (gradeCourse.passed === true || gradeCourse.isPassed === true) {
      return true;
    }
    if (gradeCourse.officialResult && gradeCourse.officialResult.passed === true) {
      return true;
    }
    if (typeof gradeCourse.score10 === 'number' && gradeCourse.score10 >= 4.0) {
      return true;
    }
    if (gradeCourse.officialResult && gradeCourse.officialResult.total10 && gradeCourse.officialResult.total10.status === 'ok') {
      if (gradeCourse.officialResult.total10.value >= 4.0) return true;
    }
    if (typeof gradeCourse.score4 === 'number' && gradeCourse.score4 >= 1.0) {
      return true;
    }
    if (gradeCourse.letter && typeof gradeCourse.letter === 'string') {
      const letter = gradeCourse.letter.trim().toUpperCase();
      if (letter && letter !== 'F' && letter !== 'CHƯA ĐẠT' && letter !== 'FAIL') {
        return true;
      }
    }
    return false;
  }

  /**
   * Kiểm tra môn học trong kế hoạch tương lai (FutureCourse) đã ĐẠT theo mô phỏng hay chưa
   * @param {Object} futureCourse
   * @returns {boolean}
   */
  function isFutureCourseSimulatedPass(futureCourse) {
    if (!futureCourse) return false;

    // 1. Kiểm tra preset override kết quả bậc cao (What-if preset)
    if (typeof futureCourse.plannedGradePointOverride === 'number') {
      return futureCourse.plannedGradePointOverride >= 1.0;
    }
    if (futureCourse.plannedLetterGradeOverride) {
      const l = futureCourse.plannedLetterGradeOverride.trim().toUpperCase();
      return l !== 'F';
    }

    // 2. Kiểm tra kết quả tính từ điểm thành phần (component-based)
    if (futureCourse.isPassed === true) {
      return true;
    }
    if (typeof futureCourse.score10Raw === 'number' && futureCourse.score10Raw >= 4.0) {
      return true;
    }
    if (typeof futureCourse.score10 === 'number' && futureCourse.score10 >= 4.0) {
      return true;
    }
    if (typeof futureCourse.score4 === 'number' && futureCourse.score4 >= 1.0) {
      return true;
    }
    if (futureCourse.letter && typeof futureCourse.letter === 'string') {
      const letter = futureCourse.letter.trim().toUpperCase();
      return letter && letter !== 'F';
    }

    // Nếu chưa nhập đủ điểm hoặc điểm rớt -> không pass
    return false;
  }

  class CurriculumProgressEngine {
    /**
     * Phân tích tiến độ Chương trình khung và tính toán các chỉ số tín chỉ
     *
     * @param {Object} curriculumModel - Dữ liệu CTK từ IUHCurriculumAdapter
     * @param {Array<Object>} gradeData - Dữ liệu bảng điểm (dạng semesters array hoặc flat courses array)
     * @param {Object} [futurePlan=null] - Kế hoạch học tập tương lai
     * @returns {Object} ProgressSummary
     */
    static calculateProgress(curriculumModel, gradeData, futurePlan = null, options = {}) {
      if (!curriculumModel || !Array.isArray(curriculumModel.courses)) {
        return this._getEmptyProgress();
      }
      if (!options || typeof options !== 'object') options = {};

      // Trích xuất phẳng danh sách môn học từ bảng điểm
      const flatGradeCourses = [];
      if (Array.isArray(gradeData)) {
        gradeData.forEach(item => {
          if (item && Array.isArray(item.courses)) {
            flatGradeCourses.push(...item.courses);
          } else if (item) {
            flatGradeCourses.push(item);
          }
        });
      }

      let officialTranscriptCumulativeCredits = getCreditValue(options.officialCumulativeCredits);
      if (officialTranscriptCumulativeCredits === null && Array.isArray(gradeData)) {
        for (let i = gradeData.length - 1; i >= 0; i--) {
          const item = gradeData[i];
          const cumulativeCredits = getCreditValue(
            item?.officialSummary?.cumulativeCredits
              ?? item?.summary?.cumulativeCredits
              ?? item?.cumulativeCredits
          );
          if (cumulativeCredits !== null) {
            officialTranscriptCumulativeCredits = cumulativeCredits;
            break;
          }
        }
      }

      // 1. Xây dựng bản đồ môn đã học & đã đạt từ bảng điểm
      const gradeCourseMap = new Map();
      const passedGradeCodeSet = new Set();
      const registeredCodeSet = new Set();

      flatGradeCourses.forEach(gc => {
        const candidateCodes = [
          gc.courseCode,
          gc.code,
          gc.curriculumCourseCode,
          gc.courseClassCode,
          gc.id,
          gc.curriculumCourse ? gc.curriculumCourse.code : null,
          gc.curriculumCourse ? gc.curriculumCourse.curriculumCourseCode : null
        ].filter(Boolean);

        const isPassed = isGradeCoursePassed(gc);

        candidateCodes.forEach(rawCode => {
          const normCode = normalizeCode(rawCode);
          const code10 = normCode.length >= 10 ? normCode.slice(0, 10) : normCode;

          if (normCode) {
            gradeCourseMap.set(normCode, gc);
            registeredCodeSet.add(normCode);
            if (isPassed) passedGradeCodeSet.add(normCode);
          }
          if (code10) {
            gradeCourseMap.set(code10, gc);
            registeredCodeSet.add(code10);
            if (isPassed) passedGradeCodeSet.add(code10);
          }
        });
      });

      // Use CourseIdentityMatcher to resolve any unmatched grade courses to CTK
      if (CourseIdentityMatcher && typeof CourseIdentityMatcher.matchCourse === 'function') {
        flatGradeCourses.forEach(gc => {
          const isPassed = isGradeCoursePassed(gc);
          try {
            const matchRes = CourseIdentityMatcher.matchCourse(gc, curriculumModel.courses);
            if (matchRes && matchRes.curriculumCourseCode) {
              const normCtk = normalizeCode(matchRes.curriculumCourseCode);
              if (normCtk) {
                registeredCodeSet.add(normCtk);
                if (isPassed) passedGradeCodeSet.add(normCtk);
              }
            }
          } catch (e) {
            // Ignore matcher error
          }
        });
      }

      // 2. Xây dựng bản đồ các môn trong FuturePlan
      const plannedCourseMap = new Map();
      if (futurePlan && Array.isArray(futurePlan.semesters)) {
        futurePlan.semesters.forEach(sem => {
          if (Array.isArray(sem.courses)) {
            sem.courses.forEach(fc => {
              const code = normalizeCode(fc.curriculumCourseCode || fc.code);
              if (code) {
                plannedCourseMap.set(code, {
                  course: fc,
                  semester: sem
                });
              }
            });
          }
        });
      }

      // 3. Phân loại tiến độ từng môn học trong CTK
      let curriculumRequiredCredits = curriculumModel.totals?.totalRequiredCredits
        ?? curriculumModel.requiredCredits
        ?? curriculumModel.totalCredits
        ?? 0;

      let curriculumCompletedCredits = 0;
      let curriculumPlannedCredits = 0;
      let curriculumProjectedCompletedCredits = 0;

      let gpaEligibleCompletedCredits = 0;
      let gpaEligiblePlannedCredits = 0;
      let gpaExcludedCompletedCredits = 0;
      let gpaExcludedPlannedCredits = 0;

      let registeredCredits = 0;
      let passedCredits = 0;

      // Mandatory tracking
      let mandatoryRequiredCredits = curriculumModel.totals?.totalMandatoryCredits
        ?? curriculumModel.mandatoryCredits
        ?? 0;
      let mandatoryCompletedCredits = 0;
      let mandatoryPlannedCredits = 0;
      let mandatoryProjectedCompletedCredits = 0;
      const mandatoryRemainingCourses = [];

      // Nhóm môn học theo nhóm tự chọn
      const electiveGroupDataMap = new Map();
      if (Array.isArray(curriculumModel.electiveGroups)) {
        curriculumModel.electiveGroups.forEach(g => {
          const rawLabel = (g.label || g.groupName || g.name || '').trim();
          const cleanLabel = rawLabel && !rawLabel.includes('undefined')
            ? rawLabel
            : (g.id ? `Nhóm tự chọn ${String(g.id).replace('elective_', '')}` : 'Nhóm tự chọn');
          electiveGroupDataMap.set(g.id, {
            groupId: g.id,
            label: cleanLabel,
            requiredCredits: g.requiredCredits || 0,
            status: g.status || (g.requiredCredits > 0 ? 'VALID' : 'INCOMPATIBLE_GROUP'),
            completedCredits: 0,
            plannedCredits: 0,
            projectedCompletedCredits: 0,
            courses: [],
            completedCourses: [],
            plannedCourses: [],
            remainingAvailableCourses: []
          });
        });
      }

      // Duyệt qua từng môn trong CTK
      let calculatedMandatoryRequired = 0;

      curriculumModel.courses.forEach(c => {
        const cCode = normalizeCode(c.code || c.curriculumCourseCode);
        const credits = typeof c.credits === 'number' ? c.credits : 0;
        const countsTowardGPA = c.countsTowardCumulativeGPA !== false && !c.hasAsterisk && credits > 0;
        const isMandatory = c.requirementType === 'MANDATORY' || c.isMandatory === true || (!c.isElective && !c.electiveGroup && !c.electiveGroupId);
        const isElective = c.requirementType === 'ELECTIVE' || Boolean(c.electiveGroup) || Boolean(c.electiveGroupId) || c.isElective === true;

        if (isMandatory) {
          calculatedMandatoryRequired += credits;
        }

        // BẰNG CHỨNG HOÀN THÀNH (PHASE 6A.5.5 SOURCE PRIORITY):
        // 1. Primary source: Bảng điểm thực tế (matched grade course có bằng chứng đạt)
        // 2. Secondary evidence: Khi không có bảng điểm (flatGradeCourses rỗng), fallback theo CTK passState
        const hasTranscriptCourses = flatGradeCourses.length > 0;
        const isGradePassed = passedGradeCodeSet.has(cCode);
        const isCtkPass = c.passState === 'PASS' || c.isPassed === true;
        const isCompleted = hasTranscriptCourses ? Boolean(isGradePassed) : Boolean(isCtkPass);

        // Bằng chứng đăng ký
        const isRegistered = registeredCodeSet.has(cCode) || c.studiedState === 'STUDIED' || isCompleted;
        if (isRegistered) {
          registeredCredits += credits;
        }

        // Kế hoạch tương lai
        const plannedInfo = plannedCourseMap.get(cCode);
        const isPlanned = Boolean(plannedInfo);
        const isProjectedPass = isPlanned && isFutureCourseSimulatedPass(plannedInfo.course);

        // Cộng dồn tiến độ tổng
        if (isCompleted) {
          curriculumCompletedCredits += credits;
          passedCredits += credits;

          if (countsTowardGPA) {
            gpaEligibleCompletedCredits += credits;
          } else {
            gpaExcludedCompletedCredits += credits;
          }

          if (isMandatory) {
            mandatoryCompletedCredits += credits;
          }
        } else if (isPlanned) {
          curriculumPlannedCredits += credits;

          if (isProjectedPass) {
            curriculumProjectedCompletedCredits += credits;
          }

          if (countsTowardGPA) {
            if (isProjectedPass) {
              gpaEligiblePlannedCredits += credits;
            }
          } else {
            gpaExcludedPlannedCredits += credits;
          }

          if (isMandatory) {
            mandatoryPlannedCredits += credits;
            if (isProjectedPass) {
              mandatoryProjectedCompletedCredits += credits;
            }
          }
        } else {
          // Chưa học và chưa lên kế hoạch
          if (isMandatory) {
            mandatoryRemainingCourses.push({
              code: c.code,
              name: c.name,
              credits,
              curriculumSemester: c.curriculumSemester || 'Học kỳ chưa xác định',
              curriculumSemesterIndex: c.curriculumSemesterIndex || 99,
              term: c.curriculumSemesterIndex || null,
              inferredCourseType: c.inferredCourseType || 'UNKNOWN',
              theoryHours: c.theoryHours || 0,
              practiceHours: c.practiceHours || 0,
              hasAsterisk: Boolean(c.hasAsterisk),
              countsTowardCumulativeGPA: countsTowardGPA,
              status: isRegistered ? 'REGISTERED_OR_FAILED' : 'NOT_STARTED'
            });
          }
        }

        // Theo dõi theo từng nhóm tự chọn
        const gKey = (c.electiveGroup && typeof c.electiveGroup === 'object') ? c.electiveGroup.id : (c.electiveGroup || c.electiveGroupId);
        if (isElective && gKey) {
          let gData = electiveGroupDataMap.get(gKey);
          if (!gData) {
            const autoLabel = (c.electiveGroupName && !c.electiveGroupName.includes('undefined'))
              ? c.electiveGroupName
              : (gKey ? `Nhóm tự chọn ${String(gKey).replace('elective_', '')}` : 'Nhóm tự chọn');
            gData = {
              groupId: gKey,
              label: autoLabel,
              requiredCredits: c.electiveGroupRequiredCredits || 0,
              completedCredits: 0,
              plannedCredits: 0,
              projectedCompletedCredits: 0,
              courses: [],
              completedCourses: [],
              plannedCourses: [],
              remainingAvailableCourses: []
            };
            electiveGroupDataMap.set(gKey, gData);
          }

          gData.courses.push(c);

          if (isCompleted) {
            gData.completedCredits += credits;
            gData.completedCourses.push(c);
          } else if (isPlanned) {
            gData.plannedCredits += credits;
            gData.plannedCourses.push(plannedInfo.course);
            if (isProjectedPass) {
              gData.projectedCompletedCredits += credits;
            }
          } else {
            gData.remainingAvailableCourses.push(c);
          }
        }
      });

      // Nếu metadata mandatory chưa có trong CTK table totals, dùng calculatedMandatoryRequired
      if (mandatoryRequiredCredits === 0 && calculatedMandatoryRequired > 0) {
        mandatoryRequiredCredits = calculatedMandatoryRequired;
      }

      // Section 11, 12, 13, 14: Capping & Deduplication Formula
      // 1. Mandatory Capping
      const mandatoryRawCompletedCredits = mandatoryCompletedCredits;
      const mandatoryCountedCompletedCredits = Math.min(mandatoryRequiredCredits, mandatoryRawCompletedCredits);
      const mandatoryRemainingCredits = Math.max(0, mandatoryRequiredCredits - mandatoryCountedCompletedCredits);
      const mandatoryCountedPlannedCredits = Math.min(mandatoryRemainingCredits, mandatoryPlannedCredits);
      const mandatoryRemainingAfterPlan = Math.max(0, mandatoryRequiredCredits - mandatoryCountedCompletedCredits - mandatoryCountedPlannedCredits);
      const mandatoryProjectedFinal = mandatoryCountedCompletedCredits + Math.min(mandatoryRemainingCredits, mandatoryProjectedCompletedCredits);

      // 2. Electives Capping per group
      const electiveGroups = [];
      let totalElectiveRequired = 0;
      let totalElectiveRawCompleted = 0;
      let totalElectiveCountedCompleted = 0;
      let totalElectivePlanned = 0;
      let totalElectiveCountedPlanned = 0;

      let groupCounter = 0;
      electiveGroupDataMap.forEach(g => {
        groupCounter++;
        const reqCr = (typeof g.requiredCredits === 'number' && Number.isFinite(g.requiredCredits)) ? g.requiredCredits : 0;
        totalElectiveRequired += reqCr;

        const rawCompleted = g.completedCredits;
        totalElectiveRawCompleted += rawCompleted;

        const countedCompleted = Math.min(reqCr, rawCompleted);
        totalElectiveCountedCompleted += countedCompleted;

        const rem = Math.max(0, reqCr - countedCompleted);
        const countedPlanned = Math.min(rem, g.plannedCredits);
        totalElectivePlanned += g.plannedCredits;
        totalElectiveCountedPlanned += countedPlanned;

        const remAfterPlan = Math.max(0, reqCr - countedCompleted - countedPlanned);
        const overPlannedCredits = Math.max(0, (rawCompleted + g.plannedCredits) - reqCr);

        let status = ELECTIVE_STATUS.NOT_STARTED;
        if (g.status === 'INCOMPATIBLE_GROUP' || reqCr <= 0) {
          status = 'INCOMPATIBLE_GROUP';
        } else if (countedCompleted >= reqCr) {
          status = ELECTIVE_STATUS.SATISFIED_COMPLETED;
        } else if (countedCompleted + g.plannedCredits > reqCr) {
          status = ELECTIVE_STATUS.OVER_PLANNED;
        } else if (countedCompleted + countedPlanned === reqCr && (countedCompleted > 0 || countedPlanned > 0)) {
          status = ELECTIVE_STATUS.SATISFIED_WITH_PLAN;
        } else if (countedCompleted > 0 || g.plannedCredits > 0) {
          status = ELECTIVE_STATUS.IN_PROGRESS;
        }

        let gLabel = (g.label || g.groupName || g.name || ('Nhóm tự chọn ' + groupCounter)).trim();
        let gName = (g.name || g.groupName || g.label || ('Nhóm tự chọn ' + groupCounter)).trim();
        if (gLabel.includes('undefined')) gLabel = 'Nhóm tự chọn ' + groupCounter;
        if (gName.includes('undefined')) gName = 'Nhóm tự chọn ' + groupCounter;

        electiveGroups.push({
          id: g.groupId,
          groupId: g.groupId,
          name: gName,
          label: gLabel,
          groupName: gName,
          groupIndex: groupCounter,
          requiredCredits: reqCr,
          completedCredits: countedCompleted,
          rawCompletedCredits: rawCompleted,
          plannedCredits: g.plannedCredits,
          countedPlannedCredits: countedPlanned,
          remainingCredits: rem,
          remainingAfterPlan: remAfterPlan,
          remainingCreditsAfterPlan: remAfterPlan,
          coverage: Math.min(reqCr, countedCompleted + countedPlanned),
          coverageCredits: Math.min(reqCr, countedCompleted + countedPlanned),
          overPlannedCredits,
          status,
          isSatisfied: status === ELECTIVE_STATUS.SATISFIED_COMPLETED || status === ELECTIVE_STATUS.SATISFIED_WITH_PLAN || status === ELECTIVE_STATUS.OVER_PLANNED,
          coursesCount: g.courses.length,
          courses: g.courses,
          completedCourses: g.completedCourses,
          plannedCourses: g.plannedCourses,
          remainingAvailableCourses: g.remainingAvailableCourses
        });
      });

      // 3. Overall CTK Requirements & Capping
      if (curriculumRequiredCredits === 0) {
        curriculumRequiredCredits = mandatoryRequiredCredits + totalElectiveRequired;
      }

      const totalRawCompleted = mandatoryRawCompletedCredits + totalElectiveRawCompleted;
      const calculatedCompletedCredits = Math.min(curriculumRequiredCredits, mandatoryCountedCompletedCredits + totalElectiveCountedCompleted);
      const totalCountedCompleted = officialTranscriptCumulativeCredits === null
        ? calculatedCompletedCredits
        : Math.min(calculatedCompletedCredits, officialTranscriptCumulativeCredits);

      const curriculumRemainingCredits = Math.max(0, curriculumRequiredCredits - totalCountedCompleted);
      const totalCountedPlanned = Math.min(curriculumRemainingCredits, mandatoryCountedPlannedCredits + totalElectiveCountedPlanned);
      const curriculumRemainingAfterPlan = Math.max(0, curriculumRequiredCredits - totalCountedCompleted - totalCountedPlanned);

      // Projected Completed Credits = completed + future planned courses that PASS (Section 48 & Requirement 2)
      const curriculumProjectedFinal = totalCountedCompleted + Math.min(curriculumRemainingCredits, curriculumProjectedCompletedCredits);

      // Calculate accurate GPA-eligible remaining credits (Phase 6A.5.5 Section 47)
      // Only courses where countsTowardCumulativeGPA !== false and !hasAsterisk and credits > 0 count
      const mandatoryGpaRemaining = mandatoryRemainingCourses
        .filter(c => c.countsTowardCumulativeGPA)
        .reduce((sum, c) => sum + (c.credits || 0), 0);

      const electiveGpaRemaining = electiveGroups.reduce((sum, g) => sum + (g.remainingCredits || 0), 0);
      const gpaEligibleRemainingCredits = mandatoryGpaRemaining + electiveGpaRemaining;

      // GPA-eligible remaining after plan
      const plannedGpaCredits = (futurePlan?.semesters || []).flatMap(s => s.courses || [])
        .filter(c => c.included !== false && c.countsTowardCumulativeGPA !== false && !c.hasAsterisk)
        .reduce((sum, c) => sum + (c.credits || 0), 0);
      const gpaEligibleRemainingAfterPlan = Math.max(0, gpaEligibleRemainingCredits - plannedGpaCredits);

      // Sắp xếp danh sách môn bắt buộc còn lại theo học kỳ CTK tăng dần
      mandatoryRemainingCourses.sort((a, b) => a.curriculumSemesterIndex - b.curriculumSemesterIndex);

      const currentProgressPercent = curriculumRequiredCredits > 0
        ? Math.min(100, Math.round((totalCountedCompleted / curriculumRequiredCredits) * 1000) / 10)
        : 0;

      const projectedProgressPercent = curriculumRequiredCredits > 0
        ? Math.min(100, Math.round((curriculumProjectedFinal / curriculumRequiredCredits) * 1000) / 10)
        : 0;

      // Reconciliation with official transcript cumulative credits (Phase 6A.5.5 Section 35, 37)
      let reconciliationStatus = 'UNVERIFIED';
      let reconciliationDifference = null;
      let reconciliationWarning = null;

      if (officialTranscriptCumulativeCredits !== null) {
        reconciliationDifference = Math.abs(calculatedCompletedCredits - officialTranscriptCumulativeCredits);
        if (reconciliationDifference === 0) {
          reconciliationStatus = 'MATCHED';
        } else if (reconciliationDifference <= 3) {
          reconciliationStatus = 'MINOR_VARIANCE';
          reconciliationWarning = `Chênh lệch ${reconciliationDifference} tín chỉ giữa CTK (${calculatedCompletedCredits} TC) và Bảng điểm chính thức (${officialTranscriptCumulativeCredits} TC).`;
        } else {
          reconciliationStatus = 'SIGNIFICANT_DISCREPANCY';
          reconciliationWarning = `Chênh lệch đáng kể: CTK tính được ${calculatedCompletedCredits} TC nhưng bảng điểm tích lũy ${officialTranscriptCumulativeCredits} TC. Cần đối chiếu lại môn tương đương hoặc điều kiện tốt nghiệp.`;
        }
      }

      return {
        // Overall Curriculum credits separation (Bắt buộc tách bạch theo Requirement 3 & 9 & 10 & 37)
        curriculumRequiredCredits,
        verifiedCurriculumCompletedCredits: totalCountedCompleted,
        curriculumCompletedCredits: totalCountedCompleted,
        curriculumCalculatedCompletedCredits: calculatedCompletedCredits,
        officialTranscriptCumulativeCredits,
        plannedCurriculumCredits: curriculumPlannedCredits,
        curriculumPlannedCredits,
        curriculumProjectedCompletedCredits: curriculumProjectedFinal,
        projectedCurriculumCompletedCredits: curriculumProjectedFinal,
        curriculumRemainingCredits,
        curriculumRemainingAfterPlan,
        reconciliationStatus,
        reconciliationDifference,
        reconciliationWarning,

        curriculumRawCompletedCredits: totalRawCompleted,
        curriculumCountedPlannedCredits: totalCountedPlanned,

        // GPA credits separation (GPA credit != Graduation credit theo Requirement 4 & 39)
        gpaEligibleCompletedCredits,
        gpaEligiblePlannedCredits,
        gpaEligibleRemainingCredits,
        gpaEligibleRemainingAfterPlan,
        gpaExcludedCompletedCredits,
        gpaExcludedPlannedCredits,

        // Registered & Passed
        registeredCredits,
        passedCredits,

        // Progress percentage (Capped <= 100%)
        currentProgressPercent,
        projectedProgressPercent,

        // Mandatory Progress
        mandatory: {
          requiredCredits: mandatoryRequiredCredits,
          completedCredits: mandatoryCountedCompletedCredits,
          rawCompletedCredits: mandatoryRawCompletedCredits,
          plannedCredits: mandatoryPlannedCredits,
          countedPlannedCredits: mandatoryCountedPlannedCredits,
          projectedCompletedCredits: mandatoryProjectedFinal,
          remainingCredits: mandatoryRemainingCredits,
          remainingAfterPlan: mandatoryRemainingAfterPlan,
          remainingCreditsAfterPlan: mandatoryRemainingAfterPlan,
          remainingCourses: mandatoryRemainingCourses
        },

        // Elective Groups Progress
        electives: {
          totalRequired: totalElectiveRequired,
          totalCompleted: totalElectiveCountedCompleted,
          totalRawCompleted: totalElectiveRawCompleted,
          totalPlanned: totalElectivePlanned,
          totalCountedPlanned: totalElectiveCountedPlanned,
          groups: electiveGroups
        },

        // Provenance & Disclaimers
        disclaimer: 'Tiến độ theo dữ liệu Chương trình khung. Không bao gồm toàn bộ điều kiện tốt nghiệp khác.'
      };
    }

    static _getEmptyProgress() {
      return {
        curriculumRequiredCredits: 0,
        verifiedCurriculumCompletedCredits: 0,
        curriculumCompletedCredits: 0,
        officialTranscriptCumulativeCredits: null,
        plannedCurriculumCredits: 0,
        projectedCurriculumCompletedCredits: 0,
        curriculumRemainingCredits: 0,
        curriculumRemainingAfterPlan: 0,
        reconciliationStatus: 'UNVERIFIED',
        reconciliationDifference: null,
        reconciliationWarning: null,
        curriculumRawCompletedCredits: 0,
        curriculumCountedPlannedCredits: 0,
        gpaEligibleCompletedCredits: 0,
        gpaEligiblePlannedCredits: 0,
        gpaEligibleRemainingCredits: 0,
        gpaEligibleRemainingAfterPlan: 0,
        gpaExcludedCompletedCredits: 0,
        gpaExcludedPlannedCredits: 0,
        registeredCredits: 0,
        passedCredits: 0,
        currentProgressPercent: 0,
        projectedProgressPercent: 0,
        mandatory: {
          requiredCredits: 0,
          completedCredits: 0,
          plannedCredits: 0,
          projectedCompletedCredits: 0,
          remainingCredits: 0,
          remainingAfterPlan: 0,
          remainingCourses: []
        },
        electives: {
          totalRequired: 0,
          totalCompleted: 0,
          totalPlanned: 0,
          groups: []
        },
        disclaimer: 'Tiến độ theo dữ liệu Chương trình khung. Không bao gồm toàn bộ điều kiện tốt nghiệp khác.'
      };
    }
  }

  CurriculumProgressEngine.ELECTIVE_STATUS = ELECTIVE_STATUS;
  CurriculumProgressEngine.calculateProgress = CurriculumProgressEngine.calculateProgress;
  CurriculumProgressEngine.CurriculumProgressEngine = CurriculumProgressEngine;

  const api = {
    CurriculumProgressEngine,
    ELECTIVE_STATUS,
    calculateProgress: CurriculumProgressEngine.calculateProgress
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  const targets = [];
  if (typeof globalThis !== 'undefined') targets.push(globalThis);
  if (typeof window !== 'undefined' && !targets.includes(window)) targets.push(window);
  if (typeof global !== 'undefined' && !targets.includes(global)) targets.push(global);
  targets.forEach(t => {
    t.IUHGPA = t.IUHGPA || {};
    t.IUHGPA.core = t.IUHGPA.core || {};
    t.IUHGPA.core.CurriculumProgressEngine = CurriculumProgressEngine;
    t.IUHGPA.core.ELECTIVE_STATUS = ELECTIVE_STATUS;
    t._IUHCurriculumProgressEngine = api;
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
