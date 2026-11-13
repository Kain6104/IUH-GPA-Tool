const test = require('node:test');
const assert = require('node:assert/strict');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { GPATargetEngine, TARGET_STATUS } = require('../src/core/GPATargetEngine.js');
const { ForecastEngine } = require('../src/core/ForecastEngine.js');
const { GPARescueEngine } = require('../src/core/GPARescueEngine.js');

test('Phase 4 Integration: Thay đổi điểm cuối kỳ Phase 3 cập nhật liên hoàn Target, Forecast và Rescue mà KHÔNG reparse DOM', () => {
  // Mock dữ liệu ban đầu
  const initialData = [
    {
      semesterKey: 'HK1',
      semesterName: 'Học kỳ 1 (2023-2024)',
      courses: [
        {
          id: 'course_1',
          courseClassCode: '4203001',
          courseName: 'Cấu trúc dữ liệu và giải thuật',
          credits: { status: 'ok', value: 4 },
          assessments: {
            midterm: { status: 'ok', value: 7.0 },
            regular: [{ status: 'ok', value: 7.0 }],
            practice: [],
            finalExam: { status: 'ok', value: 3.0 }, // Ban đầu thi được 3.0 -> tổng kết = 5.0 (D+ -> 1.5)
          },
          officialResult: {
            total10: { status: 'ok', value: 5.0 },
            score4: { status: 'ok', value: 1.5 },
            letter: 'D+',
            classification: 'Trung bình yếu',
            passed: true,
          },
        },
        {
          id: 'course_2',
          courseClassCode: '4203002',
          courseName: 'Lập trình hướng đối tượng',
          credits: { status: 'ok', value: 3 },
          assessments: {
            midterm: { status: 'ok', value: 8.0 },
            regular: [{ status: 'ok', value: 8.0 }],
            practice: [],
            finalExam: { status: 'ok', value: 8.0 },
          },
          officialResult: {
            total10: { status: 'ok', value: 8.0 },
            score4: { status: 'ok', value: 3.5 },
            letter: 'B+',
            classification: 'Khá',
            passed: true,
          },
        },
      ],
    },
  ];

  const store = new SimulationStore(initialData);

  // 1. Initial baseline calculation
  const baseDerived = store.getDerivedData();
  const baseGradePoints = baseDerived.overallSimulated.sumWeighted4; // 4*1.5 + 3*3.5 = 6.0 + 10.5 = 16.5
  const baseCredits = baseDerived.overallSimulated.gradedCredits; // 7

  assert.equal(baseCredits, 7);
  assert.equal(baseGradePoints, 16.5);

  // Initial Target Planner: muốn GPA 3.20 với 30 tín chỉ còn lại
  const targetInitial = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: baseGradePoints,
    currentCredits: baseCredits,
    targetGPA: 3.20,
    remainingCredits: 30,
  });
  // (3.20 * 37 - 16.5) / 30 = (118.4 - 16.5) / 30 = 101.9 / 30 = 3.3966... -> 3.40
  assert.equal(targetInitial.status, TARGET_STATUS.ACHIEVABLE);
  assert.equal(targetInitial.requiredFutureAverageDisplay, 3.40);

  // Initial Forecast: với 30 tín chỉ còn lại đạt 3.0
  const forecastInitial = ForecastEngine.calculateProjectedGPA({
    currentGradePoints: baseGradePoints,
    currentCredits: baseCredits,
    futureAverage: 3.0,
    remainingCredits: 30,
  });
  // (16.5 + 30 * 3.0) / 37 = 106.5 / 37 = 2.878... -> 2.88
  assert.equal(forecastInitial.projectedGPADisplay, 2.88);

  // Initial Rescue: Course 1 (D+, 4 TC) phải có delta tiềm năng lớn nhất
  const rescueInitial = GPARescueEngine.analyzeRescuePriorities({
    courses: baseDerived.allSimulatedCourses,
    currentTotalGradePoints: baseGradePoints,
    eligibleCredits: baseCredits,
    defaultTargetLetter: 'B+',
  });
  assert.equal(rescueInitial.rankedCourses[0].courseId, 'course_1');
  assert.equal(rescueInitial.rankedCourses[0].currentLetter, 'D+');

  // 2. User simulates Course 1 final exam in Phase 3 slider: 3.0 -> 9.0
  // Với 9.0 final exam: 7*0.3 + 7*0.2 + 9*0.5 = 2.1 + 1.4 + 4.5 = 8.0 (B+ -> 3.5)
  store.setCourseOverride('course_1', { finalExam: 9.0 });

  // 3. Store recomputes without DOM interaction
  const updatedDerived = store.getDerivedData();
  const updatedGradePoints = updatedDerived.overallSimulated.sumWeighted4; // 4*3.5 + 3*3.5 = 14.0 + 10.5 = 24.5
  const updatedCredits = updatedDerived.overallSimulated.gradedCredits; // 7

  assert.equal(updatedCredits, 7);
  assert.equal(updatedGradePoints, 24.5);

  // 4. Target Planner recomputes with updated raw grade points
  const targetUpdated = GPATargetEngine.calculateRequiredFutureGPA({
    currentGradePoints: updatedGradePoints,
    currentCredits: updatedCredits,
    targetGPA: 3.20,
    remainingCredits: 30,
  });
  // (3.20 * 37 - 24.5) / 30 = (118.4 - 24.5) / 30 = 93.9 / 30 = 3.13
  assert.equal(targetUpdated.status, TARGET_STATUS.ACHIEVABLE);
  assert.equal(targetUpdated.requiredFutureAverageDisplay, 3.13); // Giảm từ 3.40 xuống 3.13!

  // 5. Forecast recomputes
  const forecastUpdated = ForecastEngine.calculateProjectedGPA({
    currentGradePoints: updatedGradePoints,
    currentCredits: updatedCredits,
    futureAverage: 3.0,
    remainingCredits: 30,
  });
  // (24.5 + 30 * 3.0) / 37 = 114.5 / 37 = 3.0945... -> 3.09
  assert.equal(forecastUpdated.projectedGPADisplay, 3.09); // Tăng từ 2.88 lên 3.09!

  // 6. Rescue recomputes: Course 1 bây giờ là B+ (3.5), không còn là D+ nữa!
  const rescueUpdated = GPARescueEngine.analyzeRescuePriorities({
    courses: updatedDerived.allSimulatedCourses,
    currentTotalGradePoints: updatedGradePoints,
    eligibleCredits: updatedCredits,
    defaultTargetLetter: 'B+',
  });
  // Vì cả course_1 và course_2 đều đã là B+, target B+ không còn upgrade option nào cho B+
  // nhưng option lên A (3.8) hoặc A+ (4.0) vẫn có
  assert.ok(rescueUpdated.rankedCourses.every(c => c.currentLetter === 'B+'));
});
