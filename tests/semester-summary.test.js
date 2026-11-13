const test = require('node:test');
const assert = require('node:assert/strict');
const { SemesterSummaryEngine } = require('../src/core/SemesterSummaryEngine.js');

test('SemesterSummaryEngine: missing != fail (môn chưa có điểm KHÔNG bị tính là rớt)', () => {
  const courses = [
    {
      courseName: 'Môn Đạt',
      credits: 3,
      score10: 7.0,
      score4: 3.0,
      passed: true,
    },
    {
      courseName: 'Môn Chưa Có Điểm (Đang học)',
      credits: 4,
      score10: null,
      score4: null,
      passed: null,
    },
  ];

  const summary = SemesterSummaryEngine.summarizeSemester(courses);
  assert.equal(summary.totalCourses, 2);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.inProgressCount, 1);
  assert.equal(summary.earnedCredits, 3);
  // failedCredits phải là 0, không được gộp môn missing thành failed!
  assert.equal(summary.failedCredits, 0);
});

test('SemesterSummaryEngine: Loại trừ chính xác môn 0 tín chỉ khỏi GPA-eligible credits', () => {
  const courses = [
    {
      courseName: 'Môn 3 TC',
      credits: 3,
      score10: 8.0,
      score4: 3.5,
      passed: true,
    },
    {
      courseName: 'Môn 0 TC',
      credits: 0,
      score10: 9.0,
      score4: 4.0,
      passed: true,
    },
  ];

  const summary = SemesterSummaryEngine.summarizeSemester(courses);
  assert.equal(summary.totalCredits, 3);
  assert.equal(summary.eligibleCredits, 3);
  assert.equal(summary.gpa4Display, 3.5);
});

test('SemesterSummaryEngine: Phân bố điểm chữ (Grade Distribution) tự động theo band', () => {
  const courses = [
    { courseName: 'Môn 1', credits: 3, score10: 9.5, score4: 4.0, letter: 'A+', passed: true },
    { courseName: 'Môn 2', credits: 3, score10: 8.5, score4: 3.8, letter: 'A', passed: true },
    { courseName: 'Môn 3', credits: 2, score10: 7.0, score4: 3.0, letter: 'B', passed: true },
    { courseName: 'Môn 4', credits: 2, score10: 3.0, score4: 0.0, letter: 'F', passed: false },
  ];

  const summary = SemesterSummaryEngine.summarizeSemester(courses);
  assert.equal(summary.gradeDistribution['A+'], 1);
  assert.equal(summary.gradeDistribution['A'], 1);
  assert.equal(summary.gradeDistribution['B'], 1);
  assert.equal(summary.gradeDistribution['F'], 1);
  assert.equal(summary.gradeDistribution['C'], 0);
});

test('SemesterSummaryEngine: Môn có điểm cao nhất và thấp nhất trong kỳ (chỉ xét môn tính GPA)', () => {
  const courses = [
    { courseName: 'Môn Trung Bình', credits: 3, score10: 6.0, score4: 2.5, letter: 'C+' },
    { courseName: 'Môn Xuất Sắc', credits: 4, score10: 9.2, score4: 4.0, letter: 'A+' },
    { courseName: 'Môn Yếu', credits: 2, score10: 4.5, score4: 1.0, letter: 'D' },
    { courseName: 'Môn Chưa Điểm', credits: 3, score10: null, score4: null },
  ];

  const summary = SemesterSummaryEngine.summarizeSemester(courses);
  assert.ok(summary.highestCourse);
  assert.equal(summary.highestCourse.courseName, 'Môn Xuất Sắc');
  assert.equal(summary.highestCourse.score4, 4.0);

  assert.ok(summary.lowestCourse);
  assert.equal(summary.lowestCourse.courseName, 'Môn Yếu');
  assert.equal(summary.lowestCourse.score4, 1.0);
});

test('SemesterSummaryEngine: So sánh Dữ liệu gốc vs Mô phỏng hiện tại', () => {
  const origSummary = {
    gpa4Display: 3.00,
    gpa10Display: 7.20,
    earnedCredits: 15,
  };
  const simSummary = {
    gpa4Display: 3.35,
    gpa10Display: 7.80,
    earnedCredits: 18,
  };

  const comp = SemesterSummaryEngine.compareSemesterSummaries(origSummary, simSummary);
  assert.equal(comp.hasDelta, true);
  assert.equal(comp.gpa4Delta, 0.35);
  assert.equal(comp.gpa10Delta, 0.60);
  assert.equal(comp.earnedCreditsDelta, 3);
});
