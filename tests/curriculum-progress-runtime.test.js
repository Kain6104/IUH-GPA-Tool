/**
 * curriculum-progress-runtime.test.js — SimulationStore + Curriculum Model Runtime Integration
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const rootDir = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

test('Curriculum Progress Runtime: SimulationStore getDerivedData computes progress without throwing', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only'
  });
  const sandbox = dom.window;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.global = sandbox;

  const context = vm.createContext(sandbox);

  const scriptsToLoad = manifest.content_scripts[0].js.filter(p => p !== 'content.js');
  scriptsToLoad.forEach(relPath => {
    const code = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
    vm.runInContext(code, context, { filename: relPath });
  });

  const { SimulationStore } = context.IUHGPA.state;
  assert.ok(SimulationStore, 'SimulationStore must be available in context');

  const store = new SimulationStore([
    {
      semesterKey: 'HK1',
      courses: [
        {
          id: 'c1',
          courseClassCode: 'MATH10101',
          courseName: 'Toán cao cấp',
          credits: { status: 'ok', value: 3 },
          officialResult: { total10: { status: 'ok', value: 8.0 }, score4: { status: 'ok', value: 3.5 }, letter: 'B+', passed: true }
        },
        {
          id: 'c2',
          courseClassCode: 'PHYS10101',
          courseName: 'Vật lý đại cương',
          credits: { status: 'ok', value: 3 },
          officialResult: { total10: { status: 'ok', value: 5.0 }, score4: { status: 'ok', value: 2.0 }, letter: 'C', passed: true }
        }
      ]
    }
  ]);

  const mockCurriculumModel = {
    requiredCredits: 140,
    mandatoryCredits: 110,
    electiveCredits: 30,
    totals: { totalRequiredCredits: 140, totalMandatoryCredits: 110, totalElectiveCredits: 30 },
    courses: [
      { code: 'MATH101', name: 'Toán cao cấp', credits: 3, isMandatory: true, countsTowardCumulativeGPA: true },
      { code: 'PHYS101', name: 'Vật lý đại cương', credits: 3, isMandatory: true, countsTowardCumulativeGPA: true },
      { code: 'GDTC01', name: 'Giáo dục thể chất 1', credits: 2, isMandatory: true, countsTowardCumulativeGPA: false } // Non-GPA curriculum course
    ],
    electiveGroups: []
  };

  store.setCurriculumModel(mockCurriculumModel);
  store.setCurriculumSyncStatus('SYNCED');

  assert.strictEqual(store.hasCurriculumModel(), true, 'hasCurriculumModel() must return true');

  let derived = null;
  assert.doesNotThrow(() => {
    derived = store.getDerivedData();
  }, 'store.getDerivedData() must not throw');

  assert.ok(derived, 'derivedData must exist');
  assert.ok(derived.curriculumProgress, 'curriculumProgress must be populated');
  assert.strictEqual(derived.curriculumProgress.curriculumRequiredCredits, 140);
  assert.strictEqual(derived.curriculumProgress.curriculumCompletedCredits, 6);
  assert.strictEqual(derived.curriculumProgress.curriculumRemainingCredits, 134);
  assert.strictEqual(derived.curriculumAnalyticsStatus, 'READY');
});
