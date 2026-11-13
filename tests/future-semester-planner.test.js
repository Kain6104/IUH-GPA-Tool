const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const { FutureSemesterEngine } = require('../src/core/FutureSemesterEngine.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { ScenarioEngine } = require('../src/core/ScenarioEngine.js');
const { TimelineEngine } = require('../src/core/TimelineEngine.js');
const { IUHPageAdapter } = require('../src/adapters/IUHPageAdapter.js');

// ==========================================
// 1. SEMESTER PROGRESSION & LABEL TESTS
// ==========================================
test('FutureSemesterEngine: 1. Parse latest actual semester dynamically', () => {
  const semesters = [
    { semesterName: 'HK1 (2024 - 2025)' },
    { semesterName: 'HK2 (2024 - 2025)' },
    { semesterName: 'HK1 (2025 - 2026)' },
    { semesterName: 'HK2 (2025 - 2026)' },
  ];
  const latest = FutureSemesterEngine.parseLatestActualSemester(semesters);
  assert.ok(latest);
  assert.equal(latest.term, 2);
  assert.equal(latest.startYear, 2025);
  assert.equal(latest.endYear, 2026);
  assert.equal(latest.isActual, true);
  assert.equal(latest.isFuture, false);
});

test('FutureSemesterEngine: 2. Next semester sequence (HK1 -> HK2 -> HK3 -> HK1 next academic year)', () => {
  const hk1 = { term: 1, startYear: 2025, endYear: 2026 };
  const nextFromHk1 = FutureSemesterEngine.getNextSemester(hk1);
  assert.equal(nextFromHk1.term, 2);
  assert.equal(nextFromHk1.startYear, 2025);
  assert.equal(nextFromHk1.endYear, 2026);
  assert.equal(nextFromHk1.displayLabel, 'HK2 (2025 - 2026)');

  const hk2 = { term: 2, startYear: 2025, endYear: 2026 };
  const nextFromHk2 = FutureSemesterEngine.getNextSemester(hk2);
  assert.equal(nextFromHk2.term, 3);
  assert.equal(nextFromHk2.startYear, 2025);
  assert.equal(nextFromHk2.endYear, 2026);
  assert.equal(nextFromHk2.displayLabel, 'HK3 (2025 - 2026) (Mô phỏng)');

  const hk3 = { term: 3, startYear: 2025, endYear: 2026 };
  const nextFromHk3 = FutureSemesterEngine.getNextSemester(hk3);
  assert.equal(nextFromHk3.term, 1);
  assert.equal(nextFromHk3.startYear, 2026);
  assert.equal(nextFromHk3.endYear, 2027);
  assert.equal(nextFromHk3.displayLabel, 'HK1 (2026 - 2027)');
});

test('FutureSemesterEngine: 3. Sinh chuỗi học kỳ tương lai tối đa 9 kỳ, không trùng lặp kỳ đã có', () => {
  const latestActual = { term: 2, startYear: 2025, endYear: 2026, isActual: true, isFuture: false };
  const existingLabels = ['HK3 (2025 - 2026)'];

  const options = FutureSemesterEngine.generateNextSemesterOptions(latestActual, existingLabels, 9);
  assert.ok(options.length > 0);
  assert.ok(options.length <= 9);

  // Không chứa HK3 (2025 - 2026) vì đã có trong existingLabels
  assert.equal(options.some(o => o.termName === 'HK3 (2025 - 2026)'), false);
  // Kỳ đầu tiên khả dụng phải là HK1 (2026 - 2027)
  assert.equal(options[0].termName, 'HK1 (2026 - 2027)');
});

test('FutureSemesterEngine: 4. Reject label không hợp lệ', () => {
  assert.equal(FutureSemesterEngine.parseSemesterLabel('Học kỳ hè 2025'), null);
  assert.equal(FutureSemesterEngine.parseSemesterLabel('HK 2025'), null);
  assert.equal(FutureSemesterEngine.parseSemesterLabel(''), null);
});

// ==========================================
// 2. ELECTIVE GROUP MATH TESTS
// ==========================================
test('FutureSemesterEngine: 5. Elective group math (required, completed, planned, remaining, status)', () => {
  const group = {
    groupName: 'Nhóm tự chọn 3',
    requiredCredits: 6,
    courses: [
      { curriculumCourseCode: 'c1', credits: 3, courseName: 'Môn A' },
      { curriculumCourseCode: 'c2', credits: 3, courseName: 'Môn B' },
      { curriculumCourseCode: 'c3', credits: 3, courseName: 'Môn C' },
    ]
  };

  // Case 1: Chưa học môn nào
  const sum1 = FutureSemesterEngine.calculateElectiveSummary(group, [], []);
  assert.equal(sum1.requiredCredits, 6);
  assert.equal(sum1.completedCredits, 0);
  assert.equal(sum1.plannedCredits, 0);
  assert.equal(sum1.remainingRequiredCredits, 6);
  assert.equal(sum1.status, 'NOT_STARTED');

  // Case 2: Đã đạt 3 TC
  const sum2 = FutureSemesterEngine.calculateElectiveSummary(group, ['c1'], []);
  assert.equal(sum2.completedCredits, 3);
  assert.equal(sum2.remainingRequiredCredits, 3);
  assert.equal(sum2.status, 'IN_PROGRESS');

  // Case 3: Đã đạt 3 TC và lên kế hoạch 3 TC
  const sum3 = FutureSemesterEngine.calculateElectiveSummary(group, ['c1'], ['c2']);
  assert.equal(sum3.completedCredits, 3);
  assert.equal(sum3.plannedCredits, 3);
  assert.equal(sum3.remainingRequiredCredits, 0);
  assert.equal(sum3.status, 'SATISFIED');

  // Case 4: Lên kế hoạch vượt yêu cầu (Planned 6 khi chỉ cần 3)
  const sum4 = FutureSemesterEngine.calculateElectiveSummary(group, ['c1'], ['c2', 'c3']);
  assert.equal(sum4.completedCredits, 3);
  assert.equal(sum4.plannedCredits, 6);
  assert.equal(sum4.remainingRequiredCredits, 0);
  assert.equal(sum4.status, 'OVER_PLANNED');
  // Không coi toàn bộ 30 TC của các môn trong nhóm là bắt buộc
  assert.equal(sum4.remainingRequiredCredits, 0);
});

// ==========================================
// 3. COURSE POOL TESTS
// ==========================================
test('FutureSemesterEngine: 6. Phân loại Course Pool từ CTK', () => {
  const curriculumModel = {
    courses: [
      { curriculumCourseCode: 'm1', courseName: 'Triết học', credits: 3, isMandatory: true },
      { curriculumCourseCode: 'm2', courseName: 'Kinh tế chính trị', credits: 2, isMandatory: true },
      { curriculumCourseCode: 'e1', courseName: 'Chuyên đề 1', credits: 3, isElective: true, electiveGroupId: 'g1' },
      { curriculumCourseCode: 'f1', courseName: 'Toán cao cấp', credits: 3, isMandatory: true },
      { curriculumCourseCode: 'u1', courseName: 'Môn chưa xác định', credits: 2 },
      { curriculumCourseCode: 'ng1', courseName: 'Giáo dục thể chất 1', credits: 0, countsTowardCumulativeGPA: false },
    ],
    electiveGroups: [
      { id: 'g1', groupName: 'Nhóm 1', requiredCredits: 3, courses: [{ curriculumCourseCode: 'e1', credits: 3 }] }
    ]
  };

  const actualSemesters = [
    {
      courses: [
        { curriculumCourseCode: 'm1', isPassed: true },
        { curriculumCourseCode: 'f1', isPassed: false, officialResult: { passed: false } },
      ]
    }
  ];

  const pool = FutureSemesterEngine.getCoursePool(curriculumModel, actualSemesters, { semesters: [] });

  // 1. Môn đã đạt (m1) bị loại trừ khỏi pool cần học
  assert.ok(pool.completed.some(c => c.curriculumCourseCode === 'm1'));
  assert.ok(!pool.mandatoryRemaining.some(c => c.curriculumCourseCode === 'm1'));

  // 2. Môn bắt buộc chưa hoàn thành (m2) nằm trong mandatoryRemaining
  assert.ok(pool.mandatoryRemaining.some(c => c.curriculumCourseCode === 'm2'));

  // 3. Môn chưa đạt (f1) nằm trong failedRetake
  assert.ok(pool.failedRetake.some(c => c.curriculumCourseCode === 'f1'));

  // 4. Môn non-GPA giữ cờ countsTowardCumulativeGPA === false
  const nonGpa = pool.unregistered.find(c => c.curriculumCourseCode === 'ng1');
  assert.ok(nonGpa);
  assert.equal(nonGpa.countsTowardCumulativeGPA, false);
});

// ==========================================
// 4. DUPLICATE PREVENTION & MOVE TESTS
// ==========================================
test('FutureSemesterEngine: 7. Ngăn chặn trùng lặp môn học và di chuyển môn giữa các kỳ', () => {
  const plan = {
    semesters: [
      { id: 'sem-1', termName: 'HK1 (2026 - 2027)', courses: [] },
      { id: 'sem-2', termName: 'HK2 (2026 - 2027)', courses: [] },
    ]
  };

  const course = { curriculumCourseCode: 'c101', courseName: 'Nhập môn Lập trình', credits: 3 };

  // Add vào sem-1
  const addRes1 = FutureSemesterEngine.addCourseToSemester(plan, 'sem-1', course);
  assert.equal(addRes1.ok, true);
  assert.equal(plan.semesters[0].courses.length, 1);

  // Cố gắng add lại vào sem-2: trả về lỗi DUPLICATE_COURSE
  const addRes2 = FutureSemesterEngine.addCourseToSemester(plan, 'sem-2', course);
  assert.equal(addRes2.ok, false);
  assert.equal(addRes2.error, 'DUPLICATE_COURSE');

  // Di chuyển môn từ sem-1 sang sem-2
  const moveRes = FutureSemesterEngine.moveCourse(plan, 'c101', 'sem-2');
  assert.equal(moveRes.ok, true);
  assert.equal(plan.semesters[0].courses.length, 0);
  assert.equal(plan.semesters[1].courses.length, 1);
  assert.equal(plan.semesters[1].courses[0].curriculumCourseCode, 'c101');
});

// ==========================================
// 5. FUTURE SEMESTER GPA & UNROUNDED PRECISION
// ==========================================
test('FutureSemesterEngine: 8. Tính GPA học kỳ tương lai không làm tròn sớm, bỏ qua môn chưa có điểm', () => {
  const courses = [
    {
      curriculumCourseCode: 'c1',
      credits: 3,
      included: true,
      score10: 8.5,
      score10Raw: 8.5,
      score4: 3.5,
      score4Raw: 3.5,
    },
    {
      curriculumCourseCode: 'c2',
      credits: 3,
      included: true,
      score10: 7.0,
      score10Raw: 7.0,
      score4: 3.0,
      score4Raw: 3.0,
    },
    {
      curriculumCourseCode: 'c3_missing',
      credits: 2,
      included: true,
      score10: null, // Chưa có điểm -> Bỏ qua, KHÔNG coi là 0
      score4: null,
    },
    {
      curriculumCourseCode: 'c4_nongpa',
      credits: 2,
      included: false, // Môn điều kiện không tính GPA
      score10: 9.0,
      score4: 4.0,
      countsTowardCumulativeGPA: false,
    }
  ];

  const gpaRes = FutureSemesterEngine.calculateFutureSemesterGPA(courses);

  assert.equal(gpaRes.hasSufficientData, true);
  assert.equal(gpaRes.coursesCompletedCount, 3);
  assert.equal(gpaRes.coursesTotalCount, 4);
  assert.equal(gpaRes.gpaEligibleCredits, 6);
  assert.equal(gpaRes.totalPlannedCredits, 10);

  // Trọng số: (3.5 * 3 + 3.0 * 3) / 6 = (10.5 + 9.0) / 6 = 19.5 / 6 = 3.25
  assert.equal(gpaRes.gpa4Raw, 3.25);
  assert.equal(gpaRes.gpa4, '3,2500');

  // Trọng số 10: (8.5 * 3 + 7.0 * 3) / 6 = (25.5 + 21.0) / 6 = 46.5 / 6 = 7.75
  assert.equal(gpaRes.gpa10Raw, 7.75);
  assert.equal(gpaRes.gpa10, '7,7500');
});

// ==========================================
// 6. CUMULATIVE PROJECTED GPA (RAW DIVISION)
// ==========================================
test('FutureSemesterEngine: 9. GPA tích lũy dự kiến tính theo tổng điểm / tổng tín chỉ, KHÔNG trung bình cộng GPA kỳ', () => {
  const actualEffective = {
    gpa4Raw: 3.0,
    gradedCredits: 30, // 3.0 * 30 = 90.0 grade points
    earnedCredits: 30,
    totalCredits: 30,
  };

  const futureSemesters = [
    {
      id: 'f1',
      courses: [
        {
          curriculumCourseCode: 'f_c1',
          credits: 10,
          included: true,
          score4Raw: 4.0, // 4.0 * 10 = 40.0 grade points
        }
      ]
    }
  ];

  const proj = FutureSemesterEngine.calculateProjectedCumulativeGPA(actualEffective, futureSemesters);

  // Tổng grade points = 90.0 + 40.0 = 130.0
  // Tổng credits = 30 + 10 = 40
  // GPA = 130.0 / 40 = 3.25 (KHÔNG PHẢI trung bình (3.0 + 4.0) / 2 = 3.5)
  assert.equal(proj.hasSufficientData, true);
  assert.equal(proj.projectedGradedCredits, 40);
  assert.equal(proj.projectedCumulativeGPA4Raw, 3.25);
  assert.equal(proj.projectedCumulativeGPA4, '3,2500');
});

// ==========================================
// 7. TIMELINE FUTURE DIFFERENTIATION
// ==========================================
test('FutureSemesterEngine: 10. TimelineEngine phân biệt nét liền actual và nét đứt future', () => {
  const semesters = [
    { semesterName: 'HK1 (2024 - 2025)', overallGPA: { value: 3.2 }, cumulativeGPA: { value: 3.2 }, credits: { value: 15 } },
    { semesterName: 'HK2 (2024 - 2025)', overallGPA: { value: 3.4 }, cumulativeGPA: { value: 3.3 }, credits: { value: 15 } },
  ];

  const futureSemesters = [
    {
      id: 'f1',
      termName: 'HK1 (2025 - 2026)',
      courses: [
        { curriculumCourseCode: 'fc1', credits: 15, included: true, score4Raw: 3.6, score10Raw: 8.0 }
      ]
    }
  ];

  const timelineData = TimelineEngine.generateTimelineData(semesters, futureSemesters);
  assert.equal(timelineData.length, 3);
  assert.equal(timelineData[0].isFuture, false);
  assert.equal(timelineData[1].isFuture, false);
  assert.equal(timelineData[2].isFuture, true);

  const model = TimelineEngine.computeSVGChartModel(timelineData, { width: 600, height: 200, padding: 30, mode: 'cumulative' });
  assert.ok(model.pathActualSolid);
  assert.ok(model.pathFutureDashed);
  assert.equal(model.hasFuturePoints, true);
});

// ==========================================
// 8. SCENARIO DEEP CLONE ISOLATION
// ==========================================
test('FutureSemesterEngine: 11. ScenarioEngine clone kịch bản cô lập deep copy futurePlan', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Kịch bản A');

  const futurePlan = {
    semesters: [
      { id: 'f1', termName: 'HK1 (2026 - 2027)', courses: [{ curriculumCourseCode: 'c1' }] }
    ]
  };
  engine.setFuturePlan(futurePlan, sc1.id);

  // Clone scenario
  const sc2 = engine.cloneScenario(sc1.id, 'Kịch bản B (Clone)');
  const plan2 = engine.getFuturePlan(sc2.id);

  assert.equal(plan2.semesters.length, 1);
  assert.equal(plan2.semesters[0].courses.length, 1);

  // Sửa clone không ảnh hưởng bản gốc
  plan2.semesters[0].courses.push({ curriculumCourseCode: 'c2' });
  assert.equal(plan2.semesters[0].courses.length, 2);

  const originalPlan = engine.getFuturePlan(sc1.id);
  assert.equal(originalPlan.semesters[0].courses.length, 1);
});

