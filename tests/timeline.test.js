const test = require('node:test');
const assert = require('node:assert/strict');
const { TimelineEngine } = require('../src/core/TimelineEngine.js');

test('TimelineEngine: 1. Thứ tự học kỳ được bảo toàn theo đúng thứ tự mảng đầu vào', () => {
  const semesters = [
    { semesterKey: 'HK1', semesterName: 'Học kỳ 1', calculatedOriginalGPA: { gpa4: 3.0, gpa4Raw: 3.0, gradedCredits: 15, sumWeighted4: 45.0 } },
    { semesterKey: 'HK2', semesterName: 'Học kỳ 2', calculatedOriginalGPA: { gpa4: 3.5, gpa4Raw: 3.5, gradedCredits: 15, sumWeighted4: 52.5 } },
    { semesterKey: 'HK3', semesterName: 'Học kỳ 3', calculatedOriginalGPA: { gpa4: 2.8, gpa4Raw: 2.8, gradedCredits: 10, sumWeighted4: 28.0 } },
  ];

  const timeline = TimelineEngine.generateTimelineData(semesters);
  assert.equal(timeline.length, 3);
  assert.equal(timeline[0].semesterKey, 'HK1');
  assert.equal(timeline[1].semesterKey, 'HK2');
  assert.equal(timeline[2].semesterKey, 'HK3');
});

test('TimelineEngine: 2. Cumulative GPA được tính theo trọng số tích lũy, KHÔNG trung bình cộng GPA học kỳ', () => {
  // Kỳ 1: 10 tín chỉ GPA 4.0 -> sumWeighted = 40.0
  // Kỳ 2: 30 tín chỉ GPA 2.0 -> sumWeighted = 60.0
  // Nếu lấy trung bình cộng sai lầm: (4.0 + 2.0) / 2 = 3.00
  // Tính chuẩn xác trọng số: (40 + 60) / (10 + 30) = 100 / 40 = 2.50!
  const semesters = [
    {
      semesterKey: 'HK1',
      calculatedOriginalGPA: { gpa4: 4.0, gpa4Raw: 4.0, gradedCredits: 10, sumWeighted4: 40.0 },
    },
    {
      semesterKey: 'HK2',
      calculatedOriginalGPA: { gpa4: 2.0, gpa4Raw: 2.0, gradedCredits: 30, sumWeighted4: 60.0 },
    },
  ];

  const timeline = TimelineEngine.generateTimelineData(semesters);
  assert.equal(timeline[0].cumulativeOrigGPADisplay, 4.0);

  // Kỳ 2 tích lũy phải là 2.50, TUYỆT ĐỐI KHÔNG PHẢI 3.00
  assert.equal(timeline[1].cumulativeOrigGPADisplay, 2.50);
  assert.notEqual(timeline[1].cumulativeOrigGPADisplay, 3.00);
});

test('TimelineEngine: 3. Xử lý học kỳ chưa có dữ liệu điểm hoặc 0 tín chỉ', () => {
  const semesters = [
    {
      semesterKey: 'HK1',
      calculatedOriginalGPA: { gpa4: 3.2, gpa4Raw: 3.2, gradedCredits: 15, sumWeighted4: 48.0 },
    },
    {
      semesterKey: 'HK2', // Học kỳ mới đăng ký, chưa có điểm
      calculatedOriginalGPA: { gpa4: null, gpa4Raw: null, gradedCredits: 0, sumWeighted4: 0 },
    },
  ];

  const timeline = TimelineEngine.generateTimelineData(semesters);
  assert.equal(timeline[0].cumulativeOrigGPADisplay, 3.2);
  // Đến HK2: cumulative vẫn giữ nguyên từ HK1 vì HK2 chưa có tín chỉ có điểm
  assert.equal(timeline[1].cumulativeOrigGPADisplay, 3.2);
  assert.equal(timeline[1].semesterOrigGPADisplay, null);
});

test('TimelineEngine: 4. Phát hiện simulation delta giữa gốc và mô phỏng', () => {
  const semesters = [
    {
      semesterKey: 'HK1',
      calculatedOriginalGPA: { gpa4: 3.0, gpa4Raw: 3.0, gradedCredits: 10, sumWeighted4: 30.0 },
      calculatedSimulatedGPA: { gpa4: 3.8, gpa4Raw: 3.8, gradedCredits: 10, sumWeighted4: 38.0 },
    },
  ];

  const timeline = TimelineEngine.generateTimelineData(semesters);
  assert.equal(timeline[0].cumulativeOrigGPADisplay, 3.0);
  assert.equal(timeline[0].cumulativeSimGPADisplay, 3.8);
  assert.equal(timeline[0].hasSimulationDelta, true);
});

test('TimelineEngine: 5. computeSVGChartModel tạo mô hình hình học SVG hợp lệ', () => {
  const timelineData = [
    { semesterKey: 'HK1', semesterOrigGPADisplay: 3.0, cumulativeOrigGPADisplay: 3.0, cumulativeSimGPADisplay: 3.2 },
    { semesterKey: 'HK2', semesterOrigGPADisplay: 3.5, cumulativeOrigGPADisplay: 3.25, cumulativeSimGPADisplay: 3.4 },
  ];

  const model = TimelineEngine.computeSVGChartModel(timelineData, { width: 500, height: 200, padding: 30 });
  assert.equal(model.isEmpty, false);
  assert.equal(model.width, 500);
  assert.equal(model.height, 200);
  assert.ok(model.pathOrigCumulative.startsWith('M'));
  assert.ok(model.yGuides.length >= 4);
});
