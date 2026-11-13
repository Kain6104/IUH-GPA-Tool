const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { FutureSemesterEngine } = require('../src/core/FutureSemesterEngine.js');
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

test('Future Summary Calculation: 1. Requirement 63 Fixture (Course A 3TC 3.0/7.5, Course B 2TC 4.0/9.0)', () => {
  const futureSemester = {
    term: 1,
    startYear: 2026,
    endYear: 2027,
    courses: [
      {
        curriculumCourseCode: 'COURSE_A',
        courseName: 'Môn A',
        credits: 3,
        scores: { final: 7.5 },
        inferredCourseType: 'SPECIAL',
        score4Raw: 3.0,
        score10Raw: 7.5,
        isPassed: true,
        isExcludedFromGpa: false
      },
      {
        curriculumCourseCode: 'COURSE_B',
        courseName: 'Môn B',
        credits: 2,
        scores: { final: 9.0 },
        inferredCourseType: 'SPECIAL',
        score4Raw: 4.0,
        score10Raw: 9.0,
        isPassed: true,
        isExcludedFromGpa: false
      }
    ]
  };

  const summary = FutureSemesterEngine.calculateFutureSemesterGPA(futureSemester);
  
  // GPA4 raw = (3*3.0 + 2*4.0) / 5 = 17 / 5 = 3.4
  assert.equal(summary.gpa4Raw, 3.4);
  // Score10 raw = (3*7.5 + 2*9.0) / 5 = 40.5 / 5 = 8.1
  assert.equal(summary.gpa10Raw, 8.1);
  assert.equal(summary.gpaEligibleCredits, 5);
  assert.equal(summary.earnedCredits, 5);
  assert.equal(summary.failedCredits, 0);

  // In DOM formatting with 4 decimals
  const { doc, app } = setupTestEnvironment();
  app.store.addFutureSemester(futureSemester);
  app.store.setFutureCourseType('COURSE_A', 'SPECIAL');
  app.store.updateFutureCourseScore('COURSE_A', 'final', 0, 7.5);
  app.store.setFutureCourseType('COURSE_B', 'SPECIAL');
  app.store.updateFutureCourseScore('COURSE_B', 'final', 0, 9.0);

  const summaryRows = doc.querySelectorAll('.iuh-gpa-semester-summary-row');
  assert.equal(summaryRows.length, 5);

  const row1Values = summaryRows[0].querySelectorAll('.iuh-gpa-future-summary-value');
  assert.equal(row1Values.length, 2);
  assert.equal(row1Values[0].textContent.trim(), '8,1000', 'Semester GPA 10 formatted to 4 decimals');
  assert.equal(row1Values[1].textContent.trim(), '3,4000', 'Semester GPA 4 formatted to 4 decimals');
});

test('Future Summary Calculation: 2. Missing score does NOT count as 0 (Requirement 64)', () => {
  const futureSemester = {
    term: 1,
    startYear: 2026,
    endYear: 2027,
    courses: [
      {
        curriculumCourseCode: 'COURSE_A',
        courseName: 'Môn A',
        credits: 3,
        score4Raw: 3.0,
        score10Raw: 7.5,
        isPassed: true,
        isExcludedFromGpa: false
      },
      {
        curriculumCourseCode: 'COURSE_B_MISSING',
        courseName: 'Môn B (chưa có điểm)',
        credits: 2,
        score4Raw: null,
        score10Raw: null,
        isPassed: null,
        isExcludedFromGpa: false
      }
    ]
  };

  const summary = FutureSemesterEngine.calculateFutureSemesterGPA(futureSemester);

  // Missing course must NOT dilute denominator or be treated as 0
  assert.equal(summary.coursesTotalCount, 2);
  assert.equal(summary.coursesCompletedCount, 1);
  assert.equal(summary.gpaEligibleCredits, 3, 'Eligible credits only includes scored course');
  assert.equal(summary.gpa4Raw, 3.0, 'GPA4 must be 3.0, not (3*3.0 + 2*0)/5 = 1.8');
  assert.equal(summary.gpa10Raw, 7.5, 'GPA10 must be 7.5, not (3*7.5 + 2*0)/5 = 4.5');
  assert.equal(summary.totalPlannedCredits, 5, 'Planned credits includes all courses');
  assert.equal(summary.earnedCredits, 3);
  assert.equal(summary.failedCredits, 0, 'Missing course is NOT failed/debt');
});