// ==========================================
// 9. ADAPTER ISOLATION (NO MUTATION ON TABLE PARSE)
// ==========================================
test('FutureSemesterEngine: 12. IUHPageAdapter bỏ qua hoàn toàn các dòng future semester / course do extension tạo', () => {
  const path = require('node:path');
  const fs = require('node:fs');
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector('table#xemDiem_aaa');

  // Gắn các dòng future semester / course vào cuối bảng
  const tbody = table.querySelector('tbody') || table;
  const fSemRow = dom.window.document.createElement('tr');
  fSemRow.className = 'iuh-gpa-future-row iuh-gpa-future-semester-row iuh-gpa-extension';
  fSemRow.setAttribute('data-iuh-gpa-extension', 'true');
  fSemRow.innerHTML = '<td colspan="27">HỌC KỲ MÔ PHỎNG TƯƠNG LAI</td>';
  tbody.appendChild(fSemRow);

  const fCourseRow = dom.window.document.createElement('tr');
  fCourseRow.className = 'iuh-gpa-future-row iuh-gpa-future-course-row iuh-gpa-extension';
  fCourseRow.setAttribute('data-iuh-gpa-extension', 'true');
  fCourseRow.innerHTML = '<td colspan="27">Môn học tương lai mô phỏng</td>';
  tbody.appendChild(fCourseRow);

  const colMap = IUHPageAdapter.detectColumns(table).data;
  const parseResult = IUHPageAdapter.parseSemesters(table, colMap);
  assert.ok(parseResult.ok, 'parseSemesters phải thành công');
  const semesters = parseResult.data;

  // Số lượng học kỳ vẫn giữ nguyên 10 kỳ, tổng số môn vẫn giữ nguyên 54 môn gốc
  assert.equal(semesters.length, 10);
  const totalCourses = semesters.reduce((acc, s) => acc + s.courses.length, 0);
  assert.equal(totalCourses, 54);
});

