/**
 * ctk-analytics-decoupling.test.js — CTK Retrieval & Analytics Decoupling Safety Test
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { SimulationStore } = require('../src/state/SimulationStore.js');

test('Decoupling: Progress engine failure does NOT mark CTK sync as FAILED', () => {
  const store = new SimulationStore([]);

  const validModel = {
    requiredCredits: 120,
    courses: [{ code: 'CS101', credits: 4, isMandatory: true }],
    electiveGroups: []
  };

  // 1. Model set and marked SYNCED
  store.setCurriculumModel(validModel);
  store.setCurriculumSyncStatus('SYNCED');

  assert.strictEqual(store.hasCurriculumModel(), true);
  assert.strictEqual(store.getCurriculumSyncStatus().status, 'SYNCED');

  // 2. Intentionally inject an engine that throws during calculation
  const brokenEngine = {
    calculateProgress: () => {
      throw new TypeError('Simulated unexpected engine calculation error');
    }
  };

  global.IUHGPA = global.IUHGPA || { core: {} };
  const origEngine = global.IUHGPA.core.CurriculumProgressEngine;
  global.IUHGPA.core.CurriculumProgressEngine = brokenEngine;
  store._isDirty = true; // Ensure recomputation

  try {
    let derived = null;
    assert.doesNotThrow(() => {
      derived = store.getDerivedData();
    }, 'getDerivedData must never throw even if analytics engine crashes');

    // 3. Crucial Assertions:
    // CTK Sync Status MUST remain SYNCED (retrieval succeeded)
    assert.strictEqual(store.getCurriculumSyncStatus().status, 'SYNCED', 'Curriculum sync status must stay SYNCED');

    // Analytics status is typed as ENGINE_ERROR, NOT fake zero numbers
    assert.strictEqual(store.getCurriculumAnalyticsStatus(), 'ENGINE_ERROR', 'Analytics status must indicate ENGINE_ERROR');
    assert.strictEqual(derived.curriculumProgress, null, 'Broken analytics must yield null, not misleading fake zero numbers');
    assert.strictEqual(derived.curriculumAnalyticsStatus, 'ENGINE_ERROR');
  } finally {
    global.IUHGPA.core.CurriculumProgressEngine = origEngine;
    store._isDirty = true;
  }
});
