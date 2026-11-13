(function (global) {
  'use strict';

  const Result = (typeof require !== 'undefined')
    ? require('../utils/result.js').Result
    : (global.IUHGPA && global.IUHGPA.utils && global.IUHGPA.utils.Result
        ? global.IUHGPA.utils.Result
        : (global._IUHResult ? global._IUHResult.Result : null));

  const Parsed = (typeof require !== 'undefined')
    ? require('../utils/result.js').Parsed
    : (global.IUHGPA && global.IUHGPA.utils && global.IUHGPA.utils.Parsed
        ? global.IUHGPA.utils.Parsed
        : (global._IUHResult ? global._IUHResult.Parsed : null));

  const HeaderGridParser = (typeof require !== 'undefined')
    ? require('../parsers/HeaderGridParser.js').HeaderGridParser
    : (global.IUHGPA && global.IUHGPA.parsers && global.IUHGPA.parsers.HeaderGridParser
        ? global.IUHGPA.parsers.HeaderGridParser
        : (global._IUHHeaderGridParser ? global._IUHHeaderGridParser.HeaderGridParser : null));

  const SEMANTIC_KEYS = (typeof require !== 'undefined')
    ? require('../parsers/HeaderGridParser.js').SEMANTIC_KEYS
    : (global.IUHGPA && global.IUHGPA.parsers && global.IUHGPA.parsers.SEMANTIC_KEYS
        ? global.IUHGPA.parsers.SEMANTIC_KEYS
        : (global._IUHHeaderGridParser ? global._IUHHeaderGridParser.SEMANTIC_KEYS : null));

  const numParser = (typeof require !== 'undefined')
    ? require('../parsers/NumberParser.js')
    : (global.IUHGPA && global.IUHGPA.parsers && global.IUHGPA.parsers.NumberParser
        ? global.IUHGPA.parsers.NumberParser
        : (global._IUHNumberParser ? global._IUHNumberParser : {}));

  const parseScore = numParser.parseScore;
  const parseCredits = numParser.parseCredits;
  const parseScore4 = numParser.parseScore4;

/**
 * Metadata lỗi / mã tương thích an toàn (không chứa PII)
 */
const ERROR_CODES = {
  NOT_IUH_GRADE_PAGE: 'ERR_NOT_IUH_GRADE_PAGE',
  TABLE_NOT_FOUND: 'ERR_TABLE_NOT_FOUND',
  THEAD_NOT_FOUND: 'ERR_THEAD_NOT_FOUND',
  HEADER_PARSE_FAILED: 'ERR_HEADER_PARSE_FAILED',
  MISSING_REQUIRED_COLUMNS: 'ERR_MISSING_REQUIRED_COLUMNS',
  MALFORMED_DOM: 'ERR_MALFORMED_DOM',
};

const SUMMARY_LANG_KEYS = {
  gpa10: 'kqht-tkhk-diemtbhocluc',
  gpa4: 'kqht-tkhk-diemtbtinchi',
  cumulativeGpa10: 'kqht-tkhk-diemtbhocluctichluy',
  cumulativeGpa4: 'kqht-tkhk-diemtbtinchitichluy',
  registeredCredits: 'kqht-tkhk-tongsotcdangky',
  cumulativeCredits: 'kqht-tkhk-sotctichluy',
  earnedCreditsSemester: 'kqht-tkhk-stcdathocky',
  failedCreditsSemester: 'kqht-tkhk-sotckhongdat',
  cumulativeClassification: 'kqht-tkhk-xeploaihocluctichluy',
  semesterClassification: 'kqht-tkhk-xeploaihocluc',
};

class IUHPageAdapter {
  /**
   * Kiểm tra xem document có phải là trang Xem Điểm IUH tương thích hay không.
   * @param {Document} doc
   * @returns {{ compatible: boolean, reason?: string, code?: string, table?: Element }}
   */
  static isCompatiblePage(doc) {
    if (!doc) {
      return { compatible: false, code: ERROR_CODES.NOT_IUH_GRADE_PAGE, reason: 'Document is null or undefined' };
    }

    const table = doc.querySelector('table#xemDiem_aaa') || doc.querySelector('table.table-custom');
    if (!table) {
      return { compatible: false, code: ERROR_CODES.TABLE_NOT_FOUND, reason: 'Không tìm thấy bảng điểm (#xemDiem_aaa)' };
    }

    const thead = table.querySelector('thead');
    if (!thead) {
      return { compatible: false, code: ERROR_CODES.THEAD_NOT_FOUND, reason: 'Bảng điểm không có phần thead' };
    }

    // Kiểm tra tối thiểu 3 marker quan trọng trong thead: Mã môn, Tên môn, Điểm tổng kết
    const hasCode = thead.querySelector('[lang="kqht-malhp"]');
    const hasName = thead.querySelector('[lang="kqht-tenlhp"]');
    const hasTotal = thead.querySelector('[lang="kqht-qucd-row_1_10"]');

    if (!hasCode || !hasName || !hasTotal) {
      return {
        compatible: false,
        code: ERROR_CODES.HEADER_PARSE_FAILED,
        reason: 'Thead thiếu các cột bắt buộc của IUH (kqht-malhp, kqht-tenlhp, kqht-qucd-row_1_10)'
      };
    }

    return { compatible: true, table };
  }

  /**
   * Phân tích và trích xuất ColumnMap từ thead.
   * @param {HTMLTableElement} table
   * @returns {import('../utils/result.js').Result<Object.<string, number>>}
   */
  static detectColumns(table) {
    const thead = table ? table.querySelector('thead') : null;
    if (!thead) {
      return Result.err(ERROR_CODES.THEAD_NOT_FOUND, 'Không tìm thấy thead trong table');
    }

    const gridResult = HeaderGridParser.parse(thead);
    if (!gridResult.ok) {
      return gridResult;
    }

    const map = HeaderGridParser.buildColumnMap(gridResult.data);
    return Result.ok(map);
  }

  /**
   * Kiểm tra tính toàn vẹn của ColumnMap
   * @param {Object.<string, number>} columnMap
   * @returns {import('../utils/result.js').Result<boolean>}
   */
  static validateStructure(columnMap) {
    const required = [
      SEMANTIC_KEYS.ORDINAL,
      SEMANTIC_KEYS.COURSE_CODE,
      SEMANTIC_KEYS.COURSE_NAME,
      SEMANTIC_KEYS.CREDITS,
      SEMANTIC_KEYS.TOTAL_10,
    ];

    const missing = required.filter(k => typeof columnMap[k] !== 'number');
    if (missing.length > 0) {
      return Result.err(
        ERROR_CODES.MISSING_REQUIRED_COLUMNS,
        `Thiếu cột cốt lõi: ${missing.join(', ')}`
      );
    }
    return Result.ok(true);
  }

  /**
   * Parse toàn bộ học kỳ từ table
   * @param {HTMLTableElement} table
   * @param {Object.<string, number>} columnMap
   * @returns {import('../utils/result.js').Result<Array<Object>>}
   */
  static parseSemesters(table, columnMap) {
    if (!table) return Result.err(ERROR_CODES.TABLE_NOT_FOUND, 'Table không tồn tại');

    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll(':scope > tr'));

    const semesters = [];
    let currentSemester = null;
    let occurrenceCounter = new Map();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Bỏ qua tất cả các hàng do Extension thêm vào
      if (row.classList.contains('iuh-gpa-extension') || row.hasAttribute('data-iuh-gpa-extension')) {
        continue;
      }

      // 1. Kiểm tra dòng Header của Học kỳ: <td class="text-start row-head"> hoặc chứa text HK...
      const semCell = row.querySelector(':scope > td.row-head');
      if (semCell) {
        const rawLabel = semCell.textContent.trim();
        const semKey = this._extractSemesterKey(rawLabel);
        
        currentSemester = {
          semesterKey: semKey,
          semesterName: rawLabel,
          courses: [],
          summary: null,
          isOfficial: true,
        };
        semesters.push(currentSemester);
        occurrenceCounter.clear();
        continue;
      }

      // 2. Kiểm tra dòng Môn học: nhận diện an toàn dựa trên title của các ô điểm
      if (this._isCourseRow(row)) {
        if (!currentSemester) {
          // Trường hợp không có header kỳ trước đó, tạo fallback semester
          currentSemester = {
            semesterKey: 'SEM_UNKNOWN',
            semesterName: 'Học kỳ chưa xác định',
            courses: [],
            summary: null,
            isOfficial: false,
          };
          semesters.push(currentSemester);
        }

        const courseRes = this.parseCourse(row, columnMap, currentSemester.semesterKey, occurrenceCounter);
        if (courseRes.ok) {
          currentSemester.courses.push(courseRes.data);
        }
        continue;
      }

      // 3. Kiểm tra dòng Summary (tổng kết học kỳ)
      if (this._isSummaryRow(row)) {
        if (currentSemester) {
          if (!currentSemester.summary) {
            currentSemester.summary = {};
          }
          this._mergeSummaryRow(row, currentSemester.summary);
        }
        continue;
      }
    }

    return Result.ok(semesters);
  }

  /**
   * Parse 1 dòng môn học thành CourseOriginal
   * @param {HTMLTableRowElement} row
   * @param {Object.<string, number>} columnMap
   * @param {string} semesterKey
   * @param {Map<string, number>} occurrenceCounter
   * @returns {import('../utils/result.js').Result<Object>}
   */
  static parseCourse(row, columnMap, semesterKey, occurrenceCounter) {
    const cells = Array.from(row.querySelectorAll(':scope > td:not(.iuh-gpa-extension):not([data-iuh-gpa-extension])'));

    const getCellByCol = (key) => {
      const idx = columnMap[key];
      return (typeof idx === 'number' && idx < cells.length) ? cells[idx] : null;
    };

    const extractOfficialText = (cell) => {
      if (!cell) return '';
      const parts = [];
      for (const node of cell.childNodes) {
        if (node.nodeType === 3) {
          parts.push(node.textContent);
        } else if (node.nodeType === 1 && !node.classList?.contains('iuh-gpa-extension') && !node.hasAttribute?.('data-iuh-gpa-extension')) {
          parts.push(node.textContent);
        }
      }
      return parts.join('').trim();
    };

    const getCellText = (key) => {
      const cell = getCellByCol(key);
      return extractOfficialText(cell);
    };

    const getTitleCellText = (titleAttr, fallbackKey) => {
      const cell = row.querySelector(`:scope > td[title="${titleAttr}"]`);
      if (cell) return extractOfficialText(cell);
      return getCellText(fallbackKey);
    };

    const courseClassCode = getCellText(SEMANTIC_KEYS.COURSE_CODE);
    const courseName = getCellText(SEMANTIC_KEYS.COURSE_NAME);
    const ordinal = getCellText(SEMANTIC_KEYS.ORDINAL);
    const creditsParsed = parseCredits(getCellText(SEMANTIC_KEYS.CREDITS));

    // Đếm occurrenceIndex cho retake/duplicate trong cùng 1 kỳ
    const baseId = `${semesterKey}_${courseClassCode || 'UNKNOWN'}`;
    const occ = (occurrenceCounter.get(baseId) || 0) + 1;
    occurrenceCounter.set(baseId, occ);
    const id = `${baseId}_${occ}`;

    // Assessments
    const midterm = parseScore(getTitleCellText('DiemChuyenCan1', SEMANTIC_KEYS.MIDTERM));

    const regular = [
      { slot: 1, sourceField: 'DiemHeSo11', value: parseScore(getTitleCellText('DiemHeSo11', SEMANTIC_KEYS.REGULAR_1)) },
      { slot: 2, sourceField: 'DiemHeSo12', value: parseScore(getTitleCellText('DiemHeSo12', SEMANTIC_KEYS.REGULAR_2)) },
      { slot: 3, sourceField: 'DiemHeSo13', value: parseScore(getTitleCellText('DiemHeSo13', SEMANTIC_KEYS.REGULAR_3)) },
      { slot: 4, sourceField: 'DiemHeSo14', value: parseScore(getTitleCellText('DiemHeSo14', SEMANTIC_KEYS.REGULAR_4)) },
      { slot: 5, sourceField: 'DiemHeSo15', value: parseScore(getTitleCellText('DiemHeSo15', SEMANTIC_KEYS.REGULAR_5)) },
      { slot: 6, sourceField: 'DiemThuongKy6', value: parseScore(getTitleCellText('DiemThuongKy6', SEMANTIC_KEYS.REGULAR_6)) },
      { slot: 7, sourceField: 'DiemThuongKy7', value: parseScore(getTitleCellText('DiemThuongKy7', SEMANTIC_KEYS.REGULAR_7)) },
      { slot: 8, sourceField: 'DiemThuongKy8', value: parseScore(getTitleCellText('DiemThuongKy8', SEMANTIC_KEYS.REGULAR_8)) },
      { slot: 9, sourceField: 'DiemThuongKy9', value: parseScore(getTitleCellText('DiemThuongKy9', SEMANTIC_KEYS.REGULAR_9)) },
    ];

    const practice = [
      { slot: 1, sourceField: 'DiemThucHanh1', value: parseScore(getTitleCellText('DiemThucHanh1', SEMANTIC_KEYS.PRACTICE_1)) },
      { slot: 2, sourceField: 'DiemThucHanh2', value: parseScore(getTitleCellText('DiemThucHanh2', SEMANTIC_KEYS.PRACTICE_2)) },
      { slot: 3, sourceField: 'DiemThucHanh3', value: parseScore(getTitleCellText('DiemThucHanh3', SEMANTIC_KEYS.PRACTICE_3)) },
      { slot: 4, sourceField: 'DiemThucHanh4', value: parseScore(getTitleCellText('DiemThucHanh4', SEMANTIC_KEYS.PRACTICE_4)) },
      { slot: 5, sourceField: 'DiemThucHanh5', value: parseScore(getTitleCellText('DiemThucHanh5', SEMANTIC_KEYS.PRACTICE_5)) },
    ];

    const finalExam = parseScore(getTitleCellText('DiemThi', SEMANTIC_KEYS.FINAL_EXAM));

    // Official Result
    const total10 = parseScore(getTitleCellText('DiemTongKet', SEMANTIC_KEYS.TOTAL_10));
    const score4 = parseScore4(getTitleCellText('DiemTinChi', SEMANTIC_KEYS.GRADE_POINT));
    const letter = getTitleCellText('DiemChu', SEMANTIC_KEYS.LETTER_GRADE);
    const classification = getTitleCellText('XepLoai', SEMANTIC_KEYS.CLASSIFICATION);
    const note = getTitleCellText('GhiChu', SEMANTIC_KEYS.NOTE);

    // Kiểm tra dấu đạt (.check trong cell isdat)
    const isDatCell = getCellByCol(SEMANTIC_KEYS.IS_PASSED);
    const hasCheckIcon = isDatCell ? Boolean(isDatCell.querySelector('.check')) : false;

    const course = {
      id,
      semesterKey,
      occurrenceIndex: occ,
      ordinal: ordinal ? parseInt(ordinal, 10) || null : null,
      courseClassCode,
      courseName,
      credits: creditsParsed,
      assessments: {
        midterm,
        regular,
        practice,
        finalExam,
      },
      officialResult: {
        total10,
        score4,
        letter,
        classification,
        note,
        passed: hasCheckIcon || (total10.status === 'ok' && total10.value >= 4.0),
      },
      provenance: 'iuh-dom'
    };

    return Result.ok(course);
  }

  /**
   * Nhận diện dòng môn học an toàn (dựa trên các thuộc tính title chuẩn của IUH)
   * @private
   */
  static _isCourseRow(row) {
    return Boolean(
      row.querySelector(':scope > td[title="DiemTongKet"]') &&
      row.querySelector(':scope > td[title="DiemThi"]') &&
      row.querySelector(':scope > td[title="DiemTinChi"]')
    );
  }

  /**
   * Nhận diện dòng summary tổng kết
   * @private
   */
  static _isSummaryRow(row) {
    return Boolean(row.querySelector('[lang^="kqht-tkhk-"]'));
  }

  /**
   * Trích xuất các giá trị summary từ 1 dòng tổng kết
   * @private
   */
  static _mergeSummaryRow(row, summaryObj) {
    for (const [key, lang] of Object.entries(SUMMARY_LANG_KEYS)) {
      const labelEl = row.querySelector(`[lang="${lang}"]`);
      if (labelEl) {
        // Giá trị thường nằm ở sibling span ngay sau label hoặc cell text
        let valText = '';
        const sibling = labelEl.nextElementSibling;
        if (sibling && sibling.tagName.toLowerCase() === 'span') {
          valText = sibling.textContent.trim();
        } else if (labelEl.parentElement) {
          // Lấy text content sau label
          const parentClone = labelEl.parentElement.cloneNode(true);
          const lblInClone = parentClone.querySelector(`[lang="${lang}"]`);
          if (lblInClone) lblInClone.remove();
          valText = parentClone.textContent.trim();
        }

        if (key.includes('Gpa') || key.includes('gpa')) {
          summaryObj[key] = parseScore(valText);
        } else if (key.includes('Credits')) {
          summaryObj[key] = parseCredits(valText);
        } else {
          summaryObj[key] = valText;
        }
      }
    }
  }

  /**
   * Tạo semantic semesterKey an toàn từ chuỗi (ví dụ: "HK1 (2020 - 2021)" -> "HK1_2020_2021")
   * @private
   */
  static _extractSemesterKey(rawText) {
    if (!rawText) return 'SEM_UNKNOWN';
    const cleaned = rawText
      .replace(/[()]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '');
    return cleaned || 'SEM_UNKNOWN';
  }
}

  const api = {
    IUHPageAdapter,
    ERROR_CODES,
    SUMMARY_LANG_KEYS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.adapters = root.adapters || Object.create(null);
    root.adapters.IUHPageAdapter = IUHPageAdapter;
    root.adapters.ERROR_CODES = ERROR_CODES;
    root.adapters.SUMMARY_LANG_KEYS = SUMMARY_LANG_KEYS;
    global._IUHPageAdapter = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
