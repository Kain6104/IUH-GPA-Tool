/**
 * ui-emoji-cleanup.test.js — Production UI Emoji Elimination & Local SVG Validation Test
 *
 * Kiểm tra:
 *  1. Toàn bộ production UI/runtime files không chứa emoji hay ký hiệu tượng hình cũ.
 *  2. .iuh-gpa-trigger-btn sử dụng local inline SVG icon + text chuẩn ("Mô phỏng").
 *  3. Không có bất kỳ liên kết CDN / font icon / remote icon nào.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { AppController } = require('../src/ui/AppController.js');

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}⚡🔍📊🎯🎓💡🚀❌⚠️✅🔄📈📉🗑️💾📋🛡️✕✓]/u;

test('Emoji Cleanup: Production runtime files contain 0 emojis or pictorial symbols', () => {
  const rootDir = path.resolve(__dirname, '..');
  const filesToCheck = [
    'src/ui/AppController.js',
    'src/ui/CompanionBar.js',
    'src/ui/CourseSimulationPanel.js',
    'src/ui/styles.css',
    'content.js',
    'popup.html',
    'popup.js',
  ];

  filesToCheck.forEach((rel) => {
    const fullPath = path.join(rootDir, rel);
    const content = fs.readFileSync(fullPath, 'utf8');
    const match = EMOJI_REGEX.exec(content);
    assert.strictEqual(
      match,
      null,
      `File ${rel} contains forbidden emoji/symbol: "${match ? match[0] : ''}"`
    );
  });
});

test('Trigger Button: .iuh-gpa-trigger-btn uses local SVG icon and text without emoji', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const dom = new JSDOM(html, {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only',
  });

  const { document } = dom.window;
  const controller = new AppController(document);
  const result = controller.init();
  assert.strictEqual(result.success, true, 'AppController should initialize');

  const triggerButtons = document.querySelectorAll('.iuh-gpa-trigger-btn');
  assert.ok(triggerButtons.length > 0, 'Trigger buttons must be rendered for course rows');

  triggerButtons.forEach((btn) => {
    // 1. Phải chứa phần tử svg local inline
    const svg = btn.querySelector('svg');
    assert.ok(svg, 'Trigger button must contain an inline SVG icon');
    assert.strictEqual(svg.getAttribute('aria-hidden'), 'true', 'SVG icon must have aria-hidden="true"');
    assert.strictEqual(svg.getAttribute('fill'), 'none', 'SVG icon must use fill="none"');
    assert.strictEqual(svg.getAttribute('stroke'), 'currentColor', 'SVG icon must use stroke="currentColor"');

    // 2. Text phải là "Mô phỏng", tuyệt đối không chứa emoji ⚡
    const text = btn.textContent;
    assert.strictEqual(text.includes('⚡'), false, 'Trigger button must NOT contain ⚡ emoji');
    assert.ok(text.includes('Mô phỏng'), 'Trigger button must contain "Mô phỏng" text');
  });
});

test('No Remote Icon Fonts: Stylesheet and popup do not load external fonts or CDNs', () => {
  const rootDir = path.resolve(__dirname, '..');
  const stylesCss = fs.readFileSync(path.join(rootDir, 'src/ui/styles.css'), 'utf8');
  const popupHtml = fs.readFileSync(path.join(rootDir, 'popup.html'), 'utf8');

  // Kiểm tra font-awesome, google fonts, cdnjs, unpkg, v.v.
  const remotePatterns = [/font-awesome/i, /fontawesome/i, /fonts\.googleapis/i, /cdnjs/i, /unpkg/i, /jsdelivr/i];

  remotePatterns.forEach((re) => {
    assert.strictEqual(re.test(stylesCss), false, `styles.css must not reference remote font: ${re}`);
    assert.strictEqual(re.test(popupHtml), false, `popup.html must not reference remote font: ${re}`);
  });
});
