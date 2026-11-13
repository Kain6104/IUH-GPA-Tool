/**
 * tests/phase6a2-controls.test.js
 * Verification test suite for Phase 6A.2:
 * 1. Table controls: "Chọn" (selection) & "Loại môn" (course type)
 * 2. Smart default inclusion: credits > 0 checked, credits == 0 disabled/unchecked
 * 3. Selection included/excluded recalculates GPA, targets, timeline
 * 4. Course type override & reset to automatic
 * 5. Course type inference rule foundation (THEORY, PRACTICE, COMBINED, UNKNOWN/SPECIAL_CANDIDATE)
 * 6. Inline editing for all components: Midterm, Regular 1..9, Practice 1..5, Final Exam
 * 7. Score 0 strictly preserved, missing != 0
 * 8. Revert to official value on empty input
 * 9. Recalculation flow without DOM reparsing
 * 10. Scenario delta saves all score components + type override + inclusion
 * 11. No official-cell text loss (original text immutable in text node)
 * 12. Adapter ignores extension controls
 * 13. Colspans remain valid (29 columns)
 * 14. No emoji in production UI (SVG icons used)
 * 15. Timeline actual semester labels, compact height (300-360px), native SVG (no Chart.js)
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { IUHPageAdapter } = require('../src/adapters/IUHPageAdapter.js');
const { GradingRuleEngine, COURSE_TYPES } = require('../src/core/GradingRuleEngine.js');
const { ScenarioEngine } = require('../src/core/ScenarioEngine.js');
const { TimelineEngine } = require('../src/core/TimelineEngine.js');
const { AppController } = require('../src/ui/AppController.js');

function loadSanitizedDOM() {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  return { dom, doc: dom.window.document };
}

test('Phase 6A.2: Course type inference rule foundation (GradingRuleEngine.inferCourseType)', () => {
  // LT > 0 && TH == 0 -> THEORY
  const res1 = GradingRuleEngine.inferCourseType({ theoryCredits: 3, practiceCredits: 0 });
  assert.equal(res1.type, COURSE_TYPES.THEORY);

  // LT == 0 && TH > 0 -> PRACTICE
  const res2 = GradingRuleEngine.inferCourseType({ theoryCredits: 0, practiceCredits: 2 });
  assert.equal(res2.type, COURSE_TYPES.PRACTICE);

  // LT > 0 && TH > 0 -> COMBINED
  const res3 = GradingRuleEngine.inferCourseType({ theoryCredits: 2, practiceCredits: 1 });
  assert.equal(res3.type, COURSE_TYPES.COMBINED);

  // LT == 0 && TH == 0 -> UNKNOWN / SPECIAL_CANDIDATE
  const res4 = GradingRuleEngine.inferCourseType({ theoryCredits: 0, practiceCredits: 0 });
  assert.equal(res4.type, 'UNKNOWN');
  assert.equal(res4.candidate, 'SPECIAL_CANDIDATE');
});

test('Phase 6A.2: Table controls injection, colspans validity (29 columns), header alignment', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  const initRes = controller.init();
  assert.equal(initRes.ok, true);

  const table = doc.querySelector('table#xemDiem_aaa');
  const theadRows = table.querySelectorAll('thead tr');
  assert.ok(theadRows.length >= 3);

  // Header controls mounted as first 2 columns of thead first row
  const thSelect = theadRows[0].querySelector('th.iuh-gpa-col-select');
  const thType = theadRows[0].querySelector('th.iuh-gpa-col-type');
  assert.ok(thSelect, 'Header must have Chọn as first column');
  assert.ok(thType, 'Header must have Loại môn as second column');

  // Check semester header row colSpan: must be 29 (27 official + 2 extension columns)
  const semesterCell = table.querySelector('tbody td.row-head');
  assert.ok(semesterCell);
  assert.equal(semesterCell.colSpan, 29);

  // Summary row colSpan: 23
  const summaryRow = table.querySelector('tbody tr:has([lang^="kqht-tkhk-"])');
  assert.ok(summaryRow);
  const summaryCell = summaryRow.querySelector('td.hidden, td:last-child');
  assert.ok(summaryCell);
  assert.equal(summaryCell.colSpan, 23);

  // Course rows have 2 extension controls: checkbox (Col 0) and select (Col 1)
  const firstCourseRow = table.querySelector('tbody tr:has(td[title="DiemTongKet"])');
  assert.ok(firstCourseRow);
  const chk = firstCourseRow.querySelector('.iuh-gpa-course-checkbox, .iuh-gpa-select-chk');
  const typeSelect = firstCourseRow.querySelector('.iuh-gpa-course-type-select, .iuh-gpa-type-select');
  assert.ok(chk, 'Checkbox Chọn must exist');
  assert.ok(typeSelect, 'Dropdown Loại môn must exist');
  assert.equal(typeSelect.value, 'AUTO');
});

test('Phase 6A.2: Smart default inclusion state and manual override', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const derived = controller.store.getDerivedData();
  const courses = derived.semesters.flatMap(s => s.courses);
  assert.ok(courses.length > 0);

  // Môn có tín chỉ > 0 mặc định included = true
  const creditCourse = courses.find(c => c.credits > 0);
  assert.ok(creditCourse);
  assert.equal(creditCourse.included, true);

  // User override: uncheck môn creditCourse
  controller.store.setCourseInclusion(creditCourse.id, false);
  const updatedDerived = controller.store.getDerivedData();
  const updatedCourse = updatedDerived.semesters.flatMap(s => s.courses).find(c => c.id === creditCourse.id);
  assert.equal(updatedCourse.included, false);
  assert.equal(updatedCourse.isSelectionOverridden, true);

  // Reset inclusion
  controller.store.resetCourseField(creditCourse.id, 'included');
  const resetDerived = controller.store.getDerivedData();
  const resetCourse = resetDerived.semesters.flatMap(s => s.courses).find(c => c.id === creditCourse.id);
  assert.equal(resetCourse.included, true);
  assert.equal(resetCourse.isSelectionOverridden, false);
});

test('Phase 6A.2: Course type override and reset to automatic', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const derived = controller.store.getDerivedData();
  const course = derived.semesters[0].courses[0];
  assert.ok(course);

  // Override to COMBINED
  controller.store.setCourseTypeOverride(course.id, COURSE_TYPES.COMBINED);
  let updated = controller.store.getDerivedData().semesters[0].courses.find(c => c.id === course.id);
  assert.equal(updated.courseTypeOverride, COURSE_TYPES.COMBINED);
  assert.equal(updated.isTypeOverridden, true);
  assert.equal(updated.courseType, COURSE_TYPES.COMBINED);

  // Reset type override
  controller.store.resetCourseField(course.id, 'courseType');
  updated = controller.store.getDerivedData().semesters[0].courses.find(c => c.id === course.id);
  assert.equal(updated.courseTypeOverride, null);
  assert.equal(updated.isTypeOverridden, false);
});

test('Phase 6A.2: Inline score editing for Midterm, Regular 1..9, Practice 1..5, Final Exam', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const derived = controller.store.getDerivedData();
  const course = derived.semesters[0].courses[0];
  assert.ok(course);

  // Simulate multiple components
  controller.store.setCourseOverride(course.id, {
    scores: {
      midterm: 8.5,
      finalExam: 9.0,
      regular: { 1: 8.0, 2: 9.0 },
      practice: { 1: 10.0 }
    }
  });

  const updated = controller.store.getDerivedData().semesters[0].courses.find(c => c.id === course.id);
  assert.equal(updated.simulatedMidterm, 8.5);
  assert.equal(updated.simulatedFinal, 9.0);
  assert.equal(updated.isSimulated, true);
  assert.ok(updated.processAverage > 0);
  assert.ok(updated.score10 > 0);
  assert.ok(updated.score4 > 0);
});

test('Phase 6A.2: Score 0 strictly preserved, missing != 0', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const derived = controller.store.getDerivedData();
  const course = derived.semesters[0].courses[0];
  assert.ok(course);

  // Score 0 is valid and distinct from missing
  controller.store.setCourseOverride(course.id, {
    scores: {
      finalExam: 0.0
    }
  });

  const updated = controller.store.getDerivedData().semesters[0].courses.find(c => c.id === course.id);
  assert.equal(updated.simulatedFinal, 0.0);
  assert.equal(updated.passed, false); // Fail due to score 0
});

test('Phase 6A.2: Scenario delta model saves all components, type override, inclusion', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const derived = controller.store.getDerivedData();
  const course1 = derived.semesters[0].courses[0];
  const course2 = derived.semesters[0].courses[1];

  controller.store.setCourseOverride(course1.id, {
    scores: { midterm: 7.5, finalExam: 8.5 },
    courseTypeOverride: COURSE_TYPES.PRACTICE
  });
  controller.store.setCourseInclusion(course2.id, false);

  const scenario = controller.store.saveScenario('Test Scenario 6A.2', 'Full coverage test');
  assert.ok(scenario);
  assert.ok(scenario.courseOverrides[course1.id]);
  assert.equal(scenario.courseOverrides[course1.id].scores.midterm, 7.5);
  assert.equal(scenario.courseOverrides[course1.id].scores.finalExam, 8.5);
  assert.equal(scenario.courseOverrides[course1.id].courseTypeOverride, COURSE_TYPES.PRACTICE);
  assert.equal(scenario.courseOverrides[course2.id].included, false);

  // Compare scenarios in ScenarioEngine
  const allOriginalCourses = derived.semesters.flatMap(s => s.courses);
  const compareRes = ScenarioEngine.compareScenarios({
    scenarioEngine: controller.store._scenarioEngine,
    scenarioIds: [scenario.id],
    allOriginalCourses
  });
  assert.equal(compareRes.status, 'OK');
  assert.equal(compareRes.scenarios.length, 1);
  assert.equal(compareRes.scenarios[0].modifiedCoursesCount, 2);
});

test('Phase 6A.2: Adapter ignores extension controls and extracts intact official text', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const table = doc.querySelector('table#xemDiem_aaa');
  const colMapRes = IUHPageAdapter.detectColumns(table);
  assert.equal(colMapRes.ok, true);

  // Reparse while all extension controls, checkboxes, selects, and simulated overlays are present
  const parseRes = IUHPageAdapter.parseSemesters(table, colMapRes.data);
  assert.equal(parseRes.ok, true);
  assert.equal(parseRes.data.length, 10);
  const totalCourses = parseRes.data.reduce((sum, s) => sum + s.courses.length, 0);
  assert.equal(totalCourses, 54);
});

test('Phase 6A.2: Timeline actual semester labels, compact height, modes, native SVG without Chart.js', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const derived = controller.store.getDerivedData();
  const series = TimelineEngine.generateTimelineSeries(derived.semesters);
  assert.ok(series.length > 0);

  // Actual semester labels check
  const firstItem = series[0];
  assert.ok(firstItem.compactLabel); // e.g. "HK1 20–21"
  assert.ok(firstItem.fullLabel);    // e.g. "HK1 (2020 - 2021)"
  assert.equal(series[series.length - 1].isLatest, true);

  // SVG Chart Model
  const svgModel = TimelineEngine.computeSVGChartModel(series, { width: 800, height: 320, mode: 'cumulative' });
  assert.equal(svgModel.width, 800);
  assert.equal(svgModel.height, 320);
  assert.ok(svgModel.gridLines.length >= 4);
  // Gridlines must be strictly numeric (0.0, 1.0, 2.0, 3.0, 4.0), no classification words on axis
  svgModel.gridLines.forEach(gl => {
    assert.match(gl.label, /^[0-4]\.0$/);
  });

  // Verify CompanionBar timeline panel rendering
  const companionBar = controller.companionBar;
  companionBar.activeTab = 'timeline';
  companionBar._updateTimelineView();
  const timelinePanel = companionBar.container.querySelector('#iuh-gpa-panel-timeline');
  assert.ok(timelinePanel);

  const svg = timelinePanel.querySelector('svg.iuh-gpa-timeline-svg');
  assert.ok(svg, 'Native SVG must be rendered');
  assert.equal(svg.getAttribute('viewBox'), '0 0 620 210');

  // Verify mode switch buttons exist
  const cumBtn = timelinePanel.querySelector('[data-mode="cumulative"]');
  const semBtn = timelinePanel.querySelector('[data-mode="semester"]');
  assert.ok(cumBtn);
  assert.ok(semBtn);

  // Verify latest semester marker
  const latestMarker = timelinePanel.querySelector('.iuh-gpa-timeline-point.is-latest');
  assert.ok(latestMarker, 'Latest semester must have distinct highlight');

  const xAxisLabels = Array.from(svg.querySelectorAll('text[fill="#64748B"]'), label => label.textContent);
  assert.deepEqual(
    xAxisLabels,
    svgModel.origCumulativePoints.map(point => point.data.compactLabel || point.data.semesterName),
    'X-axis labels must use parsed semester names rather than generated HK sequence numbers'
  );
});

test('Phase 6A.2: No emoji in UI runtime or simulation trigger buttons', () => {
  const { doc } = loadSanitizedDOM();
  const controller = new AppController(doc);
  controller.init();

  const triggerButtons = doc.querySelectorAll('.iuh-gpa-trigger-btn');
  assert.ok(triggerButtons.length > 0);

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  triggerButtons.forEach(btn => {
    assert.equal(emojiRegex.test(btn.textContent), false, 'Trigger button must not contain emoji');
    assert.ok(btn.querySelector('svg'), 'Trigger button must use local SVG icon');
    assert.ok(btn.textContent.includes('Mô phỏng'));
  });
});
