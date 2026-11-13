const test = require('node:test');
const assert = require('node:assert/strict');
const { CurriculumProgressEngine } = require('../src/core/CurriculumProgressEngine.js');

test('Curriculum Progress: Verified Completed vs Projected Plan (131 vs 144)', () => {
  // Create 144 credits worth of courses:
  // 131 credits are completed and passed in transcript
  // 13 credits are incomplete/future
  const curriculumModel = {
    totalCredits: 144,
    courses: [
      { code: 'MATH101', courseName: 'Toán 1', credits: 131, isMandatory: true, countsTowardCumulativeGPA: true, passState: 'NOT_PASSED' },
      { code: 'PROJ401', courseName: 'Khóa luận', credits: 13, isMandatory: true, countsTowardCumulativeGPA: true, passState: 'NOT_PASSED' }
    ]
  };

  // Student has actually taken MATH101 and passed with 131 credits in transcript
  const gradeCourses = [
    { code: 'MATH101', courseName: 'Toán 1', credits: 131, isPassed: true, summaryScore: 8.0, isIgnored: false }
  ];

  // Future plan contains the remaining 13 credits
  const futurePlan = {
    semesters: [
      {
        courses: [
          { curriculumCourseCode: 'PROJ401', courseName: 'Khóa luận', credits: 13, isPassed: true }
        ]
      }
    ]
  };

  const result = CurriculumProgressEngine.calculateProgress(
    curriculumModel,
    gradeCourses,
    futurePlan,
    { officialCumulativeCredits: 131 }
  );

  // Verify Current Achievement metrics
  assert.equal(result.curriculumRequiredCredits, 144, 'Required credits must be 144');
  assert.equal(result.verifiedCurriculumCompletedCredits, 131, 'Current verified completed must be 131, NOT 144');
  assert.equal(result.curriculumRemainingCredits, 13, 'Current remaining credits must be 13');
  assert.ok(result.curriculumRemainingCredits > 0, 'Current must NOT be fully completed');

  // Verify Projected Plan metrics
  assert.equal(result.plannedCurriculumCredits, 13, 'Planned credits must be 13');
  assert.equal(result.projectedCurriculumCompletedCredits, 144, 'Projected completion after plan must be 144');
  assert.equal(result.curriculumRemainingAfterPlan, 0, 'Remaining after plan must be 0');

  // Verify plan does NOT inflate current completion
  assert.notEqual(result.verifiedCurriculumCompletedCredits, result.projectedCurriculumCompletedCredits, 'Current completion must remain distinct from projected plan');

  // Verify official transcript cumulative reconciliation
  assert.equal(result.officialTranscriptCumulativeCredits, 131);
  assert.equal(result.reconciliationStatus, 'MATCHED');
  assert.equal(result.reconciliationWarning, null);
});

test('Curriculum Progress: Plan does not mark courses as completed if not planned', () => {
  const curriculumModel = {
    totalCredits: 144,
    courses: [
      { code: 'C1', courseName: 'Môn 1', credits: 100, isMandatory: true, passState: 'NOT_PASSED' },
      { code: 'C2', courseName: 'Môn 2', credits: 31, isMandatory: true, passState: 'NOT_PASSED' },
      { code: 'C3', courseName: 'Môn 3', credits: 13, isMandatory: true, passState: 'NOT_PASSED' }
    ]
  };

  const gradeCourses = [
    { code: 'C1', credits: 100, isPassed: true },
    { code: 'C2', credits: 31, isPassed: true }
  ];

  // Empty future plan
  const result = CurriculumProgressEngine.calculateProgress(
    curriculumModel,
    gradeCourses,
    { semesters: [] },
    { officialCumulativeCredits: 131 }
  );

  assert.equal(result.verifiedCurriculumCompletedCredits, 131);
  assert.equal(result.projectedCurriculumCompletedCredits, 131);
  assert.equal(result.curriculumRemainingCredits, 13);
  assert.equal(result.curriculumRemainingAfterPlan, 13);
  assert.equal(result.plannedCurriculumCredits, 0);
});

test('Curriculum Progress: Official parsed cumulative credits cap verified CTK completion', () => {
  const curriculumModel = {
    totalCredits: 144,
    courses: [
      { code: 'C1', courseName: 'Môn 1', credits: 131, isMandatory: true, passState: 'NOT_PASSED' },
      { code: 'C2', courseName: 'Môn 2', credits: 13, isMandatory: true, passState: 'NOT_PASSED' }
    ]
  };
  const gradeData = [{
    courses: [
      { courseCode: 'C1', credits: 131, isPassed: true },
      { courseCode: 'C2', credits: 13, isPassed: true }
    ],
    officialSummary: {
      cumulativeCredits: { status: 'ok', value: 131, raw: '131' }
    }
  }];

  const result = CurriculumProgressEngine.calculateProgress(curriculumModel, gradeData);

  assert.equal(result.curriculumCalculatedCompletedCredits, 144);
  assert.equal(result.officialTranscriptCumulativeCredits, 131);
  assert.equal(result.curriculumCompletedCredits, 131);
  assert.equal(result.verifiedCurriculumCompletedCredits, 131);
  assert.equal(result.curriculumRemainingCredits, 13);
  assert.equal(result.reconciliationDifference, 13);
  assert.equal(result.reconciliationStatus, 'SIGNIFICANT_DISCREPANCY');
});
