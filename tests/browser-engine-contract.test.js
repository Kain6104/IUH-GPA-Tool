/**
 * browser-engine-contract.test.js — Browser Engine Contract & Consumer Parity Test
 *
 * PHASE 6A.5.2 REGRESSION TEST:
 * Loads manifest.json content scripts in the EXACT order in a single VM context.
 * Asserts all engine methods used by consumers exist and are functions on IUHGPA.core.*.
 * Asserts parity with Node require() exports.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const rootDir = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));

// Expected methods that actual consumers call across the codebase
const CONSUMER_CONTRACT_MATRIX = [
  {
    engine: 'GradingRuleEngine',
    modulePath: 'src/core/GradingRuleEngine.js',
    methods: [
      'convertScore10',
      'getClassification4',
      'getClassification10',
      'calculateCourse',
      'isFinalExamFailed',
      'detectRule',
      'inferCourseType',
      'isNonGpaCourseFallback'
    ]
  },
  {
    engine: 'GPAEngine',
    modulePath: 'src/core/GPAEngine.js',
    methods: [
      'calculateGPA',
      'calculateCumulativeGPA'
    ]
  },
  {
    engine: 'RequiredScoreEngine',
    modulePath: 'src/core/RequiredScoreEngine.js',
    methods: [
      'calculateRequiredFinal',
      'calculateAllTargets'
    ]
  },
  {
    engine: 'GPATargetEngine',
    modulePath: 'src/core/GPATargetEngine.js',
    methods: [
      'calculateRequiredFutureGPA',
      'getPresets'
    ]
  },
  {
    engine: 'ForecastEngine',
    modulePath: 'src/core/ForecastEngine.js',
    methods: [
      'calculateProjectedGPA',
      'generateForecastTable'
    ]
  },
  {
    engine: 'GPARescueEngine',
    modulePath: 'src/core/GPARescueEngine.js',
    methods: [
      'analyzeRescuePriorities'
    ]
  },
  {
    engine: 'ScenarioEngine',
    modulePath: 'src/core/ScenarioEngine.js',
    methods: [
      'compareScenarios'
    ]
  },
  {
    engine: 'RiskEngine',
    modulePath: 'src/core/RiskEngine.js',
    methods: [
      'assessCourseRisk'
    ]
  },
  {
    engine: 'TimelineEngine',
    modulePath: 'src/core/TimelineEngine.js',
    methods: [
      'generateTimelineData',
      'computeSVGChartModel'
    ]
  },
  {
    engine: 'CourseIdentityMatcher',
    modulePath: 'src/core/CourseIdentityMatcher.js',
    methods: [
      'matchAll',
      'normalizeCode'
    ]
  },
  {
    engine: 'FutureSemesterEngine',
    modulePath: 'src/core/FutureSemesterEngine.js',
    methods: [
      'getCoursePool',
      'createFutureSemester',
      'calculateFutureSemesterGPA',
      'calculateProjectedCumulativeGPA',
      'generateNextSemesterOptions',
      'recalculateFutureCourse',
      'addCourseToSemester',
      'removeCourse',
      'removeSemester',
      'moveCourse',
      'applyWhatIfPreset',
      'restoreWhatIfPreset',
      'assignFutureDisplayOrdinals'
    ]
  },
  {
    engine: 'CurriculumProgressEngine',
    modulePath: 'src/core/CurriculumProgressEngine.js',
    methods: [
      'calculateProgress'
    ]
  },
  {
    engine: 'PlanCoverageEngine',
    modulePath: 'src/core/PlanCoverageEngine.js',
    methods: [
      'analyzePlanCoverage'
    ]
  },
  {
    engine: 'CurriculumGapEngine',
    modulePath: 'src/core/CurriculumGapEngine.js',
    methods: [
      'detectGaps'
    ]
  }
];

test('Browser Engine Contract: All engine methods exist on IUHGPA.core and match Node exports', () => {
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

  // Load scripts according to manifest order (excluding content.js)
  const scriptsToLoad = manifest.content_scripts[0].js.filter(p => p !== 'content.js');
  scriptsToLoad.forEach(relPath => {
    const code = fs.readFileSync(path.join(rootDir, relPath), 'utf8');
    vm.runInContext(code, context, { filename: relPath });
  });

  const IUHGPA = context.IUHGPA;
  assert.ok(IUHGPA, 'IUHGPA root namespace must exist');
  assert.ok(IUHGPA.core, 'IUHGPA.core namespace must exist');

  // Verify each contract entry
  CONSUMER_CONTRACT_MATRIX.forEach(({ engine, modulePath, methods }) => {
    const browserEngine = IUHGPA.core[engine];
    assert.ok(browserEngine, `IUHGPA.core.${engine} must exist in browser context`);

    const nodeModule = require(path.join(rootDir, modulePath));
    const nodeEngine = nodeModule[engine] || nodeModule;

    methods.forEach(method => {
      // 1. Browser namespace check
      assert.strictEqual(
        typeof browserEngine[method],
        'function',
        `Browser runtime error: IUHGPA.core.${engine}.${method} is not a function (actual: ${typeof browserEngine[method]})`
      );

      // 2. Node module check
      assert.strictEqual(
        typeof nodeEngine[method],
        'function',
        `Node module error: require('${modulePath}').${engine}.${method} is not a function`
      );
    });
  });
});

test('Manifest Script Order: Curriculum engines load BEFORE SimulationStore', () => {
  const scripts = manifest.content_scripts[0].js;
  const progressIdx = scripts.indexOf('src/core/CurriculumProgressEngine.js');
  const coverageIdx = scripts.indexOf('src/core/PlanCoverageEngine.js');
  const gapIdx = scripts.indexOf('src/core/CurriculumGapEngine.js');
  const storeIdx = scripts.indexOf('src/state/SimulationStore.js');

  assert.ok(progressIdx !== -1, 'CurriculumProgressEngine must be in manifest');
  assert.ok(coverageIdx !== -1, 'PlanCoverageEngine must be in manifest');
  assert.ok(gapIdx !== -1, 'CurriculumGapEngine must be in manifest');
  assert.ok(storeIdx !== -1, 'SimulationStore must be in manifest');

  assert.ok(progressIdx < storeIdx, 'CurriculumProgressEngine must load before SimulationStore');
  assert.ok(coverageIdx < storeIdx, 'PlanCoverageEngine must load before SimulationStore');
  assert.ok(gapIdx < storeIdx, 'CurriculumGapEngine must load before SimulationStore');
});
