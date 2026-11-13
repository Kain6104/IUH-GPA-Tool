(function (global) {
  'use strict';

  const Parsed = (typeof require !== 'undefined')
    ? require('../utils/result.js').Parsed
    : (global.IUHGPA && global.IUHGPA.utils && global.IUHGPA.utils.Parsed
        ? global.IUHGPA.utils.Parsed
        : (global._IUHResult ? global._IUHResult.Parsed : null));

/**
 * Các chuỗi được coi là MISSING (không phải 0).
 * Bổ sung thêm nếu phát hiện representation khác trong HTML thực tế.
 */
const MISSING_STRINGS = new Set([
  '',
  '-',
  '--',
  '---',
  'n/a',
  'na',
  'chua co',
  'chua có',
  'chưa có',
  'chưa có điểm',
]);

/**
 * Regex nhận điểm hợp lệ trong khoảng [0, 10]:
 *   - "10" hoặc "10,0" hoặc "10.0" hoặc "10.00"
 *   - "0" đến "9.99..." với bất kỳ số lẻ thập phân
 *   - Cho phép tiền tố/hậu tố khoảng trắng (sẽ được trim trước)
 *
 * Pattern: ^(10(?:[,\.][0]+)?|\d(?:[,\.]\d+)?)$
 */
const SCORE_RE = /^(10(?:[,.][0]+)?|(?:[0-9])(?:[,.]\d+)?)$/;

/**
 * Regex cho tín chỉ (số nguyên không âm, bao gồm 0).
 */
const CREDIT_RE = /^\d+$/;

/**
 * Parse một chuỗi thành ParsedNumber score (thang [0, 10]).
 *
 * @param {string|null|undefined} raw
 * @returns {import('../utils/result.js').ParsedNumber}
 *
 * @example
 * parseScore('7,5')   → { status:'ok', value:7.5, raw:'7,5' }
 * parseScore('0')     → { status:'ok', value:0,   raw:'0' }
 * parseScore('')      → { status:'missing', value:null, raw:'' }
 * parseScore('--')    → { status:'missing', value:null, raw:'--' }
 * parseScore('abc')   → { status:'invalid', value:null, raw:'abc' }
 * parseScore('10.1')  → { status:'invalid', value:null, raw:'10.1' }
 * parseScore('-1')    → { status:'invalid', value:null, raw:'-1' }
 * parseScore(null)    → { status:'missing', value:null, raw:'' }
 */
function parseScore(raw) {
  if (raw === null || raw === undefined) return Parsed.missing('');

  const trimmed = String(raw).trim();

  // Kiểm tra missing
  if (MISSING_STRINGS.has(trimmed.toLowerCase())) {
    return Parsed.missing(trimmed);
  }

  // Normalize comma → dot
  const normalized = trimmed.replace(',', '.');

  // Validate format
  if (!SCORE_RE.test(trimmed)) {
    return Parsed.invalid(trimmed);
  }

  const num = Number(normalized);

  // Kiểm tra range [0, 10]
  if (!isFinite(num) || isNaN(num) || num < 0 || num > 10) {
    return Parsed.invalid(trimmed);
  }

  return Parsed.ok(num, trimmed);
}

/**
 * Parse một chuỗi thành số tín chỉ (số nguyên không âm).
 *
 * @param {string|null|undefined} raw
 * @returns {import('../utils/result.js').ParsedNumber}
 *
 * @example
 * parseCredit('3')  → { status:'ok', value:3, raw:'3' }
 * parseCredit('0')  → { status:'ok', value:0, raw:'0' }
 * parseCredit('')   → { status:'missing', value:null, raw:'' }
 * parseCredit('1.5') → { status:'invalid', ... }
 */
function parseCredit(raw) {
  if (raw === null || raw === undefined) return Parsed.missing('');

  const trimmed = String(raw).trim();

  if (MISSING_STRINGS.has(trimmed.toLowerCase())) {
    return Parsed.missing(trimmed);
  }

  if (!CREDIT_RE.test(trimmed)) {
    return Parsed.invalid(trimmed);
  }

  const num = Number(trimmed);
  if (!isFinite(num) || isNaN(num) || num < 0) {
    return Parsed.invalid(trimmed);
  }

  return Parsed.ok(num, trimmed);
}

/**
 * Parse grade point (hệ 4): có thể là float như "3.8", "4.0", "0.0"
 * Không áp dụng range check vì hệ thang có thể khác.
 * Chỉ check: là số hợp lệ và >= 0.
 *
 * @param {string|null|undefined} raw
 * @returns {import('../utils/result.js').ParsedNumber}
 */
function parseGradePoint(raw) {
  if (raw === null || raw === undefined) return Parsed.missing('');

  const trimmed = String(raw).trim();

  if (MISSING_STRINGS.has(trimmed.toLowerCase())) {
    return Parsed.missing(trimmed);
  }

  const normalized = trimmed.replace(',', '.');
  const num = Number(normalized);

  if (!isFinite(num) || isNaN(num) || num < 0 || num > 4.0) {
    return Parsed.invalid(trimmed);
  }

  return Parsed.ok(num, trimmed);
}

/**
 * Normalize text của một DOM cell: textContent → trim → chuỗi sạch.
 * Không nhận DOM element trực tiếp để giữ parser thuần.
 *
 * @param {string|null|undefined} text
 * @returns {string}
 */
function normalizeText(text) {
  if (text === null || text === undefined) return '';
  return String(text).trim().replace(/\s+/g, ' ');
}

/**
 * Format điểm thành phần thang 10 sang chuỗi 2 chữ số sau dấu phẩy (locale VN)
 * @param {number|null|undefined} value
 * @returns {string}
 * @example formatScore2(7) → '7,00', formatScore2(7.5) → '7,50', formatScore2(7.85) → '7,85'
 */
function formatScore2(value) {
  if (value === null || value === undefined || isNaN(value) || typeof value !== 'number') return '';
  return value.toFixed(2).replace('.', ',');
}

/**
 * Format điểm trung bình / GPA sang chuỗi 4 chữ số sau dấu phẩy (locale VN)
 * @param {number|null|undefined} value
 * @returns {string}
 * @example formatAverage4(7) → '7,0000', formatAverage4(7.4211538) → '7,4212'
 */
function formatAverage4(value) {
  if (value === null || value === undefined || isNaN(value) || typeof value !== 'number') return '';
  return value.toFixed(4).replace('.', ',');
}

  const parseCredits = parseCredit;
  const parseScore4 = parseGradePoint;

  const api = {
    parseScore,
    parseCredit,
    parseCredits,
    parseGradePoint,
    parseScore4,
    normalizeText,
    formatScore2,
    formatAverage4,
    MISSING_STRINGS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.parsers = root.parsers || Object.create(null);
    root.parsers.NumberParser = api;
    // Canonical aliases on parsers directly for any legacy callers
    root.parsers.parseCredit = parseCredit;
    root.parsers.parseCredits = parseCredits;
    root.parsers.parseScore = parseScore;
    root.parsers.parseGradePoint = parseGradePoint;
    root.parsers.formatScore2 = formatScore2;
    root.parsers.formatAverage4 = formatAverage4;
    global._IUHNumberParser = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

