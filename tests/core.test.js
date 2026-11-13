/**
 * tests/core.test.js
 * Unit tests cho GPAEngine và GradingRuleEngine
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { GPAEngine } = require('../src/core/GPAEngine.js');
const { GradingRuleEngine } = require('../src/core/GradingRuleEngine.js');

test('GradingRuleEngine: Quy đổi thang 10 sang Thang 4 & Điểm chữ chính xác', () => {
  // Điểm tối đa
  const aPlus = GradingRuleEngine.convertScore10(10.0);
  assert.equal(aPlus.letter, 'A+');
  assert.equal(aPlus.gradePoint, 4.0);
  assert.equal(aPlus.passed, true);

  // Boundary 8.5
  const a = GradingRuleEngine.convertScore10(8.5);
  assert.equal(a.letter, 'A');
  assert.equal(a.gradePoint, 3.8);

  // Boundary 8.49
  const bPlus = GradingRuleEngine.convertScore10(8.49);
  assert.equal(bPlus.letter, 'B+');
  assert.equal(bPlus.gradePoint, 3.5);

  // Điểm D (qua môn thấp nhất)
  const d = GradingRuleEngine.convertScore10(4.0);
  assert.equal(d.letter, 'D');
  assert.equal(d.gradePoint, 1.0);
  assert.equal(d.passed, true);

  // Điểm rớt (F)
  const f = GradingRuleEngine.convertScore10(3.9);
  assert.equal(f.letter, 'F');
  assert.equal(f.gradePoint, 0.0);
  assert.equal(f.passed, false);

  // Điểm 0 (F)
  const zero = GradingRuleEngine.convertScore10(0.0);
  assert.equal(zero.letter, 'F');
  assert.equal(zero.gradePoint, 0.0);
  assert.equal(zero.passed, false);
});

test('GradingRuleEngine: Điểm liệt thi kết thúc học phần', () => {
  assert.equal(GradingRuleEngine.isFinalExamFailed(2.5, 3.0), true);
  assert.equal(GradingRuleEngine.isFinalExamFailed(3.0, 3.0), false);
  assert.equal(GradingRuleEngine.isFinalExamFailed(null, 3.0), false);
});

test('GPAEngine: Tính điểm trung bình trọng số chuẩn xác', () => {
  const courses = [
    { id: 'c1', credits: 3, score10: 8.0, score4: 3.5 },
    { id: 'c2', credits: 2, score10: 6.0, score4: 2.5 },
  ];

  // Expected 10: (8.0*3 + 6.0*2) / 5 = (24 + 12) / 5 = 7.20
  // Expected 4: (3.5*3 + 2.5*2) / 5 = (10.5 + 5.0) / 5 = 3.10
  const result = GPAEngine.calculateGPA(courses);

  assert.equal(result.gpa10, 7.20);
  assert.equal(result.gpa4, 3.10);
  assert.equal(result.totalCredits, 5);
  assert.equal(result.earnedCredits, 5);
  assert.equal(result.failedCredits, 0);
  assert.equal(result.classification4, 'Khá');
});

test('GPAEngine: Xử lý NGHIÊM NGẶT điểm 0 vs missing', () => {
  // Điểm 0: là điểm thật, PHẢI kéo tụt GPA xuống
  const coursesWithZero = [
    { id: 'c1', credits: 3, score10: 8.0, score4: 3.5 },
    { id: 'c2', credits: 3, score10: 0.0, score4: 0.0 }, // Điểm 0
  ];
  const resZero = GPAEngine.calculateGPA(coursesWithZero);
  // Expected 10: (8.0*3 + 0*3) / 6 = 4.00
  assert.equal(resZero.gpa10, 4.00);
  assert.equal(resZero.totalCredits, 6);
  assert.equal(resZero.earnedCredits, 3);
  assert.equal(resZero.failedCredits, 3);

  // Điểm missing (null): môn đang học hoặc chưa có điểm, KHÔNG ĐƯỢC tính vào điểm trung bình
  const coursesWithMissing = [
    { id: 'c1', credits: 3, score10: 8.0, score4: 3.5 },
    { id: 'c2', credits: 3, score10: null, score4: null }, // Chưa có điểm
  ];
  const resMissing = GPAEngine.calculateGPA(coursesWithMissing);
  // Expected 10: (8.0*3) / 3 = 8.00 (môn c2 chưa có điểm không được tính là 0)
  assert.equal(resMissing.gpa10, 8.00);
  assert.equal(resMissing.totalCredits, 6);
  assert.equal(resMissing.gradedCredits, 3);
  assert.equal(resMissing.earnedCredits, 3);
  assert.equal(resMissing.failedCredits, 0);
});

test('GPAEngine: Môn 0 tín chỉ hoặc môn loại trừ không gây chia cho 0', () => {
  const zeroCreditCourses = [
    { id: 'c1', credits: 0, score10: 9.0, score4: 4.0, isExcludedFromGpa: true },
    { id: 'c2', credits: 0, score10: 8.0, score4: 3.5, isExcludedFromGpa: true },
  ];

  const result = GPAEngine.calculateGPA(zeroCreditCourses);
  assert.equal(result.gpa10, null, 'Không có tín chỉ tính điểm thì GPA là null, không phải NaN hay 0');
  assert.equal(result.gpa4, null);
  assert.equal(result.totalCredits, 0);
  assert.equal(result.gradedCredits, 0);
});

test('GPAEngine: Retake policy (học cải thiện / học lại)', () => {
  const allCourses = [
    { id: 'att1', courseClassCode: 'MATH1', credits: 3, score10: 4.0, score4: 1.0 }, // Lần 1
    { id: 'att2', courseClassCode: 'MATH1', credits: 3, score10: 8.0, score4: 3.5 }, // Lần 2 (cải thiện)
    { id: 'phy', courseClassCode: 'PHY1', credits: 3, score10: 7.0, score4: 3.0 },
  ];

  // Highest: lấy điểm cao nhất của môn MATH1 (8.0)
  const cumHighest = GPAEngine.calculateCumulativeGPA(allCourses, { retakePolicy: 'highest' });
  // (8.0*3 + 7.0*3) / 6 = 7.50
  assert.equal(cumHighest.gpa10, 7.50);
  assert.equal(cumHighest.totalCredits, 6); // Đã gộp môn lặp lại

  // All: tính tất cả lần học
  const cumAll = GPAEngine.calculateCumulativeGPA(allCourses, { retakePolicy: 'all' });
  // (4.0*3 + 8.0*3 + 7.0*3) / 9 = 6.33
  assert.equal(cumAll.gpa10, 6.33);
  assert.equal(cumAll.totalCredits, 9);
});
