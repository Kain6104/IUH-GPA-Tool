const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/grade-page.sanitized.html');
const CTK_FIXTURE_PATH = path.resolve(__dirname, 'fixtures/curriculum.sanitized.html');

const { AppController } = require('../src/ui/AppController.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { IUHCurriculumAdapter } = require('../src/adapters/IUHCurriculumAdapter.js');

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

// ==========================================
// 65. TESTS —� STICKY COLUMNS & SEMESTER HEADER
test('Phase 6A.4.1: 65. Sticky table semantics, offsets, STT/Mã LHP non-sticky, semester header inner', () => {
  const { doc, app } = setupTestEnvironment();
  const table = app.table;
  assert.ok(table, 'Grade table must exist');

  // 1. Header controls mounted as 2 first columns (Chọn & Loại môn)
  const thSelect = table.querySelector('thead th.iuh-gpa-col-select');
  const thType = table.querySelector('thead th.iuh-gpa-col-type');
  assert.ok(thSelect, 'Header must have th.iuh-gpa-col-select');
  assert.ok(thType, 'Header must have th.iuh-gpa-col-type');

  // 2. Số tín chỉ header is sticky (cố định từ Số tín chỉ trở sang trái, STT/Mã LHP non-sticky)
  const thStc = table.querySelector('thead [lang="kqht-stc"]');
  assert.strictEqual(thStc.classList.contains('sticky-col'), true, 'Số TC header must have sticky-col');
  assert.strictEqual(thStc.style.position, 'sticky', 'Số TC header must be position: sticky');
  assert.strictEqual(thStc.style.left, '418px', 'Số TC header must be left: 418px');

  // STT và Mã LHP header must NOT be sticky
  const thStt = table.querySelector('thead [lang="kqht-stt"]');
  assert.strictEqual(thStt.style.position, 'static', 'STT header must be position: static');
  const thMalhp = table.querySelector('thead [lang="kqht-malhp"]');
  assert.strictEqual(thMalhp.style.position, 'static', 'Mã LHP header must be position: static');

  // 3. Body row controls as first 2 cells
  const firstCourseRow = table.querySelector('tbody tr[data-course-id]');
  assert.ok(firstCourseRow, 'First course row must exist');

  assert.ok(firstCourseRow.children[0].querySelector('.iuh-gpa-course-checkbox'), 'Checkbox Chọn is in cell 0');
  assert.ok(firstCourseRow.children[1].querySelector('.iuh-gpa-course-type-select'), 'Select Loại môn is in cell 1');
  assert.ok(firstCourseRow.children[4].querySelector('.iuh-gpa-trigger-btn'), 'Nút Mô phỏng is in DOM in cell 4 (Tên môn)');
  assert.strictEqual(firstCourseRow.children[5].style.position, 'sticky', 'Cell 5 (Số TC) must be sticky');
  assert.strictEqual(firstCourseRow.children[5].style.left, '418px', 'Cell 5 (Số TC) must be left: 418px');

  // 4. Semester Header: Wrapped in .iuh-gpa-semester-sticky-content containing label and reset button
  const semHeadingCell = table.querySelector('tbody td.row-head');
  assert.ok(semHeadingCell, 'Semester heading cell must exist');

  const stickyInner = semHeadingCell.querySelector('.iuh-gpa-semester-sticky-content');
  assert.ok(stickyInner, 'Semester heading must contain inner sticky container');

  const resetBtn = stickyInner.querySelector('.iuh-gpa-btn-reset-sem');
  assert.ok(resetBtn, 'Sticky inner container must contain reset button');
  assert.ok(resetBtn.textContent.includes('Khôi phục') || resetBtn.textContent.includes('HK'));
});

// ==========================================
// 66. TESTS —� FUTURE BUTTON LOCATION (AFTER LAST ACTUAL SEMESTER)
// ==========================================
test('Phase 6A.4.1: 66. Add semester button located immediately after last actual semester summary', () => {
  const { doc, app } = setupTestEnvironment();
  const table = app.table;
  const tbody = table.querySelector('tbody');

  const addRow = tbody.querySelector('.iuh-gpa-add-semester-row');
  assert.ok(addRow, 'Add semester row must exist in table');

  // Assert add-semester row is the very last child of tbody
  assert.strictEqual(tbody.lastElementChild, addRow, 'Add-semester row must be at the very bottom of table');

  // Inner button
  const addBtn = addRow.querySelector('#iuh-gpa-table-add-semester-btn');
  assert.ok(addBtn, 'Button #iuh-gpa-table-add-semester-btn must exist');
});

// ==========================================
// 67. TESTS —� BUTTON MOVES AFTER FUTURE SEMESTERS
// ==========================================
test('Phase 6A.4.1: 67. Add semester button moves below newest future semester; exactly 1 primary button', () => {
  const { doc, app } = setupTestEnvironment();
  const table = app.table;
  const tbody = table.querySelector('tbody');

  // Add HK3
  app.store.addFutureSemester({
    term: 3,
    startYear: 2025,
    endYear: 2026,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: '4203003307',
        courseName: 'Ph�t tri?n ?ng d?ng Web',
        credits: 3,
        theoryHours: 30,
        practiceHours: 30,
        inferredCourseType: 'COMBINED',
      },
    ],
  });

  let addRows = tbody.querySelectorAll('.iuh-gpa-add-semester-row');
  assert.strictEqual(addRows.length, 1, 'Exactly 1 primary add-semester row must exist');
  assert.strictEqual(tbody.lastElementChild, addRows[0], 'Add button must move after HK3');

  // Add HK1 next year
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: '4203002419',
        courseName: 'Tr� tu? nh�n t?o',
        credits: 3,
        theoryHours: 45,
        practiceHours: 0,
        inferredCourseType: 'THEORY',
      },
    ],
  });

  addRows = tbody.querySelectorAll('.iuh-gpa-add-semester-row');
  assert.strictEqual(addRows.length, 1, 'Exactly 1 primary add-semester row must exist');
  assert.strictEqual(tbody.lastElementChild, addRows[0], 'Add button must move after HK1 next year');
});

