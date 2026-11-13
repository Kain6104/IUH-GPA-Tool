const test = require('node:test');
const assert = require('node:assert/strict');
const { GPATargetEngine, TARGET_STATUS } = require('../src/core/GPATargetEngine.js');

test('GPATargetEngine: Mục tiêu bình thường khả thi (ACHIEVABLE)', () => {
  // currentGradePoints = 3.12 * 75 = 234.0, target = 3.40, remaining = 45
  // required = (3.40 * 120 - 234) / 45 = (408 - 234) / 45 = 174 / 45 = 3.8666...
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 234.0,
    currentCredits: 75,
    targetGPA: 3.40,
    remainingCredits: 45,
  });

  assert.equal(res.status, TARGET_STATUS.ACHIEVABLE);
  assert.equal(res.requiredFutureAverageDisplay, 3.87);
  assert.equal(res.difficulty.code, 'VERY_HIGH');
  assert.equal(res.difficulty.label, 'Yêu cầu gần mức tối đa');
});

test('GPATargetEngine: Mục tiêu đã đạt (ALREADY_MET)', () => {
  // currentGradePoints = 3.5 * 100 = 350, target = 3.0, remaining = 10
  // required = (3.0 * 110 - 350) / 10 = (330 - 350) / 10 = -2.0 <= 0
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 350.0,
    currentCredits: 100,
    targetGPA: 3.0,
    remainingCredits: 10,
  });

  assert.equal(res.status, TARGET_STATUS.ALREADY_MET);
  assert.equal(res.requiredFutureAverageDisplay, 0.0);
  assert.equal(res.difficulty.code, 'MET');
});

test('GPATargetEngine: Mục tiêu không khả thi vượt quá 4.0 (IMPOSSIBLE)', () => {
  // currentGradePoints = 2.0 * 100 = 200, target = 3.8, remaining = 20
  // required = (3.8 * 120 - 200) / 20 = (456 - 200) / 20 = 256 / 20 = 12.8 > 4.0
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 200.0,
    currentCredits: 100,
    targetGPA: 3.8,
    remainingCredits: 20,
  });

  assert.equal(res.status, TARGET_STATUS.IMPOSSIBLE);
  assert.equal(res.requiredFutureAverageDisplay, 12.8);
  assert.equal(res.difficulty.code, 'EXCEEDED');
});

test('GPATargetEngine: Tín chỉ còn lại bằng 0 (remainingCredits = 0)', () => {
  // Case A: Đã đạt (currentGPA >= target)
  const resA = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 320.0,
    currentCredits: 100,
    targetGPA: 3.20,
    remainingCredits: 0,
  });
  assert.equal(resA.status, TARGET_STATUS.ALREADY_MET);

  // Case B: Không thể đạt (currentGPA < target)
  const resB = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 300.0,
    currentCredits: 100,
    targetGPA: 3.20,
    remainingCredits: 0,
  });
  assert.equal(resB.status, TARGET_STATUS.IMPOSSIBLE);
});

test('GPATargetEngine: Tín chỉ hiện tại bằng 0 (currentCredits = 0)', () => {
  // currentCredits = 0, remaining = 50, target = 3.5
  // required = (3.5 * 50 - 0) / 50 = 3.5
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 0,
    currentCredits: 0,
    targetGPA: 3.5,
    remainingCredits: 50,
  });

  assert.equal(res.status, TARGET_STATUS.ACHIEVABLE);
  assert.equal(res.requiredFutureAverageDisplay, 3.5);
  assert.equal(res.difficulty.code, 'HIGH');
});

test('GPATargetEngine: Ranh giới chính xác 4.0 (Exact boundary 4.0)', () => {
  // Cần đúng 4.0
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 3.0 * 50,
    currentCredits: 50,
    targetGPA: 3.5,
    remainingCredits: 50,
  });

  // (3.5 * 100 - 150) / 50 = (350 - 150) / 50 = 4.0
  assert.equal(res.status, TARGET_STATUS.ACHIEVABLE);
  assert.equal(res.requiredFutureAverageDisplay, 4.0);
  assert.equal(res.difficulty.code, 'VERY_HIGH');
});

test('GPATargetEngine: Target bằng 0 (target = 0)', () => {
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 100.0,
    currentCredits: 50,
    targetGPA: 0.0,
    remainingCredits: 30,
  });

  assert.equal(res.status, TARGET_STATUS.ALREADY_MET);
  assert.equal(res.requiredFutureAverageDisplay, 0.0);
});

test('GPATargetEngine: Giữ nguyên Full Precision không làm tròn sớm', () => {
  // current GPA = 3.176923076923077 (206.5 / 65)
  // target = 3.35, remaining = 35. totalCredits = 100
  // required = (3.35 * 100 - 206.5) / 35 = (335 - 206.5) / 35 = 128.5 / 35 = 3.6714285714285714
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 206.5,
    currentCredits: 65,
    targetGPA: 3.35,
    remainingCredits: 35,
  });

  assert.equal(res.status, TARGET_STATUS.ACHIEVABLE);
  assert.equal(res.requiredFutureAverageRaw, 128.5 / 35);
  assert.notEqual(res.requiredFutureAverageRaw, 3.67);
  assert.equal(res.requiredFutureAverageDisplay, 3.67);
});

test('GPATargetEngine: Xử lý tín chỉ âm (invalid negative credits)', () => {
  const res = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 200,
    currentCredits: 60,
    targetGPA: 3.2,
    remainingCredits: -10,
  });

  assert.equal(res.status, TARGET_STATUS.INVALID_INPUT);
});

test('GPATargetEngine: Xử lý GPA mục tiêu không hợp lệ > 4.0 hoặc < 0', () => {
  const res1 = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 200,
    currentCredits: 60,
    targetGPA: 4.5,
    remainingCredits: 30,
  });
  assert.equal(res1.status, TARGET_STATUS.INVALID_INPUT);

  const res2 = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: 200,
    currentCredits: 60,
    targetGPA: -0.5,
    remainingCredits: 30,
  });
  assert.equal(res2.status, TARGET_STATUS.INVALID_INPUT);
});
