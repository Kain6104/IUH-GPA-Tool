const test = require('node:test');
const assert = require('node:assert/strict');
const { FutureSemesterEngine } = require('../src/core/FutureSemesterEngine.js');
const { GPARescueEngine } = require('../src/core/GPARescueEngine.js');

test('Planner CTK Source: Course pool derives strictly from CTK with proper prioritization', () => {
  const curriculumModel = {
    totalCredits: 144,
    courses: [
      {
        code: 'MAND_1',
        courseName: 'Môn bắt buộc 1',
        credits: 3,
        isMandatory: true,
        requirementType: 'MANDATORY',
        semesterIndex: 8,
        countsTowardCumulativeGPA: true
      },
      {
        code: 'FAILED_1',
        courseName: 'Môn từng rớt',
        credits: 3,
        isMandatory: true,
        requirementType: 'MANDATORY',
        semesterIndex: 7,
        countsTowardCumulativeGPA: true
      },
      {
        code: 'ELEC_1',
        courseName: 'Môn tự chọn nhóm A',
        credits: 3,
        isElective: true,
        requirementType: 'ELECTIVE',
        electiveGroup: 'GROUP_A',
        semesterIndex: 8,
        countsTowardCumulativeGPA: true
      },
      {
        code: 'DONE_1',
        courseName: 'Môn đã hoàn thành',
        credits: 3,
        isMandatory: true,
        requirementType: 'MANDATORY',
        semesterIndex: 1,
        countsTowardCumulativeGPA: true
      }
    ],
    electiveGroups: [
      {
        id: 'GROUP_A',
        name: 'Nhóm tự chọn A',
        requiredCredits: 6,
        courseCodes: ['ELEC_1']
      }
    ]
  };

  const gradeCourses = [
    { code: 'DONE_1', curriculumCourseCode: 'DONE_1', credits: 3, isPassed: true, score10: 8.0 },
    { code: 'FAILED_1', curriculumCourseCode: 'FAILED_1', credits: 3, isPassed: false, score10: 3.0 }
  ];

  const futurePlan = { semesters: [] };

  const pool = FutureSemesterEngine.getCoursePool(curriculumModel, gradeCourses, futurePlan);

  // 1. Completed courses must be filtered out of available pool
  assert.equal(pool.completed.some(c => c.code === 'DONE_1'), true, 'DONE_1 is marked completed');
  assert.equal(pool.allAvailable.some(c => c.code === 'DONE_1'), false, 'DONE_1 must not be in available pool');

  // 2. Mandatory remaining includes MAND_1
  assert.equal(pool.mandatoryRemaining.some(c => c.code === 'MAND_1'), true, 'MAND_1 in mandatoryRemaining');

  // 3. Failed courses includes FAILED_1
  assert.equal(pool.failedRetake.some(c => c.code === 'FAILED_1'), true, 'FAILED_1 in failedRetake');

  // 4. Unsatisfied elective groups includes ELEC_1
  assert.equal(pool.electiveRemaining.some(c => c.code === 'ELEC_1'), true, 'ELEC_1 in electiveRemaining');

  // 5. Preserves curriculum semester metadata
  const mand = pool.allAvailable.find(c => c.code === 'MAND_1');
  assert.ok(mand, 'MAND_1 in allAvailable');
  assert.equal(mand.semesterIndex, 8, 'Preserves semesterIndex 8 for scheduling recommendation');
});

test('GPA Rescue Engine: Excludes courses with countsTowardCumulativeGPA === false from rescue ranking', () => {
  const courses = [
    {
      id: 'c_gpa_low',
      courseCode: 'MATH101',
      code: 'MATH101',
      courseName: 'Toán cao cấp',
      credits: 3,
      score4: 1.5,
      countsTowardCumulativeGPA: true,
      hasAsterisk: false,
      isPassed: true
    },
    {
      id: 'c_gdqp',
      courseCode: 'GDQP01',
      code: 'GDQP01',
      courseName: 'Giáo dục quốc phòng',
      credits: 4,
      score4: 1.0,
      countsTowardCumulativeGPA: false,
      hasAsterisk: false,
      isPassed: true
    },
    {
      id: 'c_gdtc_asterisk',
      courseCode: 'GDTC01',
      code: 'GDTC01',
      courseName: 'Giáo dục thể chất',
      credits: 2,
      score4: 1.0,
      countsTowardCumulativeGPA: true,
      hasAsterisk: true,
      isPassed: true
    }
  ];

  const analysis = GPARescueEngine.analyzeRescuePriorities({
    courses,
    currentTotalGradePoints: 280,
    eligibleCredits: 100,
    defaultTargetLetter: 'A'
  });

  const rankedCodes = (analysis.rankedCourses || []).map(r => r.courseCode || r.code);

  assert.ok(rankedCodes.includes('MATH101'), 'MATH101 is eligible for rescue');
  assert.equal(rankedCodes.includes('GDQP01'), false, 'GDQP01 (countsTowardCumulativeGPA: false) must be excluded from rescue');
  assert.equal(rankedCodes.includes('GDTC01'), false, 'GDTC01 (hasAsterisk: true) must be excluded from rescue');
});
