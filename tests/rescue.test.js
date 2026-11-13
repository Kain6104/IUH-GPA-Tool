const test = require('node:test');
const assert = require('node:assert/strict');
const { GPARescueEngine, RETAKE_DISCLAIMER } = require('../src/core/GPARescueEngine.js');

test('GPARescueEngine: Môn 4 tín chỉ điểm thấp xếp trên môn 1 tín chỉ điểm thấp hơn (Delta-based ranking)', () => {
  // Course A: 4 TC, điểm D (1.0). Nâng lên B+ (3.5) -> deltaGradePoints = (3.5 - 1.0) * 4 = 10.0
  // Course B: 1 TC, điểm F (0.0). Nâng lên B+ (3.5) -> deltaGradePoints = (3.5 - 0.0) * 1 = 3.5
  // Tổng tín chỉ tích lũy: 50 TC
  const courses = [
    {
      id: 'c_b',
      courseCode: '001',
      courseName: 'Môn 1 TC điểm F',
      credits: 1,
      score4: 0.0,
      gradeLetter: 'F',
      countsTowardGPA: true,
    },
    {
      id: 'c_a',
      courseCode: '002',
      courseName: 'Môn 4 TC điểm D',
      credits: 4,
      score4: 1.0,
      gradeLetter: 'D',
      countsTowardGPA: true,
    },
  ];

  const analysis = GPARescueEngine.analyzeRescuePriorities({
    courses,
    currentTotalGradePoints: 120.0,
    eligibleCredits: 50,
    defaultTargetLetter: 'B+',
  });

  assert.equal(analysis.status, 'OK');
  assert.equal(analysis.rankedCourses.length, 2);
  // Course A (4 TC) phải đứng đầu vì GPA Delta lớn hơn (+0.200 vs +0.070)
  assert.equal(analysis.rankedCourses[0].courseId, 'c_a');
  assert.equal(analysis.rankedCourses[0].gpaDeltaDisplay, 0.2);
  assert.equal(analysis.rankedCourses[1].courseId, 'c_b');
  assert.equal(analysis.rankedCourses[1].gpaDeltaDisplay, 0.07);
});

test('GPARescueEngine: Mục tiêu B vs A tạo ra delta khác nhau chính xác', () => {
  const course = {
    id: 'c1',
    courseCode: 'CS101',
    courseName: 'Cấu trúc dữ liệu',
    credits: 4,
    score4: 2.0, // C (2.0)
    gradeLetter: 'C',
    countsTowardGPA: true,
  };

  // Mục tiêu B (3.0): delta = (3.0 - 2.0) * 4 = 4.0 / 80 = 0.05
  const impactB = GPARescueEngine.calculateSingleCourseImpact({
    credits: 4,
    currentGradePoint: 2.0,
    targetGradePoint: 3.0,
    currentTotalGradePoints: 200,
    eligibleCredits: 80,
  });
  assert.equal(impactB.deltaGradePoints, 4.0);
  assert.equal(impactB.gpaDeltaDisplay, 0.05);

  // Mục tiêu A (3.8): delta = (3.8 - 2.0) * 4 = 7.2 / 80 = 0.09
  const impactA = GPARescueEngine.calculateSingleCourseImpact({
    credits: 4,
    currentGradePoint: 2.0,
    targetGradePoint: 3.8,
    currentTotalGradePoints: 200,
    eligibleCredits: 80,
  });
  assert.ok(Math.abs(impactA.deltaGradePoints - 7.2) < 1e-9);
  assert.equal(impactA.gpaDeltaDisplay, 0.09);
});

test('GPARescueEngine: Loại trừ nghiêm ngặt môn 0 tín chỉ, missing grade, môn không tính GPA', () => {
  const courses = [
    {
      id: 'c_zero',
      courseName: 'Môn 0 TC',
      credits: 0,
      score4: 3.0,
      countsTowardGPA: true,
    },
    {
      id: 'c_no_gpa',
      courseName: 'Giáo dục quốc phòng',
      credits: 3,
      score4: 3.5,
      countsTowardGPA: false,
    },
    {
      id: 'c_missing',
      courseName: 'Môn đang học chưa có điểm',
      credits: 3,
      score4: null,
      countsTowardGPA: true,
    },
    {
      id: 'c_valid',
      courseName: 'Môn hợp lệ',
      credits: 3,
      score4: 2.0,
      gradeLetter: 'C',
      countsTowardGPA: true,
    },
  ];

  const analysis = GPARescueEngine.analyzeRescuePriorities({
    courses,
    currentTotalGradePoints: 150,
    eligibleCredits: 60,
    defaultTargetLetter: 'B+',
  });

  assert.equal(analysis.rankedCourses.length, 1);
  assert.equal(analysis.rankedCourses[0].courseId, 'c_valid');
  assert.equal(analysis.excludedCourses.length, 3);
  assert.ok(analysis.excludedCourses.some(e => e.courseId === 'c_zero'));
  assert.ok(analysis.excludedCourses.some(e => e.courseId === 'c_no_gpa'));
  assert.ok(analysis.excludedCourses.some(e => e.courseId === 'c_missing'));
});

test('GPARescueEngine: Giữ nguyên full precision không làm tròn sớm trong xếp hạng', () => {
  const courses = [
    {
      id: 'c1',
      courseName: 'Môn 1',
      credits: 3,
      score4: 1.5,
      countsTowardGPA: true,
    },
  ];

  // deltaGradePoints = (3.5 - 1.5) * 3 = 6.0
  // eligibleCredits = 77
  // gpaDeltaRaw = 6.0 / 77 = 0.07792207792207792
  const analysis = GPARescueEngine.analyzeRescuePriorities({
    courses,
    currentTotalGradePoints: 231.5,
    eligibleCredits: 77,
    defaultTargetLetter: 'B+',
  });

  const c1 = analysis.rankedCourses[0];
  assert.equal(c1.gpaDeltaRaw, 6.0 / 77);
  assert.equal(c1.gpaDeltaDisplay, 0.078);
});

test('GPARescueEngine: Bắt buộc có Retake Disclaimer rõ ràng', () => {
  const analysis = GPARescueEngine.analyzeRescuePriorities({
    courses: [],
    currentTotalGradePoints: 100,
    eligibleCredits: 40,
  });

  assert.equal(analysis.disclaimer, RETAKE_DISCLAIMER);
  assert.ok(analysis.disclaimer.includes('mô phỏng tác động toán học'));
  assert.ok(analysis.disclaimer.includes('không thay thế quy định học lại/học cải thiện chính thức'));
});
