/**
 * ui-single-mount.test.js — UI Idempotent Single Mount Test
 *
 * Kiểm tra:
 *  1. Khi content script chạy lần đầu, UI mount vào DOM (tạo #iuh-gpa-companion-bar).
 *  2. Khi content script chạy lần hai (do page navigation hoặc script re-execution), UI mount count vẫn là 1.
 *  3. Không tạo duplicate companion bars hoặc duplicate elements.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

test('UI Idempotency: Multiple initializations mount UI exactly once', () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
  const scripts = manifest.content_scripts[0].js;

  // Đọc fixture HTML thực tế từ tests/fixtures/grade-page.sanitized.html
  const fixturePath = path.join(rootDir, 'tests/fixtures/grade-page.sanitized.html');
  const htmlContent = fs.readFileSync(fixturePath, 'utf8');

  const dom = new JSDOM(htmlContent, {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only',
  });

  const { window } = dom;

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

  // Load tất cả các file trong manifest
  scripts.forEach((relPath) => {
    const fullPath = path.join(rootDir, relPath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInContext(code, context, { filename: relPath });
  });

  // Trigger DOMContentLoaded if still loading
  if (window.document.readyState === 'loading') {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  }

  // Kiểm tra số lượng #iuh-gpa-companion-bar sau lần load đầu tiên
  const barsAfterFirstLoad = window.document.querySelectorAll('#iuh-gpa-companion-bar');
  assert.strictEqual(barsAfterFirstLoad.length, 1, 'CompanionBar must mount exactly once on first run');

  // Mô phỏng chạy lại content.js lần 2
  const contentJsCode = fs.readFileSync(path.join(rootDir, 'content.js'), 'utf8');
  vm.runInContext(contentJsCode, context, { filename: 'content.js' });

  // Kiểm tra số lượng sau lần load thứ 2
  const barsAfterSecondLoad = window.document.querySelectorAll('#iuh-gpa-companion-bar');
  assert.strictEqual(barsAfterSecondLoad.length, 1, 'CompanionBar must not duplicate on second execution');
});
