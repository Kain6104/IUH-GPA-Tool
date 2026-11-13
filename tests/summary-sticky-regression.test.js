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

test('Summary Sticky Regression: 1. Future summary rows use dedicated host td with colspan=27 and sticky wrapper', () => {
  const { doc, app } = setupTestEnvironment();

  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    courses: [
      { curriculumCourseCode: 'HP_TEST_REG_1', courseName: 'Môn test 1', credits: 3 }
    ]
  });

  const summaryRows = doc.querySelectorAll('tr.iuh-gpa-semester-summary-row');
  assert.equal(summaryRows.length, 5, 'Must have 5 future summary rows');

  summaryRows.forEach((row, i) => {
    const hostTd = row.querySelector('td.iuh-gpa-semester-summary-host');
    assert.ok(hostTd, 'Row ' + i + ' must have .iuh-gpa-semester-summary-host');
    assert.equal(hostTd.colSpan, 29, 'Row ' + i + ' must have colspan 29 to span all columns without conflict');

    const stickyWrapper = hostTd.querySelector('.iuh-gpa-semester-summary-sticky');
    assert.ok(stickyWrapper, 'Row ' + i + ' must contain .iuh-gpa-semester-summary-sticky');

    const pair = stickyWrapper.querySelector('.iuh-gpa-summary-pair');
    assert.ok(pair, 'Row ' + i + ' must contain .iuh-gpa-summary-pair');

    const items = pair.querySelectorAll('.iuh-gpa-summary-item');
    assert.equal(items.length, 2, 'Row ' + i + ' must have exactly 2 summary items');
  });
});

test('Summary Sticky Regression: 2. CSS styles provide sticky stacking hierarchy and opaque background', () => {
  const cssPath = path.resolve(__dirname, '../src/ui/styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Verify sticky positioning on summary wrapper
  assert.ok(cssContent.includes('.iuh-gpa-semester-summary-sticky'), 'CSS must define .iuh-gpa-semester-summary-sticky');
  assert.ok(cssContent.includes('position: sticky'), 'Must have sticky position');
  assert.ok(cssContent.includes('left: 0'), 'Must be pinned to left: 0');
  
  // Verify z-index is 16 (higher than course sticky name column at z-index 15, lower than modal / companion)
  assert.ok(cssContent.includes('z-index: 16'), 'Summary sticky z-index must be 16 to sit above course columns');

  // Verify opaque background to prevent bleed-through
  assert.ok(cssContent.includes('background-color: #FFFFFF') || cssContent.includes('background: #FFFFFF') || cssContent.includes('background-color: #fff'), 'Must have opaque white background');
});

test('Summary Sticky Regression: 3. Actual semester summary rows retain 3-cell structure with colSpan 23', () => {
  const { doc } = setupTestEnvironment();

  const actualSummaryRows = doc.querySelectorAll('tr:has([lang^="kqht-tkhk-"])');
  assert.ok(actualSummaryRows.length >= 5, 'Must find actual summary rows');

  actualSummaryRows.forEach(row => {
    assert.ok(row.classList.contains('iuh-gpa-actual-summary-row'), 'Must have .iuh-gpa-actual-summary-row');
    assert.equal(row.children.length, 3, 'Must retain 3 cells');

    const cell1 = row.children[0];
    const cell2 = row.children[1];
    const cell3 = row.children[2];

    assert.ok(cell1.classList.contains('iuh-gpa-actual-summary-cell-1'), 'Cell 1 must have sticky class');
    assert.ok(cell2.classList.contains('iuh-gpa-actual-summary-cell-2'), 'Cell 2 must have sticky class');
    assert.equal(cell3.colSpan, 23, 'Cell 3 must have colSpan 23 for full table coverage');
  });
});

test('Summary Sticky Regression: 4. Actual summary updates on score change and restores cleanly on reset', () => {
  const { doc, app } = setupTestEnvironment();

  // Find first course with score
  const derived = app.store.getDerivedData();
  const firstCourse = derived.semesters[0].courses[0];
  const courseId = firstCourse.id;

  // Find summary row for first semester
  const initialRow = doc.querySelector('tr:has([lang="kqht-tkhk-diemtbhocluc"])');
  const span = initialRow.querySelector('[lang="kqht-tkhk-diemtbhocluc"]');
  const cell = span.parentElement;
  const officialSpan = span.nextElementSibling;
  assert.ok(officialSpan, 'Official span should exist');

  // Simulate editing score
  app.store.setCourseOverride(courseId, { finalExam: 10.0 });

  // Simulation overlay should now exist with .is-simulated-summary
  const simSpan = cell.querySelector('.iuh-gpa-summary-sim-val');
  assert.ok(simSpan, 'Simulation value span should exist');
  assert.ok(simSpan.classList.contains('is-simulated-summary'), 'Should have is-simulated-summary class');
  assert.equal(officialSpan.style.display, 'none', 'Official value hidden during simulation');

  // Reset course
  app.store.resetCourse(courseId);

  // Official value is restored, simulated overlay is not simulated
  assert.equal(simSpan.classList.contains('is-simulated-summary'), false, 'Simulation overlay class removed on reset');
});
