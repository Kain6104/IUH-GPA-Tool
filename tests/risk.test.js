const test = require('node:test');
const assert = require('node:assert/strict');
const { RiskEngine, RISK_CONFIG } = require('../src/core/RiskEngine.js');
const { GradingRuleEngine } = require('../src/core/GradingRuleEngine.js');

test('RiskEngine: 1. Mức điểm cần đạt thấp -> An toàn (SAFE)', () => {
  // Lý thuyết 30/20/50: midterm=8.0, regular=8.0 -> quá trình = 4.0. Target qua môn = 4.0.
  // minFinalExam = 3.0 -> Cần 3.0 (<= SAFE_MAX 5.0) -> SAFE
  const course = {
    courseName: 'Triết học Mác - Lênin',
    credits: 3,
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    assessments: {
      midterm: { status: 'ok', value: 8.0 },
      regular: [{ status: 'ok', value: 8.0 }],
      practice: [],
      finalExam: null, // Chưa thi
    },
  };

  const res = RiskEngine.assessCourseRisk(course);
  assert.equal(res.status, 'SAFE');
  assert.equal(res.label, 'An toàn');
  assert.equal(res.requiredScore, 3.0);
  assert.ok(res.reason.includes('An toàn'));
});

test('RiskEngine: 2. Mức điểm cần đạt vừa phải -> Cần chú ý (WATCH)', () => {
  // midterm=5.0, regular=5.0 -> quá trình = 2.5. Target = 5.5 (C).
  // Cần: (5.5 - 2.5) / 0.5 = 6.0 (5.0 < req <= 7.0) -> WATCH
  const course = {
    courseName: 'Toán cao cấp 1',
    credits: 3,
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    assessments: {
      midterm: { status: 'ok', value: 5.0 },
      regular: [{ status: 'ok', value: 5.0 }],
      practice: [],
      finalExam: null,
    },
  };

  const res = RiskEngine.assessCourseRisk(course, { targetScore10: 5.5 });
  assert.equal(res.status, 'WATCH');
  assert.equal(res.label, 'Cần chú ý');
  assert.equal(res.requiredScore, 6.0);
});

test('RiskEngine: 3. Mức điểm cần đạt cao -> Rủi ro cao (RISK)', () => {
  // midterm=5.0, regular=5.0 -> quá trình = 2.5. Target = 6.5 (C+).
  // Cần: (6.5 - 2.5) / 0.5 = 8.0 (7.0 < req <= 9.0) -> RISK
  const course = {
    courseName: 'Vật lý đại cương',
    credits: 3,
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    assessments: {
      midterm: { status: 'ok', value: 5.0 },
      regular: [{ status: 'ok', value: 5.0 }],
      practice: [],
      finalExam: null,
    },
  };

  const res = RiskEngine.assessCourseRisk(course, { targetScore10: 6.5 });
  assert.equal(res.status, 'RISK');
  assert.equal(res.label, 'Rủi ro cao');
  assert.equal(res.requiredScore, 8.0);
});

test('RiskEngine: 4. Mức điểm không thể đạt (> 10) -> Rất khó đạt (CRITICAL)', () => {
  // midterm=2.0, regular=2.0 -> quá trình = 1.0. Target = 7.0 (B).
  // Cần: (7.0 - 1.0) / 0.5 = 12.0 > 10 -> CRITICAL
  const course = {
    courseName: 'Giải tích 2',
    credits: 3,
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    assessments: {
      midterm: { status: 'ok', value: 2.0 },
      regular: [{ status: 'ok', value: 2.0 }],
      practice: [],
      finalExam: null,
    },
  };

  const res = RiskEngine.assessCourseRisk(course, { targetScore10: 7.0 });
  assert.equal(res.status, 'CRITICAL');
  assert.equal(res.label, 'Rất khó đạt');
  assert.ok(res.reason.includes('vượt quá 10.0'));
});

