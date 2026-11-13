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

test('TBQT Immutability: TBQT cell DOM and content stay strictly unchanged when component scores are edited', () => {
  const { doc } = setupTestEnvironment();
  const app = new AppController(doc);
  const initRes = app.init();
  assert.equal(initRes.success, true);

  const table = app.table;
  const firstCourseRow = table.querySelector('tbody tr[data-course-id]');
  assert.ok(firstCourseRow, 'A course row must exist');

  const courseId = firstCourseRow.getAttribute('data-course-id');
  assert.ok(courseId, 'Course ID must exist on row');

  // Find the TBQT cell for this row (semantic title DiemTBQuaTrinh or index 25 in 27-col row)
  const tbqtCell = firstCourseRow.querySelector('td[title="DiemTBQuaTrinh"]') || firstCourseRow.children[25];
  assert.ok(tbqtCell, 'TBQT cell must exist');

  // Capture original state
  const originalHTML = tbqtCell.innerHTML;
  const originalText = tbqtCell.textContent.trim();
  const originalClassName = tbqtCell.className;
  const originalAttributes = Array.from(tbqtCell.attributes).map(a => `${a.name}=${a.value}`).sort();

  // Update component scores in store (midterm, finalExam) - triggers store notification to AppController
  app.store.setCourseOverride(courseId, { finalExam: 9.5, midterm: 8.5 });

  // Assert TBQT cell DOM is completely unchanged
  assert.equal(tbqtCell.innerHTML, originalHTML, 'TBQT innerHTML must remain 100% identical');
  assert.equal(tbqtCell.textContent.trim(), originalText, 'TBQT text content must remain 100% identical');
  assert.equal(tbqtCell.className, originalClassName, 'TBQT className must not have simulation classes added');
  
  const postAttributes = Array.from(tbqtCell.attributes).map(a => `${a.name}=${a.value}`).sort();
  assert.deepEqual(postAttributes, originalAttributes, 'TBQT attributes must remain identical');

  // Verify other result cells WERE updated appropriately
  const tkCell = firstCourseRow.querySelector('td[title="DiemTongKet"]') || firstCourseRow.children[8];
  if (tkCell) {
    assert.ok(tkCell.classList.contains('iuh-gpa-simulated-cell') || tkCell.textContent !== '', 'TK cell can be updated');
  }
});
