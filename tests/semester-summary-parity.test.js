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
  const app = new AppController(doc);
  app.init();
  return { dom, doc, app };
}

test('Semester Summary Parity: 1. Old custom one-line summary is completely removed', () => {
  const { doc, app } = setupTestEnvironment();
  
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: 'HP_TEST_1',
        courseName: 'Môn kiểm tra 1',
        credits: 3,
        inferredCourseType: 'THEORY'
      }
    ]
  });

  // Assert old custom class does not exist
  assert.equal(doc.querySelector('.iuh-gpa-future-semester-summary'), null);

  // Assert old text is absent
  const tableText = doc.querySelector('table').textContent;
  assert.ok(!tableText.includes('Tổng TC kế hoạch:'), 'Should not have old single-line summary text');
  assert.ok(!tableText.includes('Môn đã có điểm:'), 'Should not have old single-line summary text');
});

test('Semester Summary Parity: 2. Future semester renders exact 5 standardized summary rows', () => {
  const { doc, app } = setupTestEnvironment();
  
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: 'HP_TEST_A',
        courseName: 'Thực tập tốt nghiệp',
        credits: 3,
        inferredCourseType: 'PRACTICE'
      }
    ]
  });

  const summaryRows = doc.querySelectorAll('.iuh-gpa-semester-summary-row');
  assert.equal(summaryRows.length, 5, 'Must render exactly 5 summary rows for future semester');

  // Verify each row has .iuh-gpa-semester-summary-host with colspan=27
  summaryRows.forEach((row, idx) => {
    const hostTd = row.querySelector('td.iuh-gpa-semester-summary-host');
    assert.ok(hostTd, 'Row ' + (idx + 1) + ' must have host td');
    assert.equal(hostTd.colSpan, 29, 'Host td must span 29 logical columns');

    const stickyDiv = hostTd.querySelector('.iuh-gpa-semester-summary-sticky');
    assert.ok(stickyDiv, 'Host td must contain sticky container');

    const items = stickyDiv.querySelectorAll('.iuh-gpa-summary-item');
    assert.equal(items.length, 2, 'Each summary row must contain 2 semantic summary items');
  });
});

test('Semester Summary Parity: 3. No summary row receives course sticky classes', () => {
  const { doc, app } = setupTestEnvironment();
  
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: 'HP_TEST_B',
        courseName: 'Khóa luận tốt nghiệp',
        credits: 4,
        inferredCourseType: 'SPECIAL'
      }
    ]
  });

  doc.querySelectorAll('.iuh-gpa-semester-summary-row, .iuh-gpa-actual-summary-row').forEach(row => {
    assert.equal(row.querySelector('.iuh-gpa-cell-select'), null, 'Summary row must NOT have .iuh-gpa-cell-select');
    assert.equal(row.querySelector('.iuh-gpa-cell-type'), null, 'Summary row must NOT have .iuh-gpa-cell-type');
    assert.equal(row.querySelector('.iuh-gpa-cell-name'), null, 'Summary row must NOT have .iuh-gpa-cell-name');
  });
});

test('Semester Summary Parity: 4. Future summary uses projected/planned wording (no false registration)', () => {
  const { doc, app } = setupTestEnvironment();
  
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: 'HP_TEST_C',
        courseName: 'Môn tương lai C',
        credits: 3,
        inferredCourseType: 'THEORY'
      }
    ]
  });

  const futureRows = Array.from(doc.querySelectorAll('.iuh-gpa-semester-summary-row'));
  const textContent = futureRows.map(r => r.textContent).join(' ');

  // Row 1
  assert.ok(textContent.includes('Điểm trung bình học kỳ hệ 10:'));
  assert.ok(textContent.includes('Điểm trung bình học kỳ hệ 4:'));

  // Row 2
  assert.ok(textContent.includes('Điểm trung bình tích lũy dự kiến:'));
  assert.ok(textContent.includes('Điểm trung bình tích lũy dự kiến (hệ 4):'));

  // Row 3
  assert.ok(textContent.includes('Tổng số tín chỉ kế hoạch:'));
  assert.ok(textContent.includes('Tổng số tín chỉ tích lũy dự kiến:'));
  assert.ok(!textContent.includes('Tổng số tín chỉ đã đăng ký:'), 'Future summary must not say "đã đăng ký"');

  // Row 4
  assert.ok(textContent.includes('Tổng số tín chỉ đạt dự kiến:'));
  assert.ok(textContent.includes('Tổng số tín chỉ chưa đạt dự kiến:'));

  // Row 5
  assert.ok(textContent.includes('Xếp loại học lực tích lũy dự kiến:'));
  assert.ok(textContent.includes('Xếp loại học lực học kỳ dự kiến:'));
});

test('Semester Summary Parity: 5. Actual summary rows retain official IUH structure and attributes', () => {
  const { doc } = setupTestEnvironment();

  // Find actual summary rows in DOM
  const summaryRows = doc.querySelectorAll('tr:has([lang^="kqht-tkhk-"])');
  assert.ok(summaryRows.length >= 5, 'Must find actual summary rows in fixture');

  // Verify actual summary rows have .iuh-gpa-actual-summary-row and sticky cells
  summaryRows.forEach(row => {
    assert.ok(row.classList.contains('iuh-gpa-actual-summary-row'), 'Actual summary row must have class');
    const cell1 = row.children[0];
    const cell2 = row.children[1];
    const cell3 = row.children[2];
    assert.ok(cell1.classList.contains('iuh-gpa-actual-summary-cell-1'), 'First cell must have sticky cell-1 class');
    assert.ok(cell2.classList.contains('iuh-gpa-actual-summary-cell-2'), 'Second cell must have sticky cell-2 class');
    assert.equal(cell3.colSpan, 23, 'Last cell must span remaining 23 columns');
  });
});

test('Semester Summary Parity: 6. Add semester button is mounted strictly AFTER summary rows', () => {
  const { doc, app } = setupTestEnvironment();
  
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: 'HP_TEST_D',
        courseName: 'Môn tương lai D',
        credits: 3
      }
    ]
  });

  const addSemesterRow = doc.querySelector('.iuh-gpa-add-semester-row');
  assert.ok(addSemesterRow, 'Must have add-semester row');

  // Ensure all 5 summary rows precede addSemesterRow in DOM order
  const summaryRows = Array.from(doc.querySelectorAll('.iuh-gpa-semester-summary-row'));
  assert.equal(summaryRows.length, 5);

  const allRows = Array.from(doc.querySelectorAll('tr'));
  
  const addSemIndex = allRows.indexOf(addSemesterRow);
  const lastSummaryIndex = allRows.indexOf(summaryRows[4]);

  assert.ok(addSemIndex > lastSummaryIndex, 'Add semester row (' + addSemIndex + ') must come after last summary row (' + lastSummaryIndex + ')');
});
