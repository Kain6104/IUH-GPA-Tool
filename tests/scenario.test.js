const test = require('node:test');
const assert = require('node:assert/strict');
const { ScenarioEngine } = require('../src/core/ScenarioEngine.js');
const { GradingRuleEngine } = require('../src/core/GradingRuleEngine.js');

test('ScenarioEngine: 1. createScenario tạo kịch bản mới độc lập', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Kịch bản Lạc quan', { 'course_1': { finalExam: 9.0 } });

  assert.ok(sc1.id);
  assert.equal(sc1.name, 'Kịch bản Lạc quan');
  assert.equal(sc1.courseOverrides['course_1'].finalExam, 9.0);
  assert.equal(engine.getAllScenarios().length, 2); // Default + New
});

test('ScenarioEngine: 2. renameScenario đổi tên thành công', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Tên cũ');
  const ok = engine.renameScenario(sc1.id, 'Tên mới đã đổi');

  assert.equal(ok, true);
  assert.equal(engine.getScenario(sc1.id).name, 'Tên mới đã đổi');

  // Đổi tên rỗng -> false
  assert.equal(engine.renameScenario(sc1.id, '   '), false);
});

test('ScenarioEngine: 3. cloneScenario tạo bản sao kịch bản', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Kịch bản Gốc', { 'course_A': { finalExam: 7.5 } });
  const clone = engine.cloneScenario(sc1.id, 'Kịch bản Bản sao');

  assert.ok(clone.id);
  assert.notEqual(clone.id, sc1.id);
  assert.equal(clone.name, 'Kịch bản Bản sao');
  assert.equal(clone.courseOverrides['course_A'].finalExam, 7.5);
});

test('ScenarioEngine: 4. cloneScenario Deep Copy: sửa bản sao KHÔNG làm đổi bản gốc', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Gốc', { 'c1': { finalExam: 8.0 } });
  const clone = engine.cloneScenario(sc1.id, 'Sao');

  // Sửa clone c1 thành 9.5
  engine.setOverride('c1', { finalExam: 9.5 }, clone.id);

  assert.equal(engine.getScenario(clone.id).courseOverrides['c1'].finalExam, 9.5);
  // Bản gốc vẫn phải là 8.0!
  assert.equal(engine.getScenario(sc1.id).courseOverrides['c1'].finalExam, 8.0);
});

test('ScenarioEngine: 5. activateScenario kích hoạt kịch bản mong muốn', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Kịch bản 1');

  assert.equal(engine.getActiveScenarioId(), 'scenario_default');
  const ok = engine.activateScenario(sc1.id);
  assert.equal(ok, true);
  assert.equal(engine.getActiveScenarioId(), sc1.id);

  // Kích hoạt ID không tồn tại -> false
  assert.equal(engine.activateScenario('non_existent'), false);
});

test('ScenarioEngine: 6. deleteScenario xóa kịch bản', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Tạm thời');
  assert.equal(engine.getAllScenarios().length, 2);

  const res = engine.deleteScenario(sc1.id);
  assert.equal(res.success, true);
  assert.equal(engine.getAllScenarios().length, 1);
  assert.equal(engine.getScenario(sc1.id), null);
});

test('ScenarioEngine: 7. Không cho phép xóa kịch bản cuối cùng và an toàn khi xóa active scenario', () => {
  const engine = new ScenarioEngine();
  // Hiện chỉ có 1 scenario default
  const res1 = engine.deleteScenario('scenario_default');
  assert.equal(res1.success, false);
  assert.ok(res1.reason);

  // Tạo thêm scenario 2 và active nó, sau đó xóa
  const sc2 = engine.createScenario('Scenario 2');
  engine.activateScenario(sc2.id);
  assert.equal(engine.getActiveScenarioId(), sc2.id);

  const res2 = engine.deleteScenario(sc2.id);
  assert.equal(res2.success, true);
  // Phải tự động fallback sang kịch bản còn lại (scenario_default)
  assert.equal(engine.getActiveScenarioId(), 'scenario_default');
});

test('ScenarioEngine: 8. resetScenario đưa delta về rỗng', () => {
  const engine = new ScenarioEngine();
  engine.setOverride('c1', { finalExam: 10.0 });
  assert.equal(engine.getActiveScenario().courseOverrides['c1'].finalExam, 10.0);

  engine.resetScenario();
  assert.deepEqual(engine.getActiveScenario().courseOverrides, {});
});

test('ScenarioEngine: 9. compareScenarios so sánh kịch bản với baseline', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Mục tiêu cao', { 'c1': { finalExam: 9.0 } });

  const allOriginalCourses = [
    {
      id: 'c1',
      courseName: 'Môn 1',
      credits: 4,
      score10: 5.0, // 5.0 -> 1.5
      score4: 1.5,
      passed: true,
      rule: GradingRuleEngine.COMPONENT_RULES.THEORY,
      assessments: {
        midterm: { status: 'ok', value: 7.0 },
        regular: [{ status: 'ok', value: 7.0 }],
      },
    },
    {
      id: 'c2',
      courseName: 'Môn 2',
      credits: 3,
      score10: 8.0, // 8.0 -> 3.5
      score4: 3.5,
      passed: true,
    },
  ];

  // Baseline: 4*1.5 + 3*3.5 = 6 + 10.5 = 16.5 / 7 = 2.357 -> 2.36
  const comp = ScenarioEngine.compareScenarios({
    scenarioEngine: engine,
    scenarioIds: [sc1.id],
    allOriginalCourses,
    gradingRuleEngine: GradingRuleEngine,
  });

  assert.equal(comp.status, 'OK');
  assert.equal(comp.baseline.gpa4, 2.36);
  assert.equal(comp.scenarios.length, 1);
  assert.equal(comp.scenarios[0].scenarioName, 'Mục tiêu cao');
  assert.equal(comp.scenarios[0].modifiedCoursesCount, 1);
  // c1 với finalExam 9.0: 7*0.3 + 7*0.2 + 9*0.5 = 8.0 (B+ -> 3.5)
  // Sc1 GPA: 4*3.5 + 3*3.5 = 24.5 / 7 = 3.50
  assert.equal(comp.scenarios[0].gpa4Display, 3.50);
  assert.equal(comp.scenarios[0].deltaGpa4, 1.14);
});

test('ScenarioEngine: 10. Dữ liệu gốc originalCourses hoàn toàn không bị mutate', () => {
  const engine = new ScenarioEngine();
  const sc1 = engine.createScenario('Mô phỏng');
  engine.setOverride('c1', { finalExam: 10.0 }, sc1.id);

  const origCourse = { id: 'c1', score10: 6.0, score4: 2.5 };
  const origSnapshot = JSON.stringify(origCourse);

  ScenarioEngine.compareScenarios({
    scenarioEngine: engine,
    scenarioIds: [sc1.id],
    allOriginalCourses: [origCourse],
  });

  assert.equal(JSON.stringify(origCourse), origSnapshot);
});

test('ScenarioEngine: 11. Điểm số 0.0 được bảo toàn nguyên vẹn trong delta (không bị coi là missing/null)', () => {
  const engine = new ScenarioEngine();
  engine.setOverride('c1', { finalExam: 0.0 });

  const active = engine.getActiveScenario();
  assert.strictEqual(active.courseOverrides['c1'].finalExam, 0.0);
  assert.notStrictEqual(active.courseOverrides['c1'].finalExam, null);
  assert.notStrictEqual(active.courseOverrides['c1'].finalExam, undefined);
});