// ==========================================
// 68. TESTS —� MODAL DIALOG & COURSE PICKER
// ==========================================
test('Phase 6A.4.1: 68. Modal dialog, course picker uses CTK, min 1 course required', () => {
  const { doc, app } = setupTestEnvironment();

  // Load CTK into store
  const ctkHtml = fs.readFileSync(CTK_FIXTURE_PATH, 'utf8');
  const ctkDom = new JSDOM(ctkHtml);
  const parseRes = IUHCurriculumAdapter.parseCurriculum(ctkDom.window.document);
  app.store.setCurriculumModel(parseRes.data);

  // Trigger modal
  app.companionBar.openFuturePlannerModal();

  const modal = doc.getElementById('iuh-gpa-future-planner-modal');
  assert.ok(modal, 'Modal dialog backdrop must be mounted');
  assert.strictEqual(modal.querySelector('.iuh-gpa-modal-dialog')?.getAttribute('role'), 'dialog');
  assert.strictEqual(modal.querySelector('.iuh-gpa-modal-dialog')?.getAttribute('aria-modal'), 'true');

  const confirmBtn = modal.querySelector('.iuh-gpa-btn-confirm');
  assert.ok(confirmBtn, 'Confirm button must exist');
  // Initially 0 courses selected -> confirm must be disabled!
  assert.strictEqual(confirmBtn.disabled, true, 'Confirm button must be disabled when 0 courses selected');

  const selectableCard = Array.from(modal.querySelectorAll('.iuh-gpa-picker-item'))
    .find(card => card.querySelector('.iuh-gpa-picker-course-type')?.value === '');
  assert.ok(selectableCard, 'At least one regular course must require an explicit type');
  const firstChk = selectableCard.querySelector('.iuh-gpa-picker-chk');
  const courseType = selectableCard.querySelector('.iuh-gpa-picker-course-type');
  assert.ok(firstChk, 'Course picker checkbox must exist');
  assert.ok(courseType?.required, 'Course type must be required in the picker');

  // Clicking course details, not just the checkbox, selects the row.
  selectableCard.querySelector('div').click();
  assert.strictEqual(firstChk.checked, true, 'Clicking the course row must toggle its checkbox');
  assert.strictEqual(confirmBtn.disabled, true, 'A course without a selected type cannot be added');

  courseType.value = 'THEORY';
  courseType.dispatchEvent(new doc.defaultView.Event('change'));
  assert.strictEqual(confirmBtn.disabled, false, 'A selected course with a type enables the confirm button');

  // Close modal with escape key
  doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.strictEqual(doc.getElementById('iuh-gpa-future-planner-modal'), null, 'Modal must close on Escape');

  // The selected type is persisted on the future course.
  app.companionBar.openFuturePlannerModal();
  const secondCard = Array.from(doc.querySelectorAll('.iuh-gpa-picker-item'))
    .find(card => card.getAttribute('data-course-code') === selectableCard.getAttribute('data-course-code'));
  secondCard.querySelector('div').click();
  const secondType = secondCard.querySelector('.iuh-gpa-picker-course-type');
  secondType.value = 'PRACTICE';
  secondType.dispatchEvent(new doc.defaultView.Event('change'));
  doc.querySelector('.iuh-gpa-btn-confirm').click();
  const addedCourse = app.store.getFuturePlan().semesters[0].courses[0];
  assert.strictEqual(addedCourse.courseTypeOverride, 'PRACTICE', 'The type selected in the modal must be applied to the new course');
});

