/**
 * browser-runtime-load.test.js — Classic-Script Contract & Namespace Availability Test
 *
 * Kiểm tra:
 *  1. Đọc manifest.json, lấy danh sách content_scripts[].js theo đúng thứ tự.
 *  2. Thực thi toàn bộ script tuần tự trong CÙNG MỘT JS VM Context (mô phỏng isolated world classic script loader của Chrome).
 *  3. Xác nhận 0 SyntaxError (Identifier ... has already been declared).
 *  4. Xác nhận toàn bộ namespace IUHGPA.* tồn tại và sẵn sàng.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

test('Browser Classic-Script Execution: Zero Lexical Collision in Single VM Context', () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifestPath = path.join(rootDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.ok(manifest.content_scripts && manifest.content_scripts.length > 0, 'Manifest must declare content_scripts');
  const scripts = manifest.content_scripts[0].js;
  assert.ok(Array.isArray(scripts) && scripts.length > 0, 'content_scripts.js must be a non-empty array');

  // Khởi tạo JSDOM mô phỏng DOM sv.iuh.edu.vn
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="wrapper"></div></body></html>', {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only',
  });

  const { window } = dom;

  // Tạo sandbox context chuẩn mô phỏng Chrome Content Script isolated world
  const sandbox = {
    window,
    document: window.document,
    Document: window.Document,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    HTMLTableRowElement: window.HTMLTableRowElement,
    SVGElement: window.SVGElement,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    DOMParser: window.DOMParser,
    Blob: window.Blob,
    URL: window.URL,
    Map,
    Set,
    JSON,
    Math,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Error,
    TypeError,
    SyntaxError,
    RangeError,
    chrome: {
      runtime: {
        onMessage: {
          addListener: () => {},
        },
        sendMessage: () => {},
      },
    },
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const context = vm.createContext(sandbox);

  // Nạp tuần tự tất cả file JS trong cùng một VM Context
  const executionErrors = [];
  scripts.forEach((relPath) => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Script file does not exist: ${relPath}`);
    const code = fs.readFileSync(fullPath, 'utf8');

    try {
      vm.runInContext(code, context, { filename: relPath });
    } catch (err) {
      executionErrors.push({ file: relPath, error: err });
    }
  });

  // Khẳng định không có bất kỳ lỗi SyntaxError hoặc ReferenceError nào khi load tuần tự
  if (executionErrors.length > 0) {
    const details = executionErrors.map(e => `${e.file}: ${e.error.name} - ${e.error.message}`).join('\n');
    assert.fail(`Errors occurred while loading scripts in shared VM context:\n${details}`);
  }

  // Khẳng định namespace IUHGPA được cấu trúc chuẩn và đầy đủ
  const IUHGPA = context.IUHGPA;
  assert.ok(IUHGPA, 'globalThis.IUHGPA must be defined');

  // 1. Parsers
  assert.ok(IUHGPA.parsers, 'IUHGPA.parsers must exist');
  assert.ok(typeof IUHGPA.parsers.NumberParser?.parseScore === 'function', 'IUHGPA.parsers.NumberParser.parseScore must be a function');
  assert.ok(typeof IUHGPA.parsers.HeaderGridParser?.parse === 'function', 'IUHGPA.parsers.HeaderGridParser.parse must be a function');

  // 2. Adapters
  assert.ok(IUHGPA.adapters, 'IUHGPA.adapters must exist');
  assert.ok(typeof IUHGPA.adapters.IUHPageAdapter === 'function', 'IUHGPA.adapters.IUHPageAdapter must be a function');
  assert.ok(typeof IUHGPA.adapters.IUHCurriculumAdapter === 'function', 'IUHGPA.adapters.IUHCurriculumAdapter must be a function');

  // 3. Core Engines
  assert.ok(IUHGPA.core, 'IUHGPA.core must exist');
  assert.ok(typeof IUHGPA.core.CourseIdentityMatcher === 'function', 'IUHGPA.core.CourseIdentityMatcher must exist');
  assert.ok(typeof IUHGPA.core.GradingRuleEngine === 'function', 'IUHGPA.core.GradingRuleEngine must exist');
  assert.ok(typeof IUHGPA.core.GPAEngine === 'function', 'IUHGPA.core.GPAEngine must exist');
  assert.ok(typeof IUHGPA.core.RequiredScoreEngine === 'function', 'IUHGPA.core.RequiredScoreEngine must exist');
  assert.ok(typeof IUHGPA.core.GPATargetEngine === 'function', 'IUHGPA.core.GPATargetEngine must exist');
  assert.ok(typeof IUHGPA.core.ForecastEngine === 'function', 'IUHGPA.core.ForecastEngine must exist');
  assert.ok(typeof IUHGPA.core.GPARescueEngine === 'function', 'IUHGPA.core.GPARescueEngine must exist');
  assert.ok(typeof IUHGPA.core.ScenarioEngine === 'function', 'IUHGPA.core.ScenarioEngine must exist');
  assert.ok(typeof IUHGPA.core.RiskEngine === 'function', 'IUHGPA.core.RiskEngine must exist');
  assert.ok(typeof IUHGPA.core.SemesterSummaryEngine === 'function', 'IUHGPA.core.SemesterSummaryEngine must exist');
  assert.ok(typeof IUHGPA.core.TimelineEngine === 'function', 'IUHGPA.core.TimelineEngine must exist');
  assert.ok(typeof IUHGPA.core.ExportEngine === 'function', 'IUHGPA.core.ExportEngine must exist');
  assert.ok(typeof IUHGPA.core.FutureSemesterEngine === 'function', 'IUHGPA.core.FutureSemesterEngine must exist');

  // 4. State
  assert.ok(IUHGPA.state, 'IUHGPA.state must exist');
  assert.ok(typeof IUHGPA.state.SimulationStore === 'function', 'IUHGPA.state.SimulationStore must exist');
  assert.ok(typeof IUHGPA.state.selectors?.selectOverallComparison === 'function', 'IUHGPA.state.selectors must exist');

  // 5. UI
  assert.ok(IUHGPA.ui, 'IUHGPA.ui must exist');
  assert.ok(typeof IUHGPA.ui.CompanionBar === 'function', 'IUHGPA.ui.CompanionBar must exist');
  assert.ok(typeof IUHGPA.ui.CourseSimulationPanel === 'function', 'IUHGPA.ui.CourseSimulationPanel must exist');
  assert.ok(typeof IUHGPA.ui.AppController === 'function', 'IUHGPA.ui.AppController must exist');
  assert.ok(typeof IUHGPA.AppController === 'function', 'IUHGPA.AppController root shortcut must exist');
});