test('Future Summary Calculation: 3. Completely unscored future semester displays -- (not 0.0000)', () => {
  const futureSemester = {
    term: 1,
    startYear: 2026,
    endYear: 2027,
    courses: [
      {
        curriculumCourseCode: 'UNSCORED_1',
        courseName: 'Môn 1',
        credits: 3,
        score4Raw: null,
        score10Raw: null
      }
    ]
  };

  const summary = FutureSemesterEngine.calculateFutureSemesterGPA(futureSemester);
  assert.equal(summary.gpa4Raw, null);
  assert.equal(summary.gpa10Raw, null);
  assert.equal(summary.coursesCompletedCount, 0);

  const { doc, app } = setupTestEnvironment();
  app.store.addFutureSemester(futureSemester);

  const summaryRows = doc.querySelectorAll('.iuh-gpa-semester-summary-row');
  const row1Values = summaryRows[0].querySelectorAll('.iuh-gpa-future-summary-value');
  assert.equal(row1Values[0].textContent.trim(), '--', 'Empty GPA10 shows --');
  assert.equal(row1Values[1].textContent.trim(), '--', 'Empty GPA4 shows --');
});

test('Future Summary Calculation: 4. Cumulative projection uses raw totals without double rounding (Requirement 65)', () => {
  const actualCumulative = {
    gradedCredits: 100,
    sumWeighted4: 300.5,
    sumWeighted10: 750.25,
    gpa4Raw: 3.005,
    gpa10Raw: 7.5025
  };

  const futureSemesters = [
    {
      courses: [
        { credits: 3, score4Raw: 3.5, score10Raw: 8.2, isExcludedFromGpa: false },
        { credits: 2, score4Raw: 4.0, score10Raw: 9.0, isExcludedFromGpa: false }
      ]
    }
  ];

  const proj = FutureSemesterEngine.calculateProjectedCumulativeGPA(actualCumulative, futureSemesters);

  // Expected:
  // Points4 = 300.5 + (3*3.5 + 2*4.0) = 300.5 + 18.5 = 319.0
  // Credits = 100 + 5 = 105
  // GPA4 = 319.0 / 105 = 3.0380952...
  assert.ok(Math.abs(proj.gpa4Raw - (319.0 / 105)) < 1e-6);

  // Points10 = 750.25 + (3*8.2 + 2*9.0) = 750.25 + 42.6 = 792.85
  // Score10 = 792.85 / 105 = 7.550952...
  assert.ok(Math.abs(proj.gpa10Raw - (792.85 / 105)) < 1e-6);
  assert.equal(proj.cumulativeCredits, 105);
});

test('Future Summary Calculation: 5. Passed vs failed credits correctly tracked', () => {
  const futureSemester = {
    term: 1,
    startYear: 2026,
    endYear: 2027,
    courses: [
      { curriculumCourseCode: 'C1', credits: 3, score4Raw: 3.0, score10Raw: 7.0, isPassed: true },
      { curriculumCourseCode: 'C2', credits: 2, score4Raw: 0.0, score10Raw: 3.0, isPassed: false },
      { curriculumCourseCode: 'C3', credits: 4, score4Raw: null, score10Raw: null, isPassed: null }
    ]
  };

  const summary = FutureSemesterEngine.calculateFutureSemesterGPA(futureSemester);
  assert.equal(summary.earnedCredits, 3, 'Only C1 is earned (3 TC)');
  assert.equal(summary.failedCredits, 2, 'Only confirmed fail C2 is failed (2 TC)');
  assert.equal(summary.totalPlannedCredits, 9, 'All 3 courses are planned (9 TC)');
});
