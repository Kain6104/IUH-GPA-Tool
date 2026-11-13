const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { CompanionBar } = require('../src/ui/CompanionBar.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { CurriculumProgressEngine } = require('../src/core/CurriculumProgressEngine.js');

test('CTK Analytics: Non-GPA credits are excluded from gpaEligibleRemainingCredits', () => {
  // Curriculum has 144 credits:
  // 131 completed
  // 13 remaining:
  //   - 9 credits GPA-eligible
  //   - 4 credits non-GPA (e.g. GDTC / GDQP)
  const curriculumModel = {
    totalCredits: 144,
    courses: [
      { code: 'DONE', courseName: 'Đã học', credits: 131, countsTowardCumulativeGPA: true, isMandatory: true },
      { code: 'GPA_REM', courseName: 'Chuyên ngành', credits: 9, countsTowardCumulativeGPA: true, isMandatory: true },
      { code: 'GDQP', courseName: 'Giáo dục quốc phòng', credits: 4, countsTowardCumulativeGPA: false, isMandatory: true }
    ]
  };

  const gradeCourses = [
    { code: 'DONE', credits: 131, isPassed: true }
  ];

  const result = CurriculumProgressEngine.calculateProgress(curriculumModel, gradeCourses);

  assert.equal(result.curriculumRemainingCredits, 13, 'Total remaining credits = 13');
  assert.equal(result.gpaEligibleRemainingCredits, 9, 'GPA-eligible remaining credits must exclude non-GPA (13 - 4 = 9)');
});

test('CTK Analytics: CompanionBar auto-populates target remaining credits from CTK and supports manual override/restore', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="target-root"></div></body></html>');
  const doc = dom.window.document;
  const root = doc.getElementById('target-root');

  // Seed store with simulated courses
  const store = new SimulationStore([
    {
      semesterName: 'HK1',
      courses: [
        {
          id: 'c1',
          code: 'MATH01',
          courseClassCode: 'MATH01',
          courseName: 'Toán',
          credits: 131,
          officialResult: { total10: { status: 'ok', value: 8.0 }, score4: { status: 'ok', value: 3.5 }, letter: 'B+', passed: true }
        }
      ]
    }
  ]);

  const bar = new CompanionBar({
    store,
    mountParent: root,
    doc,
  });
  store.subscribe((data) => bar.update(data));
  bar.update(store.getDerivedData());

  // Switch to Analytics tab
  bar.switchTab('analytics');

  const remainingInput = root.querySelector('#iuh-gpa-target-input-remaining');
  assert.ok(remainingInput, 'Remaining credits input exists');

  // Now simulate CTK sync with 9 gpa-eligible remaining credits
  store.setCurriculumModel({
    totalCredits: 144,
    courses: [
      { code: 'MATH01', courseName: 'Toán', credits: 131, countsTowardCumulativeGPA: true },
      { code: 'MAJOR', courseName: 'Chuyên ngành', credits: 9, countsTowardCumulativeGPA: true },
      { code: 'GDQP', courseName: 'GDQP', credits: 4, countsTowardCumulativeGPA: false }
    ]
  });

  // Target input should now be automatically 9
  assert.equal(bar.remainingCredits, 9, 'Target credits automatically updated to 9 from CTK');
  assert.equal(remainingInput.value, '9', 'Input field value automatically set to 9');

  const sourceIndicator = root.querySelector('#iuh-gpa-target-source-indicator');
  assert.ok(sourceIndicator, 'Source indicator displayed');
  assert.ok(sourceIndicator.textContent.includes('Chương trình khung IUH'), 'Displays CTK source');

  // User manually edits the input to 15
  remainingInput.value = '15';
  remainingInput.dispatchEvent(new dom.window.Event('input'));

  assert.equal(bar.remainingCredits, 15, 'Target credits updated to manual value 15');
  assert.equal(bar.isRemainingCreditsManualOverride, true, 'Flagged as manual override');

  const overrideBadge = root.querySelector('#iuh-gpa-target-override-badge');
  assert.ok(overrideBadge, 'Manual override badge displayed');
  assert.notEqual(overrideBadge.style.display, 'none');

  const restoreBtn = root.querySelector('#iuh-gpa-btn-apply-ctk-credits');
  assert.ok(restoreBtn, 'Restore button exists');

  // Click restore button
  restoreBtn.click();

  assert.equal(bar.remainingCredits, 9, 'Restored to CTK value of 9');
  assert.equal(bar.isRemainingCreditsManualOverride, false, 'Manual override flag cleared');
  assert.equal(remainingInput.value, '9', 'Input reset to 9');
});
