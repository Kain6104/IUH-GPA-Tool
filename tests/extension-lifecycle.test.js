/**
 * extension-lifecycle.test.js — Complete Teardown & Reinitialization Lifecycle Tests
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { AppController } = require('../src/ui/AppController.js');

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/grade-page.sanitized.html');

function setupTestDOM() {
  const html = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only',
  });
  return dom;
}

test('Extension Lifecycle: 1. Full teardown via AppController.destroy() restores pristine table state', () => {
  const dom = setupTestDOM();
  const doc = dom.window.document;

  const controller = new AppController(doc);
  const initResult = controller.init();
  assert.equal(initResult.success, true, 'AppController should init successfully');

  // Verify elements mounted
  const companionBar = doc.getElementById('iuh-gpa-companion-bar');
  assert.ok(companionBar, 'CompanionBar should be mounted');
  assert.ok(doc.querySelectorAll('.iuh-gpa-extension').length > 0, 'Extension elements should exist');

  // Perform clean teardown
  const destroyResult = controller.destroy();
  assert.equal(destroyResult.success, true, 'destroy() should succeed');

  // 1. CompanionBar removed
  assert.equal(doc.getElementById('iuh-gpa-companion-bar'), null, 'CompanionBar must be removed');

  // 2. All extension-owned elements removed
  const extElements = doc.querySelectorAll('.iuh-gpa-extension, [data-iuh-gpa-extension="true"]');
  assert.equal(extElements.length, 0, 'All .iuh-gpa-extension elements must be removed');

  // 3. Columns Chọn & Loại môn removed
  assert.equal(doc.querySelectorAll('.iuh-gpa-col-select').length, 0, 'Select columns removed');
  assert.equal(doc.querySelectorAll('.iuh-gpa-col-type').length, 0, 'Type columns removed');

  // 4. Trigger buttons removed
  assert.equal(doc.querySelectorAll('.iuh-gpa-trigger-btn').length, 0, 'Trigger buttons removed');

  // 5. Semester header rows colSpan restored to 27
  const semCells = doc.querySelectorAll('tbody td.row-head');
  semCells.forEach(cell => {
    assert.equal(cell.colSpan, 27, 'Semester header colSpan must be restored to 27');
    assert.equal(cell.querySelector('.iuh-gpa-semester-sticky-content'), null, 'Sticky content inner removed');
  });

  // 6. Summary rows structure restored (colSpan 2, 2, 23)
  const actualSummaryRows = doc.querySelectorAll('tbody tr:has([lang^="kqht-tkhk-"])');
  actualSummaryRows.forEach(row => {
    assert.equal(row.children.length, 3, 'Summary row must have 3 cells');
    assert.equal(row.children[0].colSpan, 2, 'Cell 1 spans 2 columns');
    assert.equal(row.children[1].colSpan, 2, 'Cell 2 spans 2 columns');
    assert.equal(row.children[2].colSpan, 23, 'Cell 3 spans 23 columns');
  });

  // 7. Official sticky columns restored (STT, Mã LHP, Tên môn, Số TC)
  const theadFirstRow = doc.querySelector('table#xemDiem_aaa thead > tr:first-child');
  assert.ok(theadFirstRow);
  assert.equal(theadFirstRow.children[0].style.left, '0px', 'Cột 0 STT restored to left 0px');
  assert.equal(theadFirstRow.children[1].style.left, '55px', 'Cột 1 Mã LHP restored to left 55px');
  assert.equal(theadFirstRow.children[2].style.left, '195px', 'Cột 2 Tên môn restored to left 195px');
  assert.equal(theadFirstRow.children[3].style.left, '575px', 'Cột 3 Số TC restored to left 575px');

  // 8. Internal state cleared
  assert.equal(controller.store, null);
  assert.equal(controller._initialized, false);
});

test('Extension Lifecycle: 2. Reinitialization works seamlessly without page reload', () => {
  const dom = setupTestDOM();
  const doc = dom.window.document;

  const controller = new AppController(doc);

  // Mount 1
  assert.equal(controller.init().success, true);
  assert.ok(doc.getElementById('iuh-gpa-companion-bar'));

  // Teardown
  assert.equal(controller.destroy().success, true);
  assert.equal(doc.getElementById('iuh-gpa-companion-bar'), null);

  // Mount 2 (same document, clean re-init)
  const controller2 = new AppController(doc);
  assert.equal(controller2.init().success, true);
  assert.ok(doc.getElementById('iuh-gpa-companion-bar'));
  assert.ok(doc.querySelectorAll('.iuh-gpa-col-select').length > 0);

  // Teardown 2
  assert.equal(controller2.destroy().success, true);
  assert.equal(doc.getElementById('iuh-gpa-companion-bar'), null);
});

test('Extension Lifecycle: 3. content.js respects iuhGpaEnabled = false on startup and onChanged', () => {
  const dom = setupTestDOM();
  const win = dom.window;

  let storageGetCallback = null;
  const storageListeners = [];

  win.chrome = {
    storage: {
      local: {
        get: (defaults, cb) => {
          // Extension is configured as DISABLED
          cb({ iuhGpaEnabled: false });
        },
      },
      onChanged: {
        addListener: (fn) => storageListeners.push(fn),
      },
    },
    runtime: {
      onMessage: { addListener: () => {} },
    },
  };

  // Provide AppController to window
  win.IUHGPA = { ui: { AppController } };

  const vm = require('vm');
  const sandbox = {
    window: win,
    document: win.document,
    Document: win.Document,
    Element: win.Element,
    HTMLElement: win.HTMLElement,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
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
    IUHGPA: { ui: { AppController } },
    chrome: win.chrome,
  };
  sandbox.globalThis = sandbox;
  sandbox.window.IUHGPA = sandbox.IUHGPA;
  sandbox.window.chrome = win.chrome;
  const context = vm.createContext(sandbox);

  // Load content.js in context
  const contentCode = fs.readFileSync(path.resolve(__dirname, '../content.js'), 'utf8');
  vm.runInContext(contentCode, context);

  // Since iuhGpaEnabled is false:
  assert.equal(Boolean(sandbox.IUHGPA_APP_MOUNTED || win.IUHGPA_APP_MOUNTED), false, 'App should NOT be mounted when iuhGpaEnabled is false');
  assert.equal(win.document.getElementById('iuh-gpa-companion-bar'), null, 'CompanionBar should not exist');
  assert.equal(win.document.querySelectorAll('.iuh-gpa-extension').length, 0, 'No extension elements should exist');

  // Now trigger storage changed: iuhGpaEnabled -> true
  storageListeners.forEach(fn => fn({ iuhGpaEnabled: { oldValue: false, newValue: true } }, 'local'));

  // Should now be mounted!
  assert.equal(Boolean(sandbox.IUHGPA_APP_MOUNTED || win.IUHGPA_APP_MOUNTED), true, 'App should be mounted after toggle ON');
  assert.ok(win.document.getElementById('iuh-gpa-companion-bar'), 'CompanionBar should now exist');

  // Trigger storage changed: iuhGpaEnabled -> false
  storageListeners.forEach(fn => fn({ iuhGpaEnabled: { oldValue: true, newValue: false } }, 'local'));

  // Should be destroyed!
  assert.equal(Boolean(sandbox.IUHGPA_APP_MOUNTED || win.IUHGPA_APP_MOUNTED), false, 'App should be unmounted after toggle OFF');
  assert.equal(win.document.getElementById('iuh-gpa-companion-bar'), null, 'CompanionBar should be destroyed');
});