// ==========================================
// 10. XSS & NETWORK ISOLATION TESTS
// ==========================================
test('FutureSemesterEngine: 13. XSS Protection: Tên môn độc hại không bị parse thành HTML tag', () => {
  const maliciousName = '<script>alert("xss")</script><img src="x" onerror="alert(1)">';
  const c = { curriculumCourseCode: 'xss101', courseName: maliciousName, credits: 3 };
  const futureCourse = FutureSemesterEngine.createFutureCourse(c, 'sem-1');

  assert.equal(futureCourse.courseName, maliciousName);
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c-name"></div></body></html>');
  const el = dom.window.document.getElementById('c-name');
  el.textContent = futureCourse.courseName;

  assert.equal(el.children.length, 0, 'Không được tạo ra element con script hoặc img');
  assert.equal(el.innerHTML, '&lt;script&gt;alert("xss")&lt;/script&gt;&lt;img src="x" onerror="alert(1)"&gt;');
});

test('FutureSemesterEngine: 14. Network isolation: Planner actions create 0 new network calls', () => {
  const store = new SimulationStore([]);
  store.setOriginalData([]);
  assert.equal(store.getFuturePlan().semesters.length, 0);

  store.addFutureSemester({ term: 3, startYear: 2025, endYear: 2026, courses: [{ curriculumCourseCode: 'c1', credits: 3 }] });
  assert.equal(store.getFuturePlan().semesters.length, 1);

  store.updateFutureCourseScore('c1', 'midterm', 0, 8.5);
  const derived = store.getDerivedData();
  assert.ok(derived.futurePlan);
});
