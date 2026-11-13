const test = require('node:test');
const assert = require('node:assert/strict');
const { ForecastEngine } = require('../src/core/ForecastEngine.js');

test('ForecastEngine: Dự báo với futureAverage = 0, 2.0, 3.0, 4.0', () => {
  const currentGradePoints = 240.0; // 80 tín chỉ * 3.0
  const currentCredits = 80;
  const remainingCredits = 20;

  // futureAvg = 0.0 -> (240 + 0) / 100 = 2.40
  const res0 = ForecastEngine.calculateProjectedGPA({
    currentGradePoints,
    currentCredits,
    futureAverage: 0.0,
    remainingCredits,
  });
  assert.equal(res0.status, 'OK');
  assert.equal(res0.projectedGPADisplay, 2.40);
  assert.equal(res0.classification, 'Trung bình');

  // futureAvg = 2.0 -> (240 + 40) / 100 = 2.80
  const res2 = ForecastEngine.calculateProjectedGPA({
    currentGradePoints,
    currentCredits,
    futureAverage: 2.0,
    remainingCredits,
  });
  assert.equal(res2.projectedGPADisplay, 2.80);
  assert.equal(res2.classification, 'Khá');

  // futureAvg = 3.0 -> (240 + 60) / 100 = 3.00
  const res3 = ForecastEngine.calculateProjectedGPA({
    currentGradePoints,
    currentCredits,
    futureAverage: 3.0,
    remainingCredits,
  });
  assert.equal(res3.projectedGPADisplay, 3.00);
  assert.equal(res3.classification, 'Khá');

  // futureAvg = 4.0 -> (240 + 80) / 100 = 3.20
  const res4 = ForecastEngine.calculateProjectedGPA({
    currentGradePoints,
    currentCredits,
    futureAverage: 4.0,
    remainingCredits,
  });
  assert.equal(res4.projectedGPADisplay, 3.20);
  assert.equal(res4.classification, 'Giỏi');
});

test('ForecastEngine: Trọng số tín chỉ khác nhau (different credit weights)', () => {
  // Kỳ cuối 5 tín chỉ vs 40 tín chỉ
  const currentGradePoints = 300.0;
  const currentCredits = 100;

  // Case 5 credits: tác động nhỏ
  const resSmall = ForecastEngine.calculateProjectedGPA({
    currentGradePoints,
    currentCredits,
    futureAverage: 4.0,
    remainingCredits: 5,
  });
  // (300 + 20) / 105 = 320 / 105 = 3.0476... -> 3.05
  assert.equal(resSmall.projectedGPADisplay, 3.05);

  // Case 50 credits: tác động lớn
  const resLarge = ForecastEngine.calculateProjectedGPA({
    currentGradePoints,
    currentCredits,
    futureAverage: 4.0,
    remainingCredits: 50,
  });
  // (300 + 200) / 150 = 500 / 150 = 3.3333... -> 3.33
  assert.equal(resLarge.projectedGPADisplay, 3.33);
});

test('ForecastEngine: Tín chỉ còn lại bằng 0 (remaining = 0)', () => {
  const res = ForecastEngine.calculateProjectedGPA({
    currentGradePoints: 250.0,
    currentCredits: 80,
    futureAverage: 3.5,
    remainingCredits: 0,
  });

  assert.equal(res.status, 'OK');
  assert.equal(res.projectedGPARaw, 250.0 / 80);
  assert.equal(res.projectedGPADisplay, 3.13);
  assert.equal(res.totalCredits, 80);
});

test('ForecastEngine: Giữ nguyên Raw Precision và không làm tròn sớm', () => {
  // 175.7 điểm trên 53 tín chỉ, còn lại 27 tín chỉ với GPA 3.4
  // (175.7 + 3.4 * 27) / (53 + 27) = (175.7 + 91.8) / 80 = 267.5 / 80 = 3.34375
  const res = ForecastEngine.calculateProjectedGPA({
    currentGradePoints: 175.7,
    currentCredits: 53,
    futureAverage: 3.4,
    remainingCredits: 27,
  });

  assert.equal(res.projectedGPARaw, 3.34375);
  assert.equal(res.projectedGPADisplay, 3.34);
});

test('ForecastEngine: generateForecastTable tạo bảng kịch bản không bị NaN', () => {
  const table = ForecastEngine.generateForecastTable({
    currentGradePoints: 210.5,
    currentCredits: 70,
    remainingCredits: 30,
  });

  assert.ok(Array.isArray(table));
  assert.equal(table.length, 7); // [2.0, 2.5, 3.0, 3.2, 3.5, 3.7, 4.0]
  for (const row of table) {
    assert.equal(row.status, 'OK');
    assert.ok(typeof row.projectedGPADisplay === 'number');
    assert.ok(!isNaN(row.projectedGPADisplay));
    assert.ok(typeof row.classification === 'string');
  }
});
