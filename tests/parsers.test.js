/**
 * tests/parsers.test.js
 * Unit tests cho NumberParser và HeaderGridParser
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { parseScore, parseCredits, parseScore4 } = require('../src/parsers/NumberParser.js');
const { HeaderGridParser, SEMANTIC_KEYS } = require('../src/parsers/HeaderGridParser.js');

test('NumberParser: Phân biệt tuyệt đối giữa 0 và missing', () => {
  // Điểm 0 là giá trị số hợp lệ
  const zero1 = parseScore('0');
  assert.equal(zero1.status, 'ok');
  assert.equal(zero1.value, 0);

  const zero2 = parseScore('0.0');
  assert.equal(zero2.status, 'ok');
  assert.equal(zero2.value, 0);

  const zero3 = parseScore('0,0');
  assert.equal(zero3.status, 'ok');
  assert.equal(zero3.value, 0);

  // Missing: chuỗi rỗng, dấu gạch ngang, null, undefined
  const empty = parseScore('');
  assert.equal(empty.status, 'missing');
  assert.equal(empty.value, null);

  const dash1 = parseScore('-');
  assert.equal(dash1.status, 'missing');
  assert.equal(dash1.value, null);

  const dash2 = parseScore('--');
  assert.equal(dash2.status, 'missing');
  assert.equal(dash2.value, null);

  const nullVal = parseScore(null);
  assert.equal(nullVal.status, 'missing');
  assert.equal(nullVal.value, null);

  const undefinedVal = parseScore(undefined);
  assert.equal(undefinedVal.status, 'missing');
  assert.equal(undefinedVal.value, null);
});

test('NumberParser: Hỗ trợ dấu phẩy thập phân kiểu Việt Nam và dấu chấm chuẩn', () => {
  const comma = parseScore('7,5');
  assert.equal(comma.status, 'ok');
  assert.equal(comma.value, 7.5);

  const dot = parseScore('7.5');
  assert.equal(dot.status, 'ok');
  assert.equal(dot.value, 7.5);

  const ten = parseScore('10,0');
  assert.equal(ten.status, 'ok');
  assert.equal(ten.value, 10);

  const tenDot = parseScore('10');
  assert.equal(tenDot.status, 'ok');
  assert.equal(tenDot.value, 10);
});

test('NumberParser: Không dùng parseFloat mềm dẻo, từ chối input dị dạng', () => {
  // parseFloat('3.14abc') trả về 3.14, nhưng strict parser phải báo invalid
  const malformed = parseScore('3.14abc');
  assert.equal(malformed.status, 'invalid');
  assert.equal(malformed.value, null);

  // Điểm ngoài khoảng [0, 10]
  const overflow = parseScore('10.5');
  assert.equal(overflow.status, 'invalid');
  assert.equal(overflow.value, null);

  const negative = parseScore('-1');
  assert.equal(negative.status, 'invalid');
  assert.equal(negative.value, null);
});

test('NumberParser: Tín chỉ (parseCredits)', () => {
  assert.deepEqual(parseCredits('3'), { status: 'ok', value: 3, raw: '3' });
  assert.deepEqual(parseCredits('0'), { status: 'ok', value: 0, raw: '0' });
  assert.equal(parseCredits('').status, 'missing');
  assert.equal(parseCredits('-1').status, 'invalid');
  assert.equal(parseCredits('3.5').status, 'invalid');
});

test('NumberParser: Thang 4 (parseScore4)', () => {
  assert.deepEqual(parseScore4('3.8'), { status: 'ok', value: 3.8, raw: '3.8' });
  assert.deepEqual(parseScore4('4.0'), { status: 'ok', value: 4.0, raw: '4.0' });
  assert.deepEqual(parseScore4('0'), { status: 'ok', value: 0, raw: '0' });
  assert.equal(parseScore4('4.5').status, 'invalid');
});

test('HeaderGridParser: Phân tích header 3 tầng từ fixture sanitized', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const thead = dom.window.document.querySelector('thead');

  assert.ok(thead, 'Thead phải tồn tại trong fixture');

  const parseResult = HeaderGridParser.parse(thead);
  assert.ok(parseResult.ok, 'HeaderGridParser phải parse thành công');

  const columns = parseResult.data;
  assert.equal(columns.length, 27, 'Bảng điểm IUH phải có đúng 27 cột logic');

  const map = HeaderGridParser.buildColumnMap(columns);

  // Kiểm tra vị trí các cột chính yếu
  assert.equal(map[SEMANTIC_KEYS.ORDINAL], 0);
  assert.equal(map[SEMANTIC_KEYS.COURSE_CODE], 1);
  assert.equal(map[SEMANTIC_KEYS.COURSE_NAME], 2);
  assert.equal(map[SEMANTIC_KEYS.CREDITS], 3);
  assert.equal(map[SEMANTIC_KEYS.MIDTERM], 4);
  assert.equal(map[SEMANTIC_KEYS.FINAL_EXAM], 19);
  assert.equal(map[SEMANTIC_KEYS.TOTAL_10], 20);
  assert.equal(map[SEMANTIC_KEYS.GRADE_POINT], 21);
  assert.equal(map[SEMANTIC_KEYS.LETTER_GRADE], 22);
  assert.equal(map[SEMANTIC_KEYS.CLASSIFICATION], 23);
  assert.equal(map[SEMANTIC_KEYS.NOTE], 24);
  assert.equal(map[SEMANTIC_KEYS.PROCESS_AVERAGE], 25);
  assert.equal(map[SEMANTIC_KEYS.IS_PASSED], 26);
});
