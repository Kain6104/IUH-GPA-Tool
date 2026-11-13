/**
 * tests/score-display-precision-hotfix.test.js
 * Test suite for Phase 6A.2.1:
 *  - Score format (2 decimals with comma) & GPA precision (4 decimals with comma)
 *  - Deterministic hand-calculated GPA validation
 *  - Double-rounding prevention (raw scores fed directly into average)
 *  - Derived mapping: Course Total strictly in DiemTongKet, NOT DiemTBQuaTrinh
 *  - Centralized fallback non-GPA exclusion rules & false-positive protections
 *  - User override lifecycle (untick/tick/reset)
 *  - Clean simulated cell display without "gốc" or text overlap
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const NumberParser = require('../src/parsers/NumberParser.js');
const { GradingRuleEngine } = require('../src/core/GradingRuleEngine.js');
const { GPAEngine } = require('../src/core/GPAEngine.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { AppController } = require('../src/ui/AppController.js');

test('Precision & Formatting: formatScore2 formatting rule', () => {
  assert.equal(NumberParser.formatScore2(7), '7,00');
  assert.equal(NumberParser.formatScore2(7.5), '7,50');
  assert.equal(NumberParser.formatScore2(7.85), '7,85');
  assert.equal(NumberParser.formatScore2(0), '0,00');
  assert.equal(NumberParser.formatScore2(10), '10,00');
  assert.equal(NumberParser.formatScore2(null), '');
  assert.equal(NumberParser.formatScore2(undefined), '');
  assert.equal(NumberParser.formatScore2(NaN), '');
});

test('Precision & Formatting: formatAverage4 proper mathematical rounding to 4 decimals', () => {
  assert.equal(NumberParser.formatAverage4(7), '7,0000');
  assert.equal(NumberParser.formatAverage4(7.4), '7,4000');
  // 7.4211538 -> rounds up to 7,4212 (NOT 7,4211)
  assert.equal(NumberParser.formatAverage4(7.421153846), '7,4212');
  assert.equal(NumberParser.formatAverage4(3.176923), '3,1769');
  assert.equal(NumberParser.formatAverage4(3.99999), '4,0000');
  assert.equal(NumberParser.formatAverage4(null), '');
  assert.equal(NumberParser.formatAverage4(undefined), '');
});

test('Deterministic GPA Dataset: Hand-calculated raw average matches GPAEngine without rounding loss', () => {
  // 3 deterministic courses:
  // A: 2 TC, total raw 8.125
  // B: 3 TC, total raw 7.375
  // C: 1 TC, total raw 9.250
  // Expected hệ 10: (2 * 8.125 + 3 * 7.375 + 1 * 9.250) / 6 = 47.625 / 6 = 7.9375
  const courses = [
    { id: 'c_A', courseName: 'Môn A', credits: 2, score10Raw: 8.125, score10: 8.13, score4Raw: 3.5, score4: 3.5, included: true },
    { id: 'c_B', courseName: 'Môn B', credits: 3, score10Raw: 7.375, score10: 7.38, score4Raw: 3.0, score4: 3.0, included: true },
    { id: 'c_C', courseName: 'Môn C', credits: 1, score10Raw: 9.250, score10: 9.25, score4Raw: 4.0, score4: 4.0, included: true },
  ];

  const expectedRaw10 = (2 * 8.125 + 3 * 7.375 + 1 * 9.250) / 6;
  assert.equal(expectedRaw10, 7.9375);

  const res = GPAEngine.calculateGPA(courses);
  assert.equal(res.gpa10Raw, 7.9375);
  assert.equal(NumberParser.formatAverage4(res.gpa10Raw), '7,9375');

  // Thang 4: (2 * 3.5 + 3 * 3.0 + 1 * 4.0) / 6 = (7.0 + 9.0 + 4.0) / 6 = 20 / 6 = 3.3333333333333335
  const expectedRaw4 = 20 / 6;
  assert.equal(res.gpa4Raw, expectedRaw4);
  assert.equal(NumberParser.formatAverage4(res.gpa4Raw), '3,3333');
});

test('No Double Rounding: Calculated component score raw feeds into GPAEngine without truncation', () => {
  // Rule THEORY: midterm 0.3, regularAvg 0.2, finalExam 0.5
  // Giả sử midterm 8.5, regular 8.25, finalExam 7.75
  // Calculated total = 8.5 * 0.3 + 8.25 * 0.2 + 7.75 * 0.5 = 2.55 + 1.65 + 3.875 = 8.075
  const rule = GradingRuleEngine.COMPONENT_RULES.THEORY;
  const rawTotal = rule.calculateTotal({
    midterm: 8.5,
    regularAvg: 8.25,
    practiceAvg: null,
    finalExam: 7.75,
  });
  assert.equal(rawTotal, 8.075);

  // Nếu bị double-rounded: 8.075 -> 8.08. Khi tính GPA 1 TC:
  const coursesWithRaw = [{ id: 'c1', credits: 1, score10Raw: rawTotal, score10: 8.08, included: true }];
  const gpaRes = GPAEngine.calculateGPA(coursesWithRaw);
  assert.equal(gpaRes.gpa10Raw, 8.075, 'Phải giữ nguyên độ chính xác 8.075');
  assert.equal(NumberParser.formatAverage4(gpaRes.gpa10Raw), '8,0750');
});

test('Fallback Exclusion Rules: Positive matches and false-positive protections', () => {
  // 1. Positive matches (Phải tự động loại trừ)
  const positiveCases = [
    'Giáo dục thể chất 1',
    'Giáo dục thể chất 2',
    'Giáo dục thể chất',
    'Giáo dục Quốc phòng và An ninh 1',
    'Giáo dục Quốc phòng và An ninh 2',
    'Giáo dục Quốc phòng và An ninh',
    'Giáo dục quốc phòng',
    'Tiếng Anh 1',
    'Tiếng Anh 2',
    'Tiếng Anh 3',
    'Chứng chỉ Tiếng Anh',
    'Chứng chỉ tiếng anh',
  ];

  positiveCases.forEach(name => {
    const res = GradingRuleEngine.isNonGpaCourseFallback(name);
    assert.equal(res.isNonGpa, true, `Môn [${name}] phải được nhận diện là non-GPA`);
  });

  // 2. Negative protections (Tuyệt đối KHÔNG được loại trừ nhầm)
  const negativeCases = [
    'Tiếng Anh chuyên ngành CNTT',
    'Tiếng Anh thương mại',
    'Mạng máy tính',
    'Toán cao cấp 2',
    'Kỹ thuật lập trình',
    'Tiếng Việt thực hành',
    'Hệ thống Máy tính',
  ];

  negativeCases.forEach(name => {
    const res = GradingRuleEngine.isNonGpaCourseFallback(name);
    assert.equal(res.isNonGpa, false, `Môn [${name}] KHÔNG được phép bị loại trừ nhầm`);
  });
});

test('Fallback Exclusion: SimulationStore sets default included=false for non-GPA courses', () => {
  const store = new SimulationStore();
  const mockOriginal = [
    {
      semesterKey: 'SEM_1',
      semesterName: 'Học kỳ 1',
      courses: [
        {
          id: 'c_pe',
          courseClassCode: '1001',
          courseName: 'Giáo dục thể chất 1',
          credits: { status: 'ok', value: 2 },
          assessments: { midterm: { status: 'ok', value: 8 } },
          officialResult: { total10: { status: 'ok', value: 8.0 }, score4: { status: 'ok', value: 3.5 }, passed: true },
        },
        {
          id: 'c_major',
          courseClassCode: '1002',
          courseName: 'Kỹ thuật lập trình',
          credits: { status: 'ok', value: 3 },
          assessments: { midterm: { status: 'ok', value: 9 } },
          officialResult: { total10: { status: 'ok', value: 9.0 }, score4: { status: 'ok', value: 4.0 }, passed: true },
        },
      ]
    }
  ];

  store.setOriginalData(mockOriginal);
  const derived = store.getDerivedData();
  const peCourse = derived.semesters[0].courses.find(c => c.id === 'c_pe');
  const majorCourse = derived.semesters[0].courses.find(c => c.id === 'c_major');

  // GDTC 1 phải default included = false
  assert.equal(peCourse.included, false, 'GDTC 1 phải có included = false mặc định');
  assert.equal(peCourse.isExcludedFromGpa, true);
  assert.equal(peCourse.isFallbackNonGpa, true);

  // Kỹ thuật lập trình phải default included = true
  assert.equal(majorCourse.included, true);
  assert.equal(majorCourse.isExcludedFromGpa, false);

  // User override: bật lại môn GDTC 1
  store.setCourseOverride('c_pe', { included: true });
  const derivedAfterOverride = store.getDerivedData();
  const peOverridden = derivedAfterOverride.semesters[0].courses.find(c => c.id === 'c_pe');
  assert.equal(peOverridden.included, true, 'User override phải bật môn');
  assert.equal(peOverridden.isSelectionOverridden, true);

  // Reset override: trở về default included = false
  store.resetCourse('c_pe');
  const derivedAfterReset = store.getDerivedData();
  const peReset = derivedAfterReset.semesters[0].courses.find(c => c.id === 'c_pe');
  assert.equal(peReset.included, false, 'Reset phải đưa về trạng thái default excluded');
});

test('Derived Mapping: Course Total strictly in DiemTongKet and NEVER in DiemTBQuaTrinh', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const controller = new AppController(doc);
  controller.init();

  const firstCourse = controller.store.getDerivedData().semesters[0].courses[0];
  assert.ok(firstCourse);

  const row = doc.querySelector(`tr[data-course-id="${firstCourse.id}"]`);
  assert.ok(row);

  const cellTongKet = row.querySelector('td[title="DiemTongKet"]');
  const cellTBQT = row.querySelector('td[title="DiemTBQuaTrinh"]');
  assert.ok(cellTongKet, 'Phải có cột DiemTongKet');
  assert.ok(cellTBQT, 'Phải có cột DiemTBQuaTrinh');

  // Giả lập điểm cuối kỳ thay đổi thành 10.0
  controller.store.setCourseOverride(firstCourse.id, { finalExam: 10.0 });

  const derivedAfter = controller.store.getDerivedData();
  const updatedCourse = derivedAfter.semesters[0].courses[0];

  const tongKetSimSpan = cellTongKet.querySelector('.iuh-gpa-sim-val');
  assert.ok(tongKetSimSpan);
  assert.equal(tongKetSimSpan.textContent, NumberParser.formatScore2(updatedCourse.score10));

  // Kiểm tra TUYỆT ĐỐI: Điểm tổng kết KHÔNG được render vào DiemTBQuaTrinh
  const tbqtSimSpan = cellTBQT.querySelector('.iuh-gpa-sim-val');
  if (tbqtSimSpan && tbqtSimSpan.style.display !== 'none') {
    assert.notEqual(
      tbqtSimSpan.textContent,
      NumberParser.formatScore2(updatedCourse.score10),
      'REGRESSION CRITICAL: Điểm tổng kết không được hiển thị vào cột DiemTBQuaTrinh (TBQT)!'
    );
  }
});

test('Clean Cell Display: Simulated cell displays ONLY simulated score without "gốc" or text duplication', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const controller = new AppController(doc);
  controller.init();

  const firstCourse = controller.store.getDerivedData().semesters[0].courses[0];
  const row = doc.querySelector(`tr[data-course-id="${firstCourse.id}"]`);
  const cellThi = row.querySelector('td[title="DiemThi"]');
  assert.ok(cellThi);

  // Sửa điểm thi cuối kỳ = 8.5
  controller.store.setCourseOverride(firstCourse.id, { finalExam: 8.5 });

  // 1. Cell thi phải có class is-simulated-cell
  assert.ok(cellThi.classList.contains('is-simulated-cell'), 'Ô phải có class is-simulated-cell');

  // 2. Cell chỉ hiển thị giá trị mô phỏng 8,50 qua overlay
  const simSpan = cellThi.querySelector('.iuh-gpa-sim-val');
  assert.ok(simSpan);
  assert.equal(simSpan.textContent, '8,50');
  assert.equal(simSpan.style.display, 'inline-flex');

  // 3. Wrapper gốc phải bị ẩn
  const origWrapper = cellThi.querySelector('.iuh-gpa-orig-val');
  assert.ok(origWrapper);
  assert.equal(origWrapper.style.display, 'none');

  // 4. Không chứa chữ "gốc", "↳", "↓" trong toàn bộ cell
  assert.equal(cellThi.textContent.includes('gốc'), false, 'Cell không được chứa chữ "gốc"');
  assert.equal(cellThi.textContent.includes('↳'), false, 'Cell không được chứa ký tự "↳"');
  assert.equal(cellThi.textContent.includes('↓'), false, 'Cell không được chứa ký tự "↓"');

  // 5. Reset môn học: khôi phục nguyên vẹn
  controller.store.resetCourse(firstCourse.id);
  assert.equal(cellThi.classList.contains('is-simulated-cell'), false, 'Class is-simulated-cell phải biến mất');
  assert.equal(simSpan.style.display, 'none', 'Overlay mô phỏng phải bị ẩn');
  assert.equal(origWrapper.style.display, '', 'Nội dung gốc phải hiển thị lại');
});

test('Summary Row Precision: Semester and Cumulative GPA render with 4 decimals', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const controller = new AppController(doc);
  controller.init();

  // Kiểm tra summary cells đã được gắn 4 decimals
  const sem10Cell = doc.querySelector('[lang="kqht-tkhk-diemtbhocluc"]')?.parentElement;
  assert.ok(sem10Cell);
  const simVal = sem10Cell.querySelector('.iuh-gpa-summary-sim-val');
  assert.ok(simVal);
  assert.equal(simVal.style.display, 'inline');

  // Định dạng phải có 4 chữ số sau dấu phẩy (vd: 7,5000 hoặc 7,1234)
  const text = simVal.textContent.trim();
  assert.match(text, /^\d+,\d{4}$/, `GPA summary phải có 4 chữ số sau dấu phẩy, thực tế: "${text}"`);
  assert.equal(simVal.title, 'Tính lại từ dữ liệu học phần đang hiển thị.');
});
