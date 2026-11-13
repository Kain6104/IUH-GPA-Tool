(function (global) {
  'use strict';

  const Result = (typeof require !== 'undefined')
    ? require('../utils/result.js').Result
    : (global.IUHGPA && global.IUHGPA.utils ? global.IUHGPA.utils.Result : {
        ok: (data) => ({ ok: true, data, error: null }),
        err: (code, message) => ({ ok: false, data: null, error: { code, message } }),
      });

  const NumberParser = (typeof require !== 'undefined')
    ? require('../parsers/NumberParser.js')
    : (global.IUHGPA && global.IUHGPA.parsers && global.IUHGPA.parsers.NumberParser
        ? global.IUHGPA.parsers.NumberParser
        : (global.IUHGPA && global.IUHGPA.parsers && typeof global.IUHGPA.parsers.parseCredit === 'function'
            ? global.IUHGPA.parsers
            : (global._IUHNumberParser || {
                parseCredit: (raw) => {
                  const n = parseFloat(raw);
                  return isNaN(n) ? { status: 'missing', value: null } : { status: 'ok', value: n };
                },
                parseCredits: (raw) => {
                  const n = parseFloat(raw);
                  return isNaN(n) ? { status: 'missing', value: null } : { status: 'ok', value: n };
                }
              })));

  const ERROR_CODES = {
    ROOT_NOT_FOUND: 'ROOT_NOT_FOUND',
    TABLE_NOT_FOUND: 'TABLE_NOT_FOUND',
    MISSING_REQUIRED_COLUMNS: 'MISSING_REQUIRED_COLUMNS',
    MALFORMED_ROW: 'MALFORMED_ROW',
  };

  const CTK_SEMANTIC_KEYS = {
    ORDINAL: 'ctk_ordinal',
    COURSE_NAME: 'ctk_course_name',
    COURSE_CODE: 'ctk_course_code',
    PREREQUISITE: 'ctk_prerequisite',
    CREDITS: 'ctk_credits',
    THEORY_HOURS: 'ctk_theory_hours',
    PRACTICE_HOURS: 'ctk_practice_hours',
    ELECTIVE_GROUP: 'ctk_elective_group',
    ELECTIVE_GROUP_CREDITS: 'ctk_elective_group_credits',
    PASS: 'ctk_pass',
  };

  class IUHCurriculumAdapter {
    /**
     * Kiểm tra tính tương thích của trang hoặc detached document
     * @param {Document|Element} docOrRoot
     * @returns {{ compatible: boolean, code?: string, reason?: string, root?: Element, table?: HTMLTableElement }}
     */
    static isCompatiblePage(docOrRoot) {
      if (!docOrRoot) {
        return { compatible: false, code: ERROR_CODES.ROOT_NOT_FOUND, reason: 'Document hoặc root element không tồn tại' };
      }

      const root = docOrRoot.id === 'viewChuongTrinhKhung'
        ? docOrRoot
        : (docOrRoot.querySelector ? docOrRoot.querySelector('#viewChuongTrinhKhung') : null);

      if (!root) {
        return { compatible: false, code: ERROR_CODES.ROOT_NOT_FOUND, reason: 'Không tìm thấy container #viewChuongTrinhKhung' };
      }

      const table = root.querySelector('table');
      if (!table) {
        return { compatible: false, code: ERROR_CODES.TABLE_NOT_FOUND, reason: 'Không tìm thấy bảng Chương trình khung' };
      }

      return { compatible: true, root, table };
    }

    /**
     * Suy luận loại môn học từ số tiết LT/TH
     * @param {number|null} theoryHours
     * @param {number|null} practiceHours
     * @returns {'THEORY'|'PRACTICE'|'COMBINED'|'UNKNOWN'}
     */
    static inferCourseType(theoryHours, practiceHours) {
      if (typeof theoryHours !== 'number' || typeof practiceHours !== 'number') {
        return 'UNKNOWN';
      }
      if (theoryHours > 0 && practiceHours === 0) return 'THEORY';
      if (theoryHours === 0 && practiceHours > 0) return 'PRACTICE';
      if (theoryHours > 0 && practiceHours > 0) return 'COMBINED';
      return 'UNKNOWN';
    }

    /**
     * Phát hiện vị trí cột dựa trên semantic header attributes (lang="ctk-...")
     * @param {HTMLTableElement|Element} tableOrRoot
     * @returns {import('../utils/result.js').Result<Object.<string, number>>}
     */
    static detectColumns(tableOrRoot) {
      if (!tableOrRoot) {
        return Result.err(ERROR_CODES.TABLE_NOT_FOUND, 'Table không tồn tại');
      }

      const table = (tableOrRoot.tagName === 'TABLE')
        ? tableOrRoot
        : (tableOrRoot.querySelector ? tableOrRoot.querySelector('table') : null);

      if (!table) {
        return Result.err(ERROR_CODES.TABLE_NOT_FOUND, 'Không tìm thấy bảng');
      }

      const thead = table.querySelector('thead');
      if (!thead) {
        return Result.err(ERROR_CODES.TABLE_NOT_FOUND, 'Không tìm thấy thead');
      }

      const ths = Array.from(thead.querySelectorAll('th'));
      if (ths.length === 0) {
        return Result.err(ERROR_CODES.MISSING_REQUIRED_COLUMNS, 'Thead không có cột nào');
      }

      const map = {};

      ths.forEach((th, idx) => {
        const lang = (th.getAttribute('lang') || '').trim();
        const text = th.textContent.trim().toLowerCase().replace(/\s+/g, ' ');

        // 1. Semantic lang attributes (Highest Priority)
        if (lang === 'ctk-mahp') {
          map[CTK_SEMANTIC_KEYS.COURSE_CODE] = idx;
        } else if (lang === 'ctk-tenmhhp') {
          map[CTK_SEMANTIC_KEYS.COURSE_NAME] = idx;
        } else if (lang === 'ctk-stc') {
          map[CTK_SEMANTIC_KEYS.CREDITS] = idx;
        } else if (lang === 'ctk-sotietlt') {
          map[CTK_SEMANTIC_KEYS.THEORY_HOURS] = idx;
        } else if (lang === 'ctk-sotietth') {
          map[CTK_SEMANTIC_KEYS.PRACTICE_HOURS] = idx;
        } else if (lang === 'ctk-nhomtuchon') {
          map[CTK_SEMANTIC_KEYS.ELECTIVE_GROUP] = idx;
        } else if (lang === 'ctk-sotcnhombatbuoc') {
          map[CTK_SEMANTIC_KEYS.ELECTIVE_GROUP_CREDITS] = idx;
        } else if (lang === 'ctk-pass') {
          map[CTK_SEMANTIC_KEYS.PASS] = idx;
        }
        // 2. Text heuristics fallback (only if lang wasn't matched)
        else if (text.includes('mã học phần') || text.includes('mã hp')) {
          map[CTK_SEMANTIC_KEYS.COURSE_CODE] = idx;
        } else if (text.includes('tên môn') || text.includes('tên học phần')) {
          map[CTK_SEMANTIC_KEYS.COURSE_NAME] = idx;
        } else if (text.includes('số tc') || text === 'stc' || text === 'tc') {
          map[CTK_SEMANTIC_KEYS.CREDITS] = idx;
        } else if (text.includes('tiết lt') || text === 'lt') {
          map[CTK_SEMANTIC_KEYS.THEORY_HOURS] = idx;
        } else if (text.includes('tiết th') || text === 'th') {
          map[CTK_SEMANTIC_KEYS.PRACTICE_HOURS] = idx;
        } else if (text.includes('nhóm tự chọn')) {
          map[CTK_SEMANTIC_KEYS.ELECTIVE_GROUP] = idx;
        } else if (text.includes('bắt buộc của nhóm') || text.includes('tc bắt buộc')) {
          map[CTK_SEMANTIC_KEYS.ELECTIVE_GROUP_CREDITS] = idx;
        } else if (text === 'đạt' || text.includes('trạng thái')) {
          map[CTK_SEMANTIC_KEYS.PASS] = idx;
        }
      });

      // Convenience aliases
      map.codeIndex = map[CTK_SEMANTIC_KEYS.COURSE_CODE];
      map.nameIndex = map[CTK_SEMANTIC_KEYS.COURSE_NAME];
      map.creditsIndex = map[CTK_SEMANTIC_KEYS.CREDITS];
      map.theoryIndex = map[CTK_SEMANTIC_KEYS.THEORY_HOURS];
      map.practiceIndex = map[CTK_SEMANTIC_KEYS.PRACTICE_HOURS];
      map.electiveGroupIndex = map[CTK_SEMANTIC_KEYS.ELECTIVE_GROUP];
      map.electiveCreditsIndex = map[CTK_SEMANTIC_KEYS.ELECTIVE_GROUP_CREDITS];
      map.passIndex = map[CTK_SEMANTIC_KEYS.PASS];

      return Result.ok(map);
    }

    /**
     * Kiểm tra tính toàn vẹn cấu trúc của ColumnMap
     * @param {Object.<string, number>} columnMap
     * @returns {{ ok: boolean, valid: boolean, error?: string, data?: boolean }}
     */
    static validateStructure(columnMap) {
      if (!columnMap) return { ok: false, valid: false, error: 'ColumnMap không hợp lệ' };

      const required = [
        CTK_SEMANTIC_KEYS.COURSE_NAME,
        CTK_SEMANTIC_KEYS.COURSE_CODE,
        CTK_SEMANTIC_KEYS.CREDITS,
      ];

      const missing = required.filter(k => typeof columnMap[k] !== 'number');
      if (missing.length > 0) {
        return { ok: false, valid: false, error: `Thiếu các cột cốt lõi: ${missing.join(', ')}` };
      }

      return { ok: true, valid: true, data: true };
    }

    /**
     * Phân tích toàn bộ Chương trình khung thành CurriculumModel chuẩn hóa
     * @param {Document|Element} docOrRoot
     * @returns {import('../utils/result.js').Result<Object>}
     */
    static parseCurriculum(docOrRoot) {
      const comp = this.isCompatiblePage(docOrRoot);
      if (!comp.compatible) {
        return Result.err(comp.code || ERROR_CODES.ROOT_NOT_FOUND, comp.reason || 'Trang CTK không tương thích');
      }

      const table = comp.table;
      const colRes = this.detectColumns(table);
      if (!colRes.ok) return colRes;

      const columnMap = colRes.data;
      const validRes = this.validateStructure(columnMap);
      if (!validRes.ok) return validRes;

      let rows = Array.from(table.querySelectorAll('tbody > tr'));
      if (rows.length === 0) {
        rows = Array.from(table.querySelectorAll('tr'));
      }

      const semesters = [];
      const allCourses = [];
      const electiveGroupsMap = new Map();

      let currentSemester = null;
      let currentGroup = null;
      let currentSemesterIndex = 0;

      // Metadata totals
      let requiredCredits = null;
      let mandatoryCredits = null;
      let electiveCredits = null;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const text = row.textContent.trim().replace(/\s+/g, ' ');

        // 1. Kiểm tra dòng Header Học kỳ (row-head-hover hoặc text chứa "Học kỳ")
        if (row.classList.contains('row-head-hover') || (row.classList.contains('row-head') && /^học kỳ\s+\d+/i.test(text))) {
          currentSemesterIndex++;
          const semTd = row.querySelector('td:first-child');
          const semCreditsTd = row.querySelector('td:nth-child(2)');
          const label = semTd ? semTd.textContent.trim() : `Học kỳ ${currentSemesterIndex}`;
          const semReqCredits = semCreditsTd ? parseFloat(semCreditsTd.textContent.trim()) || 0 : 0;

          currentSemester = {
            curriculumIndex: currentSemesterIndex,
            label,
            requiredCredits: semReqCredits,
            groups: [],
            courses: [],
          };
          semesters.push(currentSemester);
          currentGroup = null;
          continue;
        }

        // 2. Kiểm tra dòng Tổng kết tín chỉ ở cuối bảng (Totals)
        if (text.startsWith('Tổng TC') || text.startsWith('Tổng số tín chỉ') || text.startsWith('Tổng số TC')) {
          const cells = Array.from(row.querySelectorAll('td'));
          const numCell = cells.find(td => /^\d+(\.\d+)?$/.test(td.textContent.trim()));
          const numVal = numCell ? parseFloat(numCell.textContent.trim()) : null;

          if (text.includes('yêu cầu')) {
            requiredCredits = numVal;
          } else if (text.includes('bắt buộc')) {
            mandatoryCredits = numVal;
          } else if (text.includes('tự chọn')) {
            electiveCredits = numVal;
          }
          continue;
        }

        // 3. Kiểm tra dòng phân nhóm (Bắt buộc / Tự chọn)
        const firstTd = row.querySelector('td:first-child');
        const isGroupRow = row.classList.contains('row-head') && firstTd && firstTd.getAttribute('colspan');
        if (isGroupRow) {
          const groupText = firstTd.textContent.trim();
          const secondTd = row.querySelector('td:nth-child(2)');
          const groupCredits = secondTd ? parseFloat(secondTd.textContent.trim()) || 0 : 0;

          if (/bắt buộc/i.test(groupText)) {
            currentGroup = {
              id: `mandatory_sem_${currentSemesterIndex}`,
              type: 'MANDATORY',
              name: groupText,
              label: groupText,
              groupName: groupText,
              requiredCredits: groupCredits,
              courses: [],
            };
          } else {
            // Nhóm tự chọn
            const groupNumMatch = groupText.match(/\d+/);
            const groupId = groupNumMatch ? `elective_${groupNumMatch[0]}` : `elective_sem_${currentSemesterIndex}_${(currentSemester?.groups || []).length + 1}`;
            const semLabel = currentSemester ? currentSemester.label : null;
            const fullLabel = semLabel ? `${groupText} (${semLabel})` : groupText;
            const currentGroupIndex = electiveGroupsMap.size + 1;
            const reqCr = (typeof groupCredits === 'number' && Number.isFinite(groupCredits)) ? groupCredits : 0;
            const groupStatus = reqCr > 0 ? 'VALID' : 'INCOMPATIBLE_GROUP';

            currentGroup = {
              id: groupId,
              type: 'ELECTIVE',
              name: fullLabel,
              label: fullLabel,
              groupName: fullLabel,
              groupIndex: currentGroupIndex,
              requiredCredits: reqCr,
              status: groupStatus,
              semesterIndex: currentSemesterIndex || null,
              semesterLabel: semLabel,
              courses: [],
            };
            if (!electiveGroupsMap.has(groupId)) {
              electiveGroupsMap.set(groupId, {
                id: groupId,
                name: fullLabel,
                label: fullLabel,
                groupName: fullLabel,
                groupIndex: currentGroupIndex,
                requiredCredits: reqCr,
                status: groupStatus,
                semesterIndex: currentSemesterIndex || null,
                semesterLabel: semLabel,
                courses: [],
              });
            }
          }

          if (currentSemester) {
            currentSemester.groups.push(currentGroup);
          }
          continue;
        }

        // 4. Bỏ qua các dòng trống ngăn cách (ví dụ tr có td colspan="10" rỗng)
        if (row.querySelector('td[colspan]') || row.children.length < 5) {
          continue;
        }

        // 5. Dòng môn học (Course Row)
        const courseRes = this.parseCourse(row, columnMap, currentSemester, currentGroup);
        if (courseRes.ok) {
          const course = courseRes.data;
          allCourses.push(course);
          if (currentSemester) {
            currentSemester.courses.push(course);
          }
          if (currentGroup) {
            currentGroup.courses.push(course);
          }
          if (course.electiveGroup && electiveGroupsMap.has(course.electiveGroup)) {
            electiveGroupsMap.get(course.electiveGroup).courses.push(course);
          }
        }
      }

      // Xây dựng CurriculumModel normalized — TUYỆT ĐỐI KHÔNG CHỨA PII
      const model = {
        semesters,
        courses: allCourses,
        totalCoursesCount: allCourses.length,
        requiredCredits,
        totalCredits: requiredCredits,
        mandatoryCredits,
        electiveCredits,
        totals: {
          totalRequiredCredits: requiredCredits,
          totalMandatoryCredits: mandatoryCredits,
          totalElectiveCredits: electiveCredits,
        },
        electiveGroups: Array.from(electiveGroupsMap.values()),
        metadata: {
          parsedAt: Date.now(),
          semesterCount: semesters.length,
          provenance: 'IUH_CURRICULUM_OFFICIAL_TABLE',
        }
      };

      return Result.ok(model);
    }

    /**
     * Phân tích một dòng môn học
     * @param {HTMLTableRowElement} row
     * @param {Object.<string, number>} columnMap
     * @param {Object|null} currentSemester
     * @param {Object|null} currentGroup
     * @returns {import('../utils/result.js').Result<Object>}
     */
    static parseCourse(row, columnMap, currentSemester, currentGroup) {
      const cells = Array.from(row.querySelectorAll(':scope > td'));

      const getCellText = (key) => {
        const idx = columnMap[key];
        if (typeof idx !== 'number' || idx >= cells.length) return '';
        const cell = cells[idx];
        const clone = cell.cloneNode(true);
        const dangerous = clone.querySelectorAll('script, style, svg, iframe, noscript');
        dangerous.forEach(d => d.remove());
        return clone.textContent.trim();
      };

      const rawName = getCellText(CTK_SEMANTIC_KEYS.COURSE_NAME);
      const code = getCellText(CTK_SEMANTIC_KEYS.COURSE_CODE);

      if (!code || !rawName) {
        return Result.err(ERROR_CODES.MALFORMED_ROW, 'Dòng môn học thiếu mã hoặc tên');
      }

      // Phát hiện dấu sao non-GPA: kết thúc bằng '*' hoặc có '*' trong chuỗi
      const hasAsterisk = rawName.includes('*');
      const cleanName = rawName.replace(/\*+$/, '').trim().replace(/\s+/g, ' ');

      const rawCreditText = getCellText(CTK_SEMANTIC_KEYS.CREDITS);
          const parseCreditFn = (NumberParser && typeof NumberParser.parseCredit === 'function')
            ? NumberParser.parseCredit
            : ((NumberParser && typeof NumberParser.parseCredits === 'function') ? NumberParser.parseCredits : null);
          const creditsParsed = parseCreditFn
            ? parseCreditFn(rawCreditText)
            : { status: 'invalid', value: null, raw: rawCreditText };
      const credits = creditsParsed.status === 'ok' ? creditsParsed.value : 0;

      const ltRaw = parseInt(getCellText(CTK_SEMANTIC_KEYS.THEORY_HOURS), 10);
      const theoryHours = isNaN(ltRaw) ? 0 : ltRaw;

      const thRaw = parseInt(getCellText(CTK_SEMANTIC_KEYS.PRACTICE_HOURS), 10);
      const practiceHours = isNaN(thRaw) ? 0 : thRaw;

      // Nhóm tự chọn
      const electiveGroupStr = getCellText(CTK_SEMANTIC_KEYS.ELECTIVE_GROUP);
      const electiveGroupReqCreditsStr = getCellText(CTK_SEMANTIC_KEYS.ELECTIVE_GROUP_CREDITS);

      let requirementType = 'MANDATORY';
      let electiveGroup = null;
      let electiveGroupRequiredCredits = null;

      if (currentGroup && currentGroup.type === 'ELECTIVE') {
        requirementType = 'ELECTIVE';
        electiveGroup = currentGroup.id;
        electiveGroupRequiredCredits = currentGroup.requiredCredits;
      } else if (electiveGroupStr && electiveGroupStr !== '0' && electiveGroupStr !== '') {
        requirementType = 'ELECTIVE';
        electiveGroup = `elective_${electiveGroupStr}`;
        const reqCr = parseFloat(electiveGroupReqCreditsStr);
        electiveGroupRequiredCredits = !isNaN(reqCr) ? reqCr : null;
      }

      // Trạng thái đã học / chưa đăng ký
      // class colorSTLichHoc là chỉ thị sinh viên đã học/đã đăng ký lịch
      const hasStudiedClass = row.classList.contains('colorSTLichHoc');
      const studiedState = hasStudiedClass ? 'STUDIED' : 'UNREGISTERED';

      // Trạng thái đạt (passState)
      const passCellIdx = columnMap[CTK_SEMANTIC_KEYS.PASS];
      const passCell = typeof passCellIdx === 'number' && passCellIdx < cells.length ? cells[passCellIdx] : null;
      const hasCheckDiv = passCell ? (Boolean(passCell.querySelector('.check')) || passCell.textContent.trim().toLowerCase() === 'đạt') : false;
      const passState = hasCheckDiv ? 'PASS' : 'PENDING';

      // Quyết định tính GPA tích lũy: dấu * quyết định rõ ràng
      const countsTowardCumulativeGPA = !hasAsterisk && credits > 0;
      const gpaProvenance = hasAsterisk
        ? 'CURRICULUM_EXPLICIT_NON_GPA'
        : (credits === 0 ? 'CREDITS_ZERO' : 'CURRICULUM_ELIGIBLE');

      // Suy luận loại môn học từ số tiết LT/TH
      const inferredCourseType = this.inferCourseType(theoryHours, practiceHours);

      const curSemLabel = currentSemester ? currentSemester.label : null;
      const curSemIdx = (currentSemester && typeof currentSemester.curriculumIndex === 'number') ? currentSemester.curriculumIndex : null;

      const course = {
        code,
        curriculumCourseCode: code,
        name: cleanName,
        courseName: cleanName,
        rawName,
        hasAsterisk,
        credits,
        theoryHours,
        practiceHours,
        curriculumSemester: curSemLabel,
        curriculumSemesterIndex: curSemIdx,
        semesterStatus: curSemLabel ? 'RESOLVED' : 'UNRESOLVED_SEMESTER',
        requirementType,
        electiveGroup,
        electiveGroupId: electiveGroup,
        electiveGroupName: currentGroup && currentGroup.type === 'ELECTIVE'
          ? (currentGroup.name || currentGroup.label || currentGroup.groupName)
          : (electiveGroup ? (electiveGroup.startsWith('elective_') ? `Nhóm tự chọn ${electiveGroup.replace('elective_', '')}` : `Nhóm tự chọn ${electiveGroup}`) : null),
        electiveGroupRequiredCredits,
        studiedState,
        studiedMarker: hasStudiedClass,
        passState,
        passedMarker: hasCheckDiv,
        countsTowardCumulativeGPA,
        inferredCourseType,
        provenance: gpaProvenance,
        detailedProvenance: {
          gpaEligibility: gpaProvenance,
          courseType: 'CURRICULUM_LT_TH',
          status: 'CURRICULUM_STATUS'
        }
      };

      return Result.ok(course);
    }
  }

  IUHCurriculumAdapter.ERROR_CODES = ERROR_CODES;
  IUHCurriculumAdapter.CTK_SEMANTIC_KEYS = CTK_SEMANTIC_KEYS;

  const api = {
    IUHCurriculumAdapter,
    ERROR_CODES,
    CTK_SEMANTIC_KEYS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.adapters = root.adapters || Object.create(null);
    root.adapters.IUHCurriculumAdapter = IUHCurriculumAdapter;
    global._IUHCurriculumAdapter = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
