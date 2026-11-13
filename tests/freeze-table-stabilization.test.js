/**
 * freeze-table-stabilization.test.js
 * Kiểm thử chống dãn toác cột và vỡ layout bảng điểm IUH do freeze-table.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { AppController } = require('../src/ui/AppController.js');

const cssPath = path.resolve(__dirname, '../src/ui/styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

test('Freeze Table Stabilization: 1. CSS does not indiscriminately force all sticky-col to 360px', () => {
  // Must NOT contain general rule "th.sticky-col, td.sticky-col { min-width: 360px"
  const badRuleRegex = /th\.sticky-col,\s*td\.sticky-col\s*\{[^}]*min-width:\s*360px/i;
  assert.equal(badRuleRegex.test(cssContent), false, 'Must not force all sticky-col to 360px');

  // Verify dedicated columns widths and lefts (4 sticky columns: Chọn, Loại môn, Tên HP, Số TC + static STT, Mã LHP)
  assert.ok(cssContent.includes('left: 0px !important;'), 'Select left is 0px');
  assert.ok(cssContent.includes('left: 48px !important;'), 'Type left is 48px');
  assert.ok(cssContent.includes('left: 178px !important;'), 'Tên HP left is 178px');
  assert.ok(cssContent.includes('left: 418px !important;'), 'Số TC left is 418px');
  assert.ok(cssContent.includes('position: static !important;'), 'STT and Mã LHP are static');
});

test('Freeze Table Stabilization: 2. AppController recalibrates sticky columns on mount', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html, { url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html' });
  const doc = dom.window.document;

  const app = new AppController(doc);
  app.init();

  const table = app.table;
  assert.ok(table, 'Table must exist');

  // Check thead first row cells
  const headCells = table.querySelectorAll('thead > tr:first-child > th');
  assert.equal(headCells[0].style.left, '0px', 'Chọn header left is 0px');
  assert.equal(headCells[0].style.width, '48px', 'Chọn header width is 48px');

  assert.equal(headCells[1].style.left, '48px', 'Loại môn header left is 48px');
  assert.equal(headCells[1].style.width, '130px', 'Loại môn header width is 130px');

  assert.equal(headCells[2].style.position, 'static', 'STT header is static');
  assert.equal(headCells[2].style.left, 'auto', 'STT header left is auto');

  assert.equal(headCells[3].style.position, 'static', 'Mã LHP header is static');
  assert.equal(headCells[3].style.left, 'auto', 'Mã LHP header left is auto');

  assert.equal(headCells[4].style.left, '178px', 'Tên môn header left is 178px');
  assert.equal(headCells[4].style.width, '240px', 'Tên môn header width is 240px');

  assert.equal(headCells[5].style.left, '418px', 'Số TC header left is 418px');
  assert.equal(headCells[5].style.width, '60px', 'Số TC header width is 60px');

  // Check course rows in tbody
  const firstCourseRow = table.querySelector('tbody > tr[data-course-id]');
  assert.ok(firstCourseRow, 'First course row exists');
  const cells = firstCourseRow.children;
  assert.ok(cells.length >= 6, 'Has at least 6 cells');

  assert.equal(cells[0].style.left, '0px', 'Row Chọn cell left is 0px');
  assert.equal(cells[0].style.width, '48px', 'Row Chọn cell width is 48px');

  assert.equal(cells[1].style.left, '48px', 'Row Loại môn cell left is 48px');
  assert.equal(cells[1].style.width, '130px', 'Row Loại môn cell width is 130px');

  assert.equal(cells[2].style.position, 'static', 'Row STT cell is static');
  assert.equal(cells[2].style.left, 'auto', 'Row STT cell left is auto');

  assert.equal(cells[3].style.position, 'static', 'Row Mã LHP cell is static');
  assert.equal(cells[3].style.left, 'auto', 'Row Mã LHP cell left is auto');

  assert.equal(cells[4].style.left, '178px', 'Row Tên HP cell left is 178px');
  assert.equal(cells[4].style.width, '240px', 'Row Tên HP cell width is 240px');

  assert.equal(cells[5].style.left, '418px', 'Row Số TC cell left is 418px');
  assert.equal(cells[5].style.width, '60px', 'Row Số TC cell width is 60px');
});

test('Freeze Table Stabilization: 3. Corrects distorted left offsets on real saved Kết quả học tập.html snapshot', () => {
  const realHtmlPath = path.resolve(__dirname, '../Kết quả học tập.html');
  if (!fs.existsSync(realHtmlPath)) return;

  const html = fs.readFileSync(realHtmlPath, 'utf8');
  const dom = new JSDOM(html, { url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html' });
  const doc = dom.window.document;

  const table = doc.querySelector('#xemDiem_aaa');
  assert.ok(table, 'Table #xemDiem_aaa exists in real HTML');

  const app = new AppController(doc);
  app._mountHeaderControls(table);
  app._recalibrateStickyColumns(table);

  const headCells = table.querySelectorAll('thead > tr:first-child > th');
  assert.equal(headCells[0].style.left, '0px');
  assert.equal(headCells[1].style.left, '48px');
  assert.equal(headCells[2].style.position, 'static');
  assert.equal(headCells[2].style.left, 'auto');
  assert.equal(headCells[3].style.position, 'static');
  assert.equal(headCells[3].style.left, 'auto');
  assert.equal(headCells[4].style.left, '178px');
  assert.equal(headCells[5].style.left, '418px');
});
