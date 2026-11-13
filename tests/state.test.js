/**
 * tests/state.test.js
 * Unit tests cho SimulationStore và selectors
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { SimulationStore } = require('../src/state/SimulationStore.js');
const { selectOverallComparison, selectSemestersList, selectCourseById } = require('../src/state/selectors.js');

function getMockSemesters() {
  return [
    {
      semesterKey: 'HK1_2020',
      semesterName: 'HK1 (2020 - 2021)',
      courses: [
        {
          id: 'HK1_2020_MATH_1',
          courseClassCode: 'MATH101',
          courseName: 'Toán cao cấp A1',
          credits: { status: 'ok', value: 3 },
          officialResult: {
            total10: { status: 'ok', value: 6.0 },
            score4: { status: 'ok', value: 2.5 },
            passed: true,
          },
        },
        {
          id: 'HK1_2020_PHY_1',
          courseClassCode: 'PHY101',
          courseName: 'Vật lý 1',
          credits: { status: 'ok', value: 3 },
          officialResult: {
            total10: { status: 'ok', value: 5.0 },
            score4: { status: 'ok', value: 1.5 },
            passed: true,
          },
        }
      ],
      summary: { gpa10: { value: 5.5 } }
    }
  ];
}

test('SimulationStore: Dữ liệu gốc bất biến (immutable)', () => {
  const store = new SimulationStore();
  const rawInput = getMockSemesters();
  store.setOriginalData(rawInput);

  const orig = store.getOriginalData();
  assert.ok(orig, 'Dữ liệu gốc phải tồn tại');
  assert.ok(Object.isFrozen(orig), 'Dữ liệu gốc phải được Object.freeze');

  // Thử mutate dữ liệu ban đầu
  rawInput[0].courses[0].officialResult.total10.value = 10.0;
  // Dữ liệu trong store không bị ảnh hưởng do deep clone & freeze
  assert.equal(store.getOriginalData()[0].courses[0].officialResult.total10.value, 6.0);
});

test('SimulationStore: Delta-only simulation tách biệt dữ liệu gốc', () => {
  const store = new SimulationStore();
  store.setOriginalData(getMockSemesters());

  // Trước khi mô phỏng: GPA gốc = (6.0*3 + 5.0*3)/6 = 5.5
  let derived = store.getDerivedData();
  assert.equal(derived.hasSimulations, false);
  assert.equal(derived.overallOriginal.gpa10, 5.50);
  assert.equal(derived.overallSimulated.gpa10, 5.50);

  // Người dùng thử nâng điểm môn Toán lên 9.0 (mô phỏng)
  store.setCourseOverride('HK1_2020_MATH_1', { score10: 9.0 });

  derived = store.getDerivedData();
  assert.equal(derived.hasSimulations, true);
  // Điểm gốc vẫn là 5.50 không hề đổi
  assert.equal(derived.overallOriginal.gpa10, 5.50);
  // Điểm mô phỏng mới: (9.0*3 + 5.0*3)/6 = 7.00
  assert.equal(derived.overallSimulated.gpa10, 7.00);

  // Selectors
  const comp = selectOverallComparison(derived);
  assert.equal(comp.hasSimulations, true);
  assert.equal(comp.deltaGPA10, 1.50);

  const course = selectCourseById(derived, 'HK1_2020_MATH_1');
  assert.equal(course.score10, 9.0);
  assert.equal(course.provenance, 'simulated');

  // Reset môn
  store.resetCourse('HK1_2020_MATH_1');
  derived = store.getDerivedData();
  assert.equal(derived.hasSimulations, false);
  assert.equal(derived.overallSimulated.gpa10, 5.50);
});

test('SimulationStore: Reset toàn bộ mô phỏng', () => {
  const store = new SimulationStore();
  store.setOriginalData(getMockSemesters());

  store.setCourseOverride('HK1_2020_MATH_1', { score10: 10.0 });
  store.setCourseOverride('HK1_2020_PHY_1', { score10: 10.0 });
  assert.equal(store.hasActiveSimulations(), true);

  store.resetAllSimulations();
  assert.equal(store.hasActiveSimulations(), false);

  const derived = store.getDerivedData();
  assert.equal(derived.overallSimulated.gpa10, derived.overallOriginal.gpa10);
});

test('SimulationStore: Publish / Subscribe pattern', () => {
  const store = new SimulationStore();
  store.setOriginalData(getMockSemesters());

  let notified = 0;
  const unsubscribe = store.subscribe((data) => {
    notified++;
    assert.ok(data);
  });

  store.setCourseOverride('HK1_2020_MATH_1', { score10: 8.0 });
  assert.equal(notified, 1);

  store.resetAllSimulations();
  assert.equal(notified, 2);

  unsubscribe();
  store.setCourseOverride('HK1_2020_MATH_1', { score10: 9.0 });
  assert.equal(notified, 2, 'Sau unsubscribe không được gọi callback nữa');
});

test('SimulationStore: Reset theo từng học kỳ (resetSemester)', () => {
  const store = new SimulationStore();
  store.setOriginalData(getMockSemesters());

  store.setCourseOverride('HK1_2020_MATH_1', { score10: 9.0 });
  assert.equal(store.hasActiveSimulations(), true);

  store.resetSemester('HK1_2020');
  assert.equal(store.hasActiveSimulations(), false);

  const derived = store.getDerivedData();
  assert.equal(derived.hasSimulations, false);
});

test('SimulationStore: Giữ nguyên full precision cho raw GPA (không round sớm)', () => {
  const customSemesters = [
    {
      semesterKey: 'HK1_TEST',
      courses: [
        // 3 môn: 8.0 (3TC), 7.0 (3TC), 6.5 (2TC) -> (24 + 21 + 13) / 8 = 58 / 8 = 7.25
        // Thêm môn thứ 4: 8.2 (3TC) -> (58 + 24.6) / 11 = 82.6 / 11 = 7.509090909090909...
        { id: 'c1', credits: { status: 'ok', value: 8 }, officialResult: { total10: { status: 'ok', value: 7.25 } } },
        { id: 'c2', credits: { status: 'ok', value: 3 }, officialResult: { total10: { status: 'ok', value: 8.2 } } },
      ]
    }
  ];

  const store = new SimulationStore();
  store.setOriginalData(customSemesters);

  const derived = store.getDerivedData();
  const rawGpa10 = derived.overallOriginal.gpa10Raw;

  // Expected float: (7.25 * 8 + 8.2 * 3) / 11 = (58 + 24.6) / 11 = 82.6 / 11 = 7.509090909090909
  assert.ok(typeof rawGpa10 === 'number');
  assert.equal(rawGpa10, 82.6 / 11);
  assert.equal(derived.overallOriginal.gpa10, 7.51, 'Display gpa10 được làm tròn 2 chữ số (7.51)');
  // Chứng minh raw GPA không bị làm tròn thành 7.51
  assert.notEqual(rawGpa10, 7.51);
});

