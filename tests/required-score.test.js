const test = require('node:test');
const assert = require('node:assert/strict');
const {
  RequiredScoreEngine,
  GradeBoundaryAssistant,
  REQUIRED_SCORE_STATUS,
  ceilToStep,
} = require('../src/core/RequiredScoreEngine.js');
const { GradingRuleEngine } = require('../src/core/GradingRuleEngine.js');

test('ceilToStep: làm tròn lên theo bước 0.1 và xử lý IEEE-754 tolerance', () => {
  assert.equal(ceilToStep(7.20, 0.1), 7.2);
  assert.equal(ceilToStep(7.200000000000001, 0.1), 7.2);
  assert.equal(ceilToStep(7.21, 0.1), 7.3);
  assert.equal(ceilToStep(7.29, 0.1), 7.3);
  assert.equal(ceilToStep(7.30, 0.1), 7.3);
  assert.equal(ceilToStep(9.99, 0.1), 10.0);
  assert.equal(ceilToStep(null, 0.1), null);
});

test('RequiredScore: Lý thuyết 30/20/50 mục tiêu khả thi (ACHIEVABLE)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.THEORY;
  // midterm=7.0 (30% -> 2.1), regularAvg=8.0 (20% -> 1.6). Total quá trình = 3.7.
  // target = 7.0 (B). Cần cuối kỳ: (7.0 - 3.7) / 0.5 = 6.6
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: 7.0, regularAvg: 8.0 },
    targetScore10: 7.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.ACHIEVABLE);
  assert.equal(res.requiredScoreDisplay, 6.6);
  assert.equal(res.minimumSelectableScore, 6.6);
  assert.equal(res.adjustedByMinFinal, false);
});

test('RequiredScore: Lý thuyết 30/20/50 mục tiêu đã đạt (ALREADY_ACHIEVED)', () => {
  const rule = { ...GradingRuleEngine.COMPONENT_RULES.THEORY, minFinalExam: 0 };
  // midterm=9.0, regularAvg=9.0. Quá trình = 4.5. target = 4.0 (Qua môn). (4.0 - 4.5)/0.5 = -1 <= 0
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: 9.0, regularAvg: 9.0 },
    targetScore10: 4.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.ALREADY_ACHIEVED);
  assert.equal(res.requiredScoreRaw, 0);
  assert.equal(res.minimumSelectableScore, 0);
});

test('RequiredScore: Lý thuyết 30/20/50 mục tiêu không khả thi (IMPOSSIBLE > 10)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.THEORY;
  // midterm=4.0, regularAvg=5.0. Quá trình = 2.2. target = 8.5 (A).
  // Cần: (8.5 - 2.2) / 0.5 = 12.6 > 10
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: 4.0, regularAvg: 5.0 },
    targetScore10: 8.5,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.IMPOSSIBLE);
  assert.ok(res.requiredScoreRaw > 10);
});

test('RequiredScore: Điều chỉnh lên điểm liệt tối thiểu cuối kỳ (minFinalExam = 3.0)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.THEORY;
  // midterm=8.0, regularAvg=8.0. Quá trình = 4.0. target = 4.0 (Qua môn).
  // Toán học cần 0.0, nhưng có minFinalExam = 3.0 -> phải đạt >= 3.0
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: 8.0, regularAvg: 8.0 },
    targetScore10: 4.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.ACHIEVABLE);
  assert.equal(res.requiredScoreRaw, 3.0);
  assert.equal(res.minimumSelectableScore, 3.0);
  assert.equal(res.adjustedByMinFinal, true);
});

test('RequiredScore: Bị chặn bởi điều kiện điểm giữa kỳ = 0 (BLOCKED_BY_MINIMUM_CONDITION)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.THEORY;
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: 0, regularAvg: 9.0 },
    targetScore10: 5.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.BLOCKED_BY_MINIMUM_CONDITION);
  assert.equal(res.conditionId, 'MIDTERM_ZERO');
});

test('RequiredScore: Thiếu dữ liệu điểm quá trình (INSUFFICIENT_DATA)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.THEORY;
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: null, regularAvg: 8.0 },
    targetScore10: 7.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.INSUFFICIENT_DATA);
});

