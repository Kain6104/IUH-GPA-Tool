(function (global) {
  'use strict';

  const Result = (typeof require !== 'undefined')
    ? require('../utils/result.js').Result
    : (global.IUHGPA && global.IUHGPA.utils && global.IUHGPA.utils.Result
        ? global.IUHGPA.utils.Result
        : (global._IUHResult ? global._IUHResult.Result : null));

/**
 * @typedef {Object} ColumnDescriptor
 * @property {number}   logicalIndex   — 0-based
 * @property {string[]} headerPath     — text labels từ tầng cao xuống tầng lá
 * @property {string|null} semanticKey — mapped từ lang attribute (ví dụ 'kqht-stc')
 * @property {'lang'|'inferred'} source — cách xác định cột này
 */

/**
 * Mapping từ lang attribute của th → semanticKey của column.
 * Nguồn: IUH_PAGE_RESEARCH.md §3.
 */
const LANG_TO_SEMANTIC = {
  'kqht-stt':                 'ordinal',
  'kqht-malhp':               'courseClassCode',
  'kqht-tenlhp':              'courseName',
  'kqht-stc':                 'credits',
  'kqht-qucd-row_1_2':        'midterm',        // DiemChuyenCan1
  'kqht-qucd-diemheso11':     'regular1',
  'kqht-qucd-diemheso12':     'regular2',
  'kqht-qucd-diemheso13':     'regular3',
  'kqht-qucd-diemheso14':     'regular4',
  'kqht-qucd-diemheso15':     'regular5',
  'kqht-qucd-diemthuongky6':  'regular6',
  'kqht-qucd-diemthuongky7':  'regular7',
  'kqht-qucd-diemthuongky8':  'regular8',
  'kqht-qucd-diemthuongky9':  'regular9',
  'kqht-qucd-diemthuchanh1':  'practice1',
  'kqht-qucd-diemthuchanh2':  'practice2',
  'kqht-qucd-diemthuchanh3':  'practice3',
  'kqht-qucd-diemthuchanh4':  'practice4',
  'kqht-qucd-diemthuchanh5':  'practice5',
  'kqht-qucd-row_1_8':        'finalExam',      // DiemThi
  'kqht-qucd-row_1_10':       'total10',        // DiemTongKet
  'kqht-qucd-diemtinchi':     'gradePoint',     // DiemTinChi (hệ 4)
  'kqht-qucd-diemchu':        'letterGrade',    // DiemChu
  'kqht-qucd-xeploai':        'classification', // XepLoai
  'kqht-qucd-ghichu':         'note',           // GhiChu
  'kqht-qucd-diemtbquatrinh': 'processAverage', // DiemTBQuaTrinh
  'kqht-qucd-isdat':          'passed',         // cột Đạt
};

/** Số cột logic kỳ vọng theo snapshot IUH_PAGE_RESEARCH.md */
const EXPECTED_LEAF_COUNT = 27;

/**
 * Build header grid từ thead rows.
 *
 * @param {NodeList|Element[]} headerRows — các tr trong thead
 * @returns {Result<ColumnDescriptor[]>}
 */
function buildHeaderGrid(headerRowsOrThead) {
  if (!headerRowsOrThead) {
    return Result.fail('HEADER_NO_ROWS', 'No header elements provided');
  }

  const rows = (typeof headerRowsOrThead.querySelectorAll === 'function')
    ? (headerRowsOrThead.tagName && headerRowsOrThead.tagName.toLowerCase() === 'tr'
        ? [headerRowsOrThead]
        : Array.from(headerRowsOrThead.querySelectorAll(':scope > tr, tr')))
    : Array.from(headerRowsOrThead);

  if (rows.length === 0) {
    return Result.fail('HEADER_NO_ROWS', 'thead has no tr elements');
  }

  const numRows = rows.length;

  // occupancy[row][col] = true nếu ô đó đã bị chiếm bởi rowspan/colspan
  // Dùng mảng 2D động — mở rộng theo colspan
  const occupied = Array.from({ length: numRows }, () => ({}));

  // Thông tin leaf columns, indexed by logical col
  /** @type {Map<number, {lang: string|null, texts: string[], rowIdx: number}>} */
  const leafMap = new Map();

  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const cells = Array.from(rows[rowIdx].querySelectorAll(':scope > th:not(.iuh-gpa-extension):not([data-iuh-gpa-extension])'));
    let colCursor = 0;

    for (const cell of cells) {
      // Tìm cột logic tiếp theo không bị chiếm
      while (occupied[rowIdx][colCursor]) colCursor++;

      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
      const langAttr = cell.getAttribute('lang') || null;

      // Đánh dấu vùng bị chiếm
      for (let r = rowIdx; r < Math.min(rowIdx + rowspan, numRows); r++) {
        for (let c = colCursor; c < colCursor + colspan; c++) {
          occupied[r][c] = true;
        }
      }

      // Cell là leaf nếu:
      //   - Span xuống đến dòng cuối (rowspan đủ để cover), VÀ
      //   - colspan = 1 (không group)
      // Hoặc có lang attribute (IUH semantic marker) – đây là chỉ báo đáng tin cậy nhất
      const coversToEnd = (rowIdx + rowspan) >= numRows;
      const isLeaf = coversToEnd && colspan === 1;

      if (isLeaf) {
        const text = (cell.textContent || '').trim();
        leafMap.set(colCursor, { lang: langAttr, text, rowIdx });
      }

      colCursor += colspan;
    }
  }

  if (leafMap.size === 0) {
    return Result.fail('HEADER_NO_LEAF_COLS', 'Could not identify any leaf columns from header');
  }

  // Build ColumnDescriptor array, sorted by logical index
  const sortedIndices = Array.from(leafMap.keys()).sort((a, b) => a - b);

  /** @type {ColumnDescriptor[]} */
  const columns = sortedIndices.map((logicalIndex, i) => {
    const info = leafMap.get(logicalIndex);
    const semanticKey = info.lang ? (LANG_TO_SEMANTIC[info.lang] || null) : null;
    return {
      logicalIndex,
      headerPath: [info.text], // simplified: chỉ giữ text của leaf cell
      semanticKey,
      source: info.lang ? 'lang' : 'inferred',
      _lang: info.lang,       // giữ để debug
    };
  });

  // Validate số lượng cột
  if (columns.length !== EXPECTED_LEAF_COUNT) {
    return Result.fail(
      'HEADER_COLUMN_COUNT_MISMATCH',
      `Expected ${EXPECTED_LEAF_COUNT} leaf columns, got ${columns.length}`
    );
  }

  // Validate: không có hai cột cùng semanticKey (ngoại trừ null)
  const semanticSet = new Set();
  for (const col of columns) {
    if (col.semanticKey !== null) {
      if (semanticSet.has(col.semanticKey)) {
        return Result.fail(
          'HEADER_DUPLICATE_SEMANTIC_KEY',
          `Duplicate semantic key: ${col.semanticKey}`
        );
      }
      semanticSet.add(col.semanticKey);
    }
  }

  return Result.ok(columns);
}

/**
 * Tìm logical index của một semanticKey trong columns.
 *
 * @param {ColumnDescriptor[]} columns
 * @param {string} semanticKey
 * @returns {number|null}
 */
function findColumnIndex(columns, semanticKey) {
  const col = columns.find(c => c.semanticKey === semanticKey);
  return col ? col.logicalIndex : null;
}

/**
 * Build nhanh một map: semanticKey → logicalIndex
 *
 * @param {ColumnDescriptor[]} columns
 * @returns {Object<string, number>}
 */
function buildSemanticIndexMap(columns) {
  const map = {};
  for (const col of columns) {
    if (col.semanticKey) map[col.semanticKey] = col.logicalIndex;
  }
  return map;
}

const SEMANTIC_KEYS = {
  ORDINAL: 'ordinal',
  COURSE_CODE: 'courseClassCode',
  COURSE_NAME: 'courseName',
  CREDITS: 'credits',
  MIDTERM: 'midterm',
  REGULAR_1: 'regular1',
  REGULAR_2: 'regular2',
  REGULAR_3: 'regular3',
  REGULAR_4: 'regular4',
  REGULAR_5: 'regular5',
  REGULAR_6: 'regular6',
  REGULAR_7: 'regular7',
  REGULAR_8: 'regular8',
  REGULAR_9: 'regular9',
  PRACTICE_1: 'practice1',
  PRACTICE_2: 'practice2',
  PRACTICE_3: 'practice3',
  PRACTICE_4: 'practice4',
  PRACTICE_5: 'practice5',
  FINAL_EXAM: 'finalExam',
  TOTAL_10: 'total10',
  GRADE_POINT: 'gradePoint',
  LETTER_GRADE: 'letterGrade',
  CLASSIFICATION: 'classification',
  NOTE: 'note',
  PROCESS_AVERAGE: 'processAverage',
  IS_PASSED: 'passed',
};

const HeaderGridParser = {
  parse: buildHeaderGrid,
  buildColumnMap: buildSemanticIndexMap,
  findColumnIndex,
  EXPECTED_LEAF_COUNT,
  LANG_TO_SEMANTIC,
  SEMANTIC_KEYS,
};

  const api = {
    HeaderGridParser,
    SEMANTIC_KEYS,
    buildHeaderGrid,
    findColumnIndex,
    buildSemanticIndexMap,
    LANG_TO_SEMANTIC,
    EXPECTED_LEAF_COUNT,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.parsers = root.parsers || Object.create(null);
    root.parsers.HeaderGridParser = HeaderGridParser;
    root.parsers.SEMANTIC_KEYS = SEMANTIC_KEYS;
    global._IUHHeaderGridParser = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

