/**
 * tests/adapter.test.js
 * Contract tests cho IUHPageAdapter
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { IUHPageAdapter, ERROR_CODES } = require('../src/adapters/IUHPageAdapter.js');

test('IUHPageAdapter: isCompatiblePage phát hiện chính xác trang điểm IUH', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);

  const compat = IUHPageAdapter.isCompatiblePage(dom.window.document);
  assert.equal(compat.compatible, true, 'Trang sanitized fixture phải tương thích');
  assert.ok(compat.table, 'Phải trả về element table');
});

test('IUHPageAdapter: isCompatiblePage fail-safe khi gặp trang không tương thích', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="wrong">No grade table here</div></body></html>');
  const compat = IUHPageAdapter.isCompatiblePage(dom.window.document);
  assert.equal(compat.compatible, false);
  assert.equal(compat.code, ERROR_CODES.TABLE_NOT_FOUND);

  const nullCheck = IUHPageAdapter.isCompatiblePage(null);
  assert.equal(nullCheck.compatible, false);
  assert.equal(nullCheck.code, ERROR_CODES.NOT_IUH_GRADE_PAGE);
});

test('IUHPageAdapter: detectColumns & validateStructure', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector('table#xemDiem_aaa');

  const colResult = IUHPageAdapter.detectColumns(table);
  assert.ok(colResult.ok, 'detectColumns phải thành công');

  const valResult = IUHPageAdapter.validateStructure(colResult.data);
  assert.ok(valResult.ok, 'validateStructure phải hợp lệ');
});

test('IUHPageAdapter: parseSemesters trích xuất đủ 10 kỳ, 54 môn, xử lý đúng edge cases', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector('table#xemDiem_aaa');
  const originalHtmlSnapshot = table.outerHTML;

  const colMap = IUHPageAdapter.detectColumns(table).data;
  const parseResult = IUHPageAdapter.parseSemesters(table, colMap);

  assert.ok(parseResult.ok, 'parseSemesters phải thành công');
  const semesters = parseResult.data;

  // 1. Kiểm tra số lượng học kỳ (10 kỳ)
  assert.equal(semesters.length, 10, 'Phải có 10 học kỳ');

  // 2. Tổng số môn học (54 môn)
  let totalCourses = 0;
  semesters.forEach(s => totalCourses += s.courses.length);
  assert.equal(totalCourses, 54, 'Phải có đúng 54 môn học');

  // 3. Immutability: Bảng DOM gốc hoàn toàn không bị mutate
  assert.equal(table.outerHTML, originalHtmlSnapshot, 'DOM không được bị thay đổi trong quá trình parse');

  // 4. Edge case: Môn #6 có số tín chỉ = 0
  const sem1 = semesters[0];
  const course6 = sem1.courses[5]; // Môn thứ 6
  assert.ok(course6, 'Môn #6 phải tồn tại');
  assert.equal(course6.credits.status, 'ok');
  assert.equal(course6.credits.value, 0, 'Môn #6 phải có 0 tín chỉ');

  // 5. Edge case: Môn #25 có điểm Giữa kỳ = "0" (numeric zero, không phải missing)
  const allCourses = semesters.flatMap(s => s.courses);
  const course25 = allCourses[24];
  assert.ok(course25, 'Môn #25 phải tồn tại');
  assert.equal(course25.assessments.midterm.status, 'ok');
  assert.equal(course25.assessments.midterm.value, 0, 'Môn #25 phải có điểm giữa kỳ = 0.0');

  // 6. Edge case: Môn #22 có đủ điểm thường xuyên 6-9
  const course22 = allCourses[21];
  assert.ok(course22, 'Môn #22 phải tồn tại');
  const tk6 = course22.assessments.regular.find(r => r.sourceField === 'DiemThuongKy6');
  assert.equal(tk6.value.status, 'ok');

  // 7. Edge case: Học kỳ hè (HKH) không có summary row
  const summerSemesters = semesters.filter(s => s.semesterKey.includes('HKH'));
  assert.equal(summerSemesters.length, 2, 'Có 2 học kỳ hè');
  summerSemesters.forEach(s => {
    assert.equal(s.summary, null, 'Học kỳ hè không có dòng summary');
  });

  // 8. Các học kỳ chính có summary row đầy đủ
  const regularSemesters = semesters.filter(s => !s.semesterKey.includes('HKH'));
  assert.equal(regularSemesters.length, 8, 'Có 8 học kỳ chính');
  regularSemesters.forEach(s => {
    assert.ok(s.summary, `Học kỳ ${s.semesterKey} phải có summary`);
    assert.ok(s.summary.gpa10, `Học kỳ ${s.semesterKey} phải có gpa10 trong summary`);
  });
});
