const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { AppController, createCourseTypeSelect, getAutoCourseTypeLabel } = require('../src/ui/AppController.js');
const { FutureSemesterEngine } = require('../src/core/FutureSemesterEngine.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');

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

test('Course Type Parity: 1. getAutoCourseTypeLabel handles all CTK permutations and unknowns', () => {
  // LT > 0, TH == 0
  assert.equal(getAutoCourseTypeLabel({ theoryHours: 45, practiceHours: 0 }), 'Lý thuyết');
  assert.equal(getAutoCourseTypeLabel({ curriculumCourse: { lt: 3, th: 0 } }), 'Lý thuyết');

  // LT == 0, TH > 0
  assert.equal(getAutoCourseTypeLabel({ theoryHours: 0, practiceHours: 60 }), 'Thực hành');
  assert.equal(getAutoCourseTypeLabel({ curriculumCourse: { lt: 0, th: 2 } }), 'Thực hành');

  // LT > 0, TH > 0
  assert.equal(getAutoCourseTypeLabel({ theoryHours: 30, practiceHours: 30 }), 'Kết hợp');
  assert.equal(getAutoCourseTypeLabel({ curriculumCourse: { lt: 2, th: 1 } }), 'Kết hợp');

  // Unknown / Missing
  assert.equal(getAutoCourseTypeLabel({}), 'Chưa xác định');
  assert.equal(getAutoCourseTypeLabel(null), 'Chưa xác định');
});

test('Course Type Parity: 2. createCourseTypeSelect renders exact 6 options in exact order', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const doc = dom.window.document;

  const mockCourse = {
    courseName: 'Kiến trúc máy tính',
    theoryHours: 45,
    practiceHours: 0,
    inferredCourseType: 'THEORY',
  };

  const select = createCourseTypeSelect(mockCourse, { doc });
  assert.equal(select.tagName.toLowerCase(), 'select');
  assert.equal(select.options.length, 6);

  const expectedOptions = [
    { val: 'AUTO', text: 'Lý thuyết' },
    { val: 'THEORY', text: 'Lý thuyết' },
    { val: 'COMBINED', text: 'Kết hợp' },
    { val: 'PRACTICE', text: 'Thực hành' },
    { val: 'SPECIAL', text: 'Đặc biệt (CK)' },
    { val: 'EXCLUDED', text: 'Không GPA' },
  ];

  expectedOptions.forEach((exp, idx) => {
    assert.equal(select.options[idx].value, exp.val, `Option ${idx} value must match`);
    assert.equal(select.options[idx].textContent, exp.text, `Option ${idx} text must match`);
  });
});

test('Course Type Parity: 3. Both actual and future rows have identical 6 options in DOM', () => {
  const { doc, app } = setupTestEnvironment();

  // Add future semester with a course
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: '4203009999',
        courseName: 'Môn kiểm tra',
        credits: 3,
        theoryHours: 30,
        practiceHours: 30,
        inferredCourseType: 'COMBINED',
      },
    ],
  });

  const actualSelect = doc.querySelector('tbody tr:not(.iuh-gpa-future-row) select.iuh-gpa-course-type-select');
  const futureSelect = doc.querySelector('tbody tr.iuh-gpa-future-course-row select.iuh-gpa-course-type-select');

  assert.ok(actualSelect, 'Actual course type select must exist');
  assert.ok(futureSelect, 'Future course type select must exist');

  assert.equal(actualSelect.options.length, 6, 'Actual select must have 6 options');
  assert.equal(futureSelect.options.length, 6, 'Future select must have 6 options');

  for (let i = 0; i < 6; i++) {
    assert.equal(actualSelect.options[i].value, futureSelect.options[i].value, `Option ${i} value must match across actual and future`);
  }
});

test('Course Type Parity: 4. Future course SPECIAL calculates with finalExam only', () => {
  const futureCourse = {
    curriculumCourseCode: 'SPECIAL_TEST',
    credits: 3,
    inferredCourseType: 'THEORY',
    courseTypeOverride: 'SPECIAL',
    scores: {
      midterm: null,
      regular: [],
      practice: [],
      final: 8.5,
    },
  };

  FutureSemesterEngine.recalculateFutureCourse(futureCourse);
  assert.equal(futureCourse.score10Raw, 8.5);
  assert.equal(futureCourse.score4, 3.8);
  assert.equal(futureCourse.letter, 'A');
  assert.equal(futureCourse.isPassed, true);
});

test('Course Type Parity: 5. Future course EXCLUDED removes from GPA denominator while keeping planned credits', () => {
  const futureSem = {
    id: 'fsem_excluded',
    courses: [
      {
        curriculumCourseCode: 'HP_NORMAL',
        credits: 3,
        scores: { final: 8.0, midterm: 8.0, regular: [8.0], practice: [] },
        score10Raw: 8.0,
        score4Raw: 3.5,
        included: true,
      },
      {
        curriculumCourseCode: 'HP_EXCLUDED',
        credits: 2,
        courseTypeOverride: 'EXCLUDED',
        scores: { final: 9.0, midterm: 9.0, regular: [9.0], practice: [] },
        score10Raw: 9.0,
        score4Raw: 4.0,
        included: true,
      },
    ],
  };

  const summary = FutureSemesterEngine.calculateFutureSemesterGPA(futureSem);
  assert.equal(summary.totalPlannedCredits, 5, 'Total planned credits includes both (3 + 2)');
  assert.equal(summary.gpaEligibleCredits, 3, 'GPA eligible credits excludes EXCLUDED course (only 3)');
  assert.equal(summary.gpa4Raw, 3.5, 'GPA calculated solely on 3-credit normal course');
});

test('Course Type Parity: 6. Resetting type restores AUTO / CTK inferred type', () => {
  const store = new SimulationStore();
  store.setOriginalData({ semesters: [] });
  store.setCurriculumModel({
    courses: [
      {
        curriculumCourseCode: 'HP_RESET_TEST',
        courseName: 'Môn Reset Test',
        credits: 3,
        theoryHours: 45,
        practiceHours: 0,
        inferredCourseType: 'THEORY',
      }
    ]
  });

  store.addFutureSemester({
    id: 'sem_1',
    term: 1,
    startYear: 2026,
    endYear: 2027,
    courses: [
      {
        curriculumCourseCode: 'HP_RESET_TEST',
        courseName: 'Môn Reset Test',
        credits: 3,
        theoryHours: 45,
        practiceHours: 0,
        inferredCourseType: 'THEORY',
      }
    ]
  });

  // Override to SPECIAL
  store.setFutureCourseType('HP_RESET_TEST', 'SPECIAL');
  let derived = store.getDerivedData();
  let fc = derived.futurePlan.semesters[0].courses[0];
  assert.equal(fc.courseTypeOverride, 'SPECIAL');
  assert.equal(fc.isTypeOverridden, true);

  // Reset to AUTO (pass null or 'AUTO')
  store.setFutureCourseType('HP_RESET_TEST', 'AUTO');
  derived = store.getDerivedData();
  fc = derived.futurePlan.semesters[0].courses[0];
  assert.equal(fc.courseTypeOverride, null, 'Override is cleared');
  assert.equal(fc.isTypeOverridden, false, 'isTypeOverridden reset to false');
  assert.equal(fc.inferredCourseType, 'THEORY', 'Original inferred type intact');
});