// ==========================================
// 69. TESTS —� RENDER SAME 29-COLUMN GRID
// ==========================================
test('Phase 6A.4.1: 69. Future course row cell count exactly 29 columns matching table contract', () => {
  const { doc, app } = setupTestEnvironment();
  const table = app.table;

  app.store.addFutureSemester({
    term: 3,
    startYear: 2025,
    endYear: 2026,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: '4203001234',
        courseName: 'Lập trình nâng cao',
        credits: 3,
        theoryHours: 30,
        practiceHours: 30,
        inferredCourseType: 'COMBINED',
      },
    ],
  });

  const futureCourseRow = table.querySelector('tbody tr.iuh-gpa-future-course-row');
  assert.ok(futureCourseRow, 'Future course row must be rendered in table');

  const cells = futureCourseRow.children;
  assert.strictEqual(cells.length, 29, 'Future course row must have exactly 29 columns');

  // Assert column mapping
  assert.ok(cells[0].classList.contains('iuh-gpa-col-select'), 'Col 0 is Chọn');
  assert.ok(cells[1].classList.contains('iuh-gpa-col-type'), 'Col 1 is Loại môn');
  assert.strictEqual(cells[2].textContent.trim(), '55', 'Col 2 is continuous STT');
  assert.ok(cells[3].textContent.includes('4203001234'), 'Col 3 is Mã HP');
  assert.ok(cells[4].classList.contains('iuh-gpa-col-course-name'), 'Col 4 is Tên môn');
  assert.strictEqual(cells[5].textContent.trim(), '3', 'Col 5 is Số TC');
  // Col 6 is Giữa kỳ, Col 22 is DiemTongKet, Col 23 is DiemTinChi, Col 28 is Dat
  assert.strictEqual(cells[22].getAttribute('title'), 'DiemTongKet', 'Col 22 is DiemTongKet');
  assert.strictEqual(cells[23].getAttribute('title'), 'DiemTinChi', 'Col 23 is DiemTinChi');
  assert.strictEqual(cells[28].getAttribute('title'), 'Dat', 'Col 28 is Dat');
});

test('Future internship and thesis default to SPECIAL and highlight the final-score input', () => {
  const { doc, app } = setupTestEnvironment();
  app.store.addFutureSemester({
    term: 3,
    startYear: 2025,
    endYear: 2026,
    courses: [
      {
        curriculumCourseCode: 'INTERNSHIP_TEST',
        courseName: 'Thực tập doanh nghiệp',
        credits: 5,
        inferredCourseType: 'THEORY',
      },
      {
        curriculumCourseCode: 'THESIS_TEST',
        courseName: 'Khóa luận tốt nghiệp',
        credits: 8,
        inferredCourseType: 'THEORY',
      },
    ],
  });

  const courses = app.store.getFuturePlan().semesters[0].courses;
  assert.deepEqual(courses.map(course => course.courseTypeOverride), ['SPECIAL', 'SPECIAL']);

  for (const code of ['INTERNSHIP_TEST', 'THESIS_TEST']) {
    const row = doc.querySelector(`tr[data-future-course-code="${code}"]`);
    assert.ok(row, `Future course row for ${code} must be rendered`);
    const finalScoreCell = row.children[21];
    assert.ok(finalScoreCell.classList.contains('iuh-gpa-special-final-score'));
    assert.match(finalScoreCell.textContent, /Nhập điểm/);
    finalScoreCell.click();
    assert.ok(finalScoreCell.querySelector('input.iuh-gpa-special-final-input'));
  }

  app.store.setFutureCourseType('INTERNSHIP_TEST', null);
  const resetInternship = app.store.getFuturePlan().semesters[0].courses[0];
  assert.strictEqual(resetInternship.courseTypeOverride, null);
  assert.strictEqual(resetInternship.inferredCourseType, 'SPECIAL');
  assert.ok(doc.querySelector('tr[data-future-course-code="INTERNSHIP_TEST"]')
    .children[21].classList.contains('iuh-gpa-special-final-score'));
});

