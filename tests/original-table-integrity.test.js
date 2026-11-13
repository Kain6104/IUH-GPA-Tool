const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { AppController } = require('../src/ui/AppController.js');

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/grade-page.sanitized.html');

function setupTestEnvironment() {
  const html = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only',
  });
  const doc = dom.window.document;
  return { dom, doc };
}

test('Original Table Integrity: 1. Header has Chọn and Loại môn as first 2 columns (29 leaf columns total)', () => {
  const { doc } = setupTestEnvironment();
  const table = doc.querySelector('table#xemDiem_aaa');
  assert.ok(table, 'Table #xemDiem_aaa must exist');

  // Count source header cells on the primary row before extension
  const theadPrimaryBefore = table.querySelectorAll('thead tr:first-child > th');
  const originalColCount = theadPrimaryBefore.length;
  assert.equal(originalColCount, 15, 'Primary thead row has 15 parent columns (with multi-tier TX/TH totaling 27 leaf columns)');

  // Initialize AppController
  const app = new AppController(doc);
  const res = app.init();
  assert.equal(res.success, true);

  // After extension: 2 first columns are Chọn and Loại môn
  const theadPrimaryAfter = table.querySelectorAll('thead tr:first-child > th');
  assert.equal(theadPrimaryAfter.length, originalColCount + 2, 'Primary row has 2 additional header columns (17 parent, 29 leaf)');

  const thSelect = theadPrimaryAfter[0];
  assert.ok(thSelect.classList.contains('iuh-gpa-col-select'), 'First column is Chọn');
  assert.equal(thSelect.rowSpan, 3, 'Chọn spans 3 header rows');

  const thType = theadPrimaryAfter[1];
  assert.ok(thType.classList.contains('iuh-gpa-col-type'), 'Second column is Loại môn');
  assert.equal(thType.rowSpan, 3, 'Loại môn spans 3 header rows');

  // Third column is STT
  assert.ok(theadPrimaryAfter[2].getAttribute('lang')?.includes('stt'), 'Third column is STT');
});

test('Original Table Integrity: 2. Course row cells have Chọn and Loại môn as 2 first cells (29 cells total)', () => {
  const { doc } = setupTestEnvironment();
  const app = new AppController(doc);
  app.init();
  const table = app.table;

  const firstCourseRow = table.querySelector('tbody tr[data-course-id]');
  assert.ok(firstCourseRow, 'Course row must exist');
  assert.equal(firstCourseRow.children.length, 29, 'Course row must have exactly 29 cells');

  // Cell 0: Chọn
  const cell0 = firstCourseRow.children[0];
  assert.ok(cell0.classList.contains('iuh-gpa-col-select'), 'Cell 0 is Chọn');
  assert.ok(cell0.querySelector('.iuh-gpa-course-checkbox'), 'Cell 0 contains checkbox');

  // Cell 1: Loại môn
  const cell1 = firstCourseRow.children[1];
  assert.ok(cell1.classList.contains('iuh-gpa-col-type'), 'Cell 1 is Loại môn');
  assert.ok(cell1.querySelector('.iuh-gpa-course-type-select'), 'Cell 1 contains type select');

  // Cell 2: STT
  assert.strictEqual(firstCourseRow.children[2].textContent.trim(), '1', 'Cell 2 is STT');

  // Cell 3: Mã LHP
  assert.ok(firstCourseRow.children[3].textContent.trim().length > 0, 'Cell 3 is class code');

  // Cell 4: Tên môn với nút Mô phỏng
  const nameCell = firstCourseRow.children[4];
  assert.ok(nameCell.querySelector('.iuh-gpa-trigger-btn'), 'Name cell contains trigger button');

  // Cell 5: Số tín chỉ - sticky
  const creditCell = firstCourseRow.children[5];
  assert.equal(creditCell.style.position, 'sticky', 'Số TC is sticky');
});

test('Original Table Integrity: 3. Summary rows retain official 3-cell structure with colSpan 29 (4+2+23=29)', () => {
  const { doc } = setupTestEnvironment();
  const app = new AppController(doc);
  app.init();
  const table = app.table;

  const actualSummaryRows = table.querySelectorAll('tbody tr:has([lang^="kqht-tkhk-"])');
  assert.ok(actualSummaryRows.length >= 5, 'Must have summary rows');

  actualSummaryRows.forEach(row => {
    assert.equal(row.children.length, 3, 'Summary row must have exactly 3 cells');
    assert.equal(row.children[0].colSpan, 4, 'Cell 1 spans 4 columns (Chọn + Loại môn + STT + Mã LHP)');
    assert.equal(row.children[1].colSpan, 2, 'Cell 2 spans 2 columns (Tên môn + Số TC)');
    assert.equal(row.children[2].colSpan, 23, 'Cell 3 spans remaining 23 columns (4+2+23=29)');
  });
});

test('Original Table Integrity: 4. Semester header rows span exactly 29 columns', () => {
  const { doc } = setupTestEnvironment();
  const app = new AppController(doc);
  app.init();
  const table = app.table;

  const semHeadCells = table.querySelectorAll('tbody td.row-head');
  assert.ok(semHeadCells.length > 0);

  semHeadCells.forEach(cell => {
    assert.equal(cell.colSpan, 29, 'Semester header cell colSpan must be 29');
  });
});