test('RiskEngine: 5. Bị chặn bởi điều kiện điểm giữa kỳ = 0 -> CRITICAL', () => {
  const course = {
    courseName: 'Xác suất thống kê',
    credits: 3,
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    assessments: {
      midterm: { status: 'ok', value: 0.0 }, // Điểm liệt giữa kỳ!
      regular: [{ status: 'ok', value: 9.0 }],
      practice: [],
      finalExam: null,
    },
  };

  const res = RiskEngine.assessCourseRisk(course);
  assert.equal(res.status, 'CRITICAL');
  assert.equal(res.conditionId, 'MIDTERM_ZERO');
  assert.ok(res.reason.includes('giữa kỳ') && (res.reason.includes('0') || res.reason.includes('bằng 0')));
});

test('RiskEngine: 6. Không xác định được rule -> UNKNOWN', () => {
  const course = {
    courseName: 'Môn lạ',
    credits: 2,
    rule: null,
    assessments: {},
  };

  // Rule null & name không khớp bất kỳ pattern nào
  const res = RiskEngine.assessCourseRisk(course, { ruleOverride: null });
  // Sẽ fallback detectRule hoặc trả về UNKNOWN nếu assessments rỗng
  assert.ok(res.status === 'UNKNOWN' || res.status === 'NOT_APPLICABLE');
});

test('RiskEngine: 7. Thiếu dữ liệu điểm quá trình -> UNKNOWN', () => {
  const course = {
    courseName: 'Nhập môn lập trình',
    credits: 3,
    rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
    assessments: {
      midterm: null, // Chưa có giữa kỳ
      regular: [],
      finalExam: null,
    },
  };

  const res = RiskEngine.assessCourseRisk(course);
  assert.equal(res.status, 'UNKNOWN');
  assert.equal(res.label, 'Chưa đủ dữ liệu');
});

test('RiskEngine: 8. Môn đã hoàn tất kết quả chính thức -> COMPLETED', () => {
  const course = {
    courseName: 'Kinh tế chính trị Mác - Lênin',
    credits: 2,
    score10: 7.5,
    officialResult: {
      total10: { status: 'ok', value: 7.5 },
      passed: true,
    },
    assessments: {
      finalExam: { status: 'ok', value: 7.0 },
    },
  };

  const res = RiskEngine.assessCourseRisk(course);
  assert.equal(res.status, 'COMPLETED');
  assert.equal(res.label, 'Đã có kết quả');
  assert.equal(res.isCompleted, true);
});

test('RiskEngine: 9. Môn 0 tín chỉ hoặc thực hành thuần -> NOT_APPLICABLE', () => {
  // Môn 0 tín chỉ
  const courseZero = {
    courseName: 'Sinh hoạt đầu khóa',
    credits: 0,
  };
  const resZero = RiskEngine.assessCourseRisk(courseZero);
  assert.equal(resZero.status, 'NOT_APPLICABLE');

  // Môn thực hành thuần (PRACTICE)
  const coursePractice = {
    courseName: 'Thực hành mạng máy tính',
    credits: 2,
    rule: GradingRuleEngine.COMPONENT_RULES.PRACTICE,
    assessments: {
      practice: [{ status: 'ok', value: 8.0 }],
      finalExam: null,
    },
  };
  const resPractice = RiskEngine.assessCourseRisk(coursePractice);
  assert.equal(resPractice.status, 'NOT_APPLICABLE');
});

test('RiskEngine: 10. Truy cập cấu hình heuristic tập trung (RISK_CONFIG)', () => {
  const cfg = RiskEngine.getConfig();
  assert.ok(cfg.THRESHOLDS);
  assert.equal(cfg.THRESHOLDS.SAFE_MAX, 5.0);
  assert.equal(cfg.THRESHOLDS.WATCH_MAX, 7.0);
  assert.equal(cfg.THRESHOLDS.RISK_MAX, 9.0);
});