// ==========================================
// 70. TESTS —� CTK STATUS MODEL
// ==========================================
test('Phase 6A.4.1: 70. CTK Status Model: SYNCED, AUTH_REQUIRED, TIMEOUT, HTTP_ERROR, INCOMPATIBLE_STRUCTURE', () => {
  const store = new SimulationStore();

  store.setCurriculumSyncStatus('LOADING');
  assert.strictEqual(store.getCurriculumSyncStatus().status, 'LOADING');

  store.setCurriculumSyncStatus('SYNCED');
  assert.strictEqual(store.getCurriculumSyncStatus().status, 'SYNCED');

  store.setCurriculumSyncStatus('AUTH_REQUIRED', 'AUTH_REQUIRED');
  assert.strictEqual(store.getCurriculumSyncStatus().status, 'AUTH_REQUIRED');

  store.setCurriculumSyncStatus('TIMEOUT', 'TIMEOUT');
  assert.strictEqual(store.getCurriculumSyncStatus().status, 'TIMEOUT');

  store.setCurriculumSyncStatus('HTTP_ERROR', 'HTTP_500');
  assert.strictEqual(store.getCurriculumSyncStatus().status, 'HTTP_ERROR');

  store.setCurriculumSyncStatus('INCOMPATIBLE_STRUCTURE', 'MISSING_CURRICULUM_ROOT');
  assert.strictEqual(store.getCurriculumSyncStatus().status, 'INCOMPATIBLE_STRUCTURE');
});

// ==========================================
// 71. TESTS —� USER OVERRIDE SAFETY ACROSS CTK SYNC
// ==========================================
test('Phase 6A.4.1: 71. Late CTK sync does not erase user checkbox, course type override, or score simulations', () => {
  const { doc, app } = setupTestEnvironment();

  // Find first course
  const firstRow = doc.querySelector('tbody tr[data-course-id]');
  const courseId = firstRow.getAttribute('data-course-id');

  // User sets overrides before CTK sync
  app.store.setCourseOverride(courseId, { included: false });
  app.store.setCourseOverride(courseId, { courseTypeOverride: 'THEORY' });
  app.store.setCourseOverride(courseId, { finalExam: 9.5 });

  let derived = app.store.getDerivedData();
  let c = derived.semesters.flatMap(s => s.courses).find(item => item.id === courseId);
  assert.strictEqual(c.included, false, 'User checkbox override must be false');
  assert.strictEqual(c.courseType, 'THEORY', 'User type override must be THEORY');
  assert.strictEqual(c.simulatedFinal, 9.5, 'User score simulation must be 9.5');

  // Now perform late CTK sync
  const ctkHtml = fs.readFileSync(CTK_FIXTURE_PATH, 'utf8');
  const ctkDom = new JSDOM(ctkHtml);
  const parseRes = IUHCurriculumAdapter.parseCurriculum(ctkDom.window.document);
  app.store.setCurriculumModel(parseRes.data);

  // Assert user overrides are 100% PRESERVED!
  derived = app.store.getDerivedData();
  c = derived.semesters.flatMap(s => s.courses).find(item => item.id === courseId);
  assert.strictEqual(c.included, false, 'User checkbox override must NOT be erased by CTK sync');
  assert.strictEqual(c.courseType, 'THEORY', 'User type override must NOT be erased by CTK sync');
  assert.strictEqual(c.simulatedFinal, 9.5, 'User score simulation must NOT be erased by CTK sync');
});