test('RequiredScore: Môn kết hợp Lý thuyết + Thực hành (COMBINED_THEORY_PRACTICE)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.COMBINED;
  // midterm=7.0, regularAvg=8.0 -> theoryProcess = 3.7
  // practiceAvg=7.0. target = 7.0.
  // Formula: 3*7.0 - 7.0 - 2*3.7 = 21 - 7 - 7.4 = 6.6
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: 7.0, regularAvg: 8.0, practiceAvg: 7.0 },
    targetScore10: 7.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.ACHIEVABLE);
  assert.equal(Math.round(res.requiredScoreRaw * 10) / 10, 6.6);
});

test('RequiredScore: Môn kết hợp thiếu điểm thực hành (INSUFFICIENT_DATA)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.COMBINED;
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { midterm: 7.0, regularAvg: 8.0, practiceAvg: null },
    targetScore10: 7.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.INSUFFICIENT_DATA);
});

test('RequiredScore: Môn đặc biệt chỉ tính điểm cuối kỳ (SPECIAL_FINAL_ONLY)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.SPECIAL;
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: {},
    targetScore10: 8.5,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.ACHIEVABLE);
  assert.equal(res.requiredScoreRaw, 8.5);
});

test('RequiredScore: Môn không có điểm thi kết thúc (NOT_APPLICABLE)', () => {
  const rule = GradingRuleEngine.COMPONENT_RULES.PRACTICE;
  const res = RequiredScoreEngine.calculateRequiredFinal({
    rule,
    scores: { practiceAvg: 8.0 },
    targetScore10: 8.0,
  });

  assert.equal(res.status, REQUIRED_SCORE_STATUS.NOT_APPLICABLE);
});

test('RequiredScore: Kiểm tra input không hợp lệ (INVALID_INPUT)', () => {
  const res1 = RequiredScoreEngine.calculateRequiredFinal(null);
  assert.equal(res1.status, REQUIRED_SCORE_STATUS.INVALID_INPUT);

  const res2 = RequiredScoreEngine.calculateRequiredFinal({
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    scores: { midterm: 7.0, regularAvg: 8.0 },
    targetScore10: -1,
  });
  assert.equal(res2.status, REQUIRED_SCORE_STATUS.INVALID_INPUT);

  const res3 = RequiredScoreEngine.calculateRequiredFinal({
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    scores: { midterm: 7.0, regularAvg: 8.0 },
    targetScore10: 11,
  });
  assert.equal(res3.status, REQUIRED_SCORE_STATUS.INVALID_INPUT);
});

test('RequiredScore: calculateAllTargets trả về danh sách tất cả các ngưỡng chuẩn', () => {
  const course = {
    courseCode: '001234',
    courseName: 'Lập trình Web',
    assessments: {
      midterm: { status: 'ok', value: 7.0 },
      regular: [{ status: 'ok', value: 8.0 }],
      practice: [],
    },
  };

  const targets = RequiredScoreEngine.calculateAllTargets(course);
  assert.ok(Array.isArray(targets));
  assert.ok(targets.length >= 8); // PASS, D, D+, C, C+, B, B+, A, A+
  assert.ok(targets.some(t => t.letter === 'A'));
  assert.ok(targets.some(t => t.letter === 'B'));
});

test('GradeBoundaryAssistant: Phân tích bậc điểm hiện tại và khoảng cách đến bậc kế tiếp', () => {
  // Điểm 6.8 (C+), bậc kế tiếp là B (7.0), thiếu 0.2 điểm
  const analysis = GradeBoundaryAssistant.analyzeBoundary({
    currentTotal10: 6.8,
  });

  assert.equal(analysis.currentLetter, 'C+');
  assert.equal(analysis.nextLetter, 'B');
  assert.equal(analysis.nextMin10, 7.0);
  assert.equal(analysis.deficit10, 0.2);
  assert.equal(analysis.isTopBand, false);

  // Điểm 9.5 (A+), là bậc cao nhất (Top band)
  const topAnalysis = GradeBoundaryAssistant.analyzeBoundary({
    currentTotal10: 9.5,
  });
  assert.equal(topAnalysis.currentLetter, 'A+');
  assert.equal(topAnalysis.isTopBand, true);
  assert.equal(topAnalysis.nextLetter, null);
  assert.equal(topAnalysis.deficit10, 0);
});
