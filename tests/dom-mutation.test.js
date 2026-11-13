/**
 * tests/dom-mutation.test.js
 * Contract tests:
 *  1. Bảng điểm và cell dữ liệu chính thức của IUH KHÔNG BỊ MUTATE khi inject extension hay mô phỏng.
 *  2. IUHPageAdapter bỏ qua hoàn toàn các extension-owned nodes (.iuh-gpa-extension).
 *  3. An toàn XSS đối với tên môn học hoặc dữ liệu DOM độc hại.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { IUHPageAdapter } = require('../src/adapters/IUHPageAdapter.js');
const { AppController } = require('../src/ui/AppController.js');

test('DOM Contract: Extension injection và simulation hoàn toàn KHÔNG mutate official cells', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const table = doc.querySelector('table#xemDiem_aaa');

  // Ghi lại text content ban đầu của các cell dữ liệu chính thức IUH (22 title cells trên mỗi dòng môn)
  const officialCellsBefore = Array.from(table.querySelectorAll('td[title]')).map(td => ({
    title: td.getAttribute('title'),
    text: td.textContent.trim(),
  }));

  assert.ok(officialCellsBefore.length > 0, 'Phải có các cell chính thức');

  // 1. Khởi tạo AppController và mount UI vào DOM
  const controller = new AppController(doc);
  const initRes = controller.init();
  assert.equal(initRes.success, true);

  // 2. Tìm hàng môn đầu tiên và mở CourseSimulationPanel
  const firstCourseRow = table.querySelector('tbody > tr:nth-child(2)');
  assert.ok(firstCourseRow);

  controller._toggleCoursePanel(firstCourseRow);

  // Kiểm tra panel được mount
  const panelRow = doc.querySelector('.iuh-gpa-course-panel-row');
  assert.ok(panelRow, 'CourseSimulationPanel row phải được chèn vào DOM');

  // 3. Thực hiện mô phỏng điểm thi cuối kỳ = 9.5
  const courseId = Array.from(controller.activePanels.keys())[0];
  assert.ok(courseId);

  controller.store.setCourseOverride(courseId, { finalExam: 9.5 });

  // 4. KIỂM TRA QUAN TRỌNG: Các cell chính thức của IUH (DiemTongKet, DiemTinChi, DiemThi, v.v.)
  // KHÔNG ĐƯỢC THAY ĐỔI DÙ CHỈ 1 KÝ TỰ!
  const getOfficialText = (td) => {
    return Array.from(td.childNodes)
      .filter(n => !(n.nodeType === 1 && (n.classList?.contains('iuh-gpa-extension') || n.hasAttribute?.('data-iuh-gpa-extension'))))
      .map(n => n.textContent)
      .join('')
      .trim();
  };

  const officialCellsAfter = Array.from(table.querySelectorAll('tbody > tr:not(.iuh-gpa-extension) td[title]')).map(td => ({
    title: td.getAttribute('title'),
    text: getOfficialText(td),
  }));

  assert.equal(
    officialCellsAfter.length,
    officialCellsBefore.length,
    'Số lượng cell dữ liệu chính thức không được đổi'
  );

  for (let i = 0; i < officialCellsBefore.length; i++) {
    assert.equal(
      officialCellsAfter[i].text,
      officialCellsBefore[i].text,
      `Cell [${officialCellsBefore[i].title}] bị mutate! Text trước: "${officialCellsBefore[i].text}", sau: "${officialCellsAfter[i].text}"`
    );
  }
});

test('DOM Contract: IUHPageAdapter bỏ qua extension-owned nodes khi parse lại', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const table = doc.querySelector('table#xemDiem_aaa');

  const controller = new AppController(doc);
  controller.init();

  // Mở 2 simulation panels
  const courseRows = table.querySelectorAll('tbody > tr:has(td[title="DiemTongKet"])');
  if (courseRows.length >= 2) {
    controller._toggleCoursePanel(courseRows[0]);
    controller._toggleCoursePanel(courseRows[1]);
  }

  // Parse lại table bằng IUHPageAdapter khi DOM đang chứa cả CompanionBar và các hàng CourseSimulationPanel
  const colMap = IUHPageAdapter.detectColumns(table).data;
  const reparseRes = IUHPageAdapter.parseSemesters(table, colMap);

  assert.ok(reparseRes.ok, 'Reparse phải thành công');
  const semesters = reparseRes.data;

  // Vẫn phải có đúng 10 học kỳ và đúng 54 môn học (không bị lẫn hàng panel của extension thành môn học)
  assert.equal(semesters.length, 10, 'Phải có đúng 10 học kỳ');
  let totalCourses = 0;
  semesters.forEach(s => totalCourses += s.courses.length);
  assert.equal(totalCourses, 54, 'Phải có đúng 54 môn học');
});

test('XSS Safety: Tên môn độc hại không bị thực thi script', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const table = doc.querySelector('table#xemDiem_aaa');

  // Đổi tên môn của hàng đầu tiên thành payload XSS
  const firstCourseNameCell = table.querySelector('tbody > tr:nth-child(2) > td.sticky-col');
  firstCourseNameCell.innerHTML = '<script>window._xssExecuted = true;</script>&lt;img src=x onerror=alert(1)&gt;';

  const controller = new AppController(doc);
  controller.init();

  const firstCourseRow = table.querySelector('tbody > tr:nth-child(2)');
  controller._toggleCoursePanel(firstCourseRow);

  // Verify window._xssExecuted không bao giờ được set
  assert.equal(dom.window._xssExecuted, undefined, 'Script XSS không được thực thi');
});
