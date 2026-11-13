/**
 * popup-ui.test.js — UI & Layout Verification for IUH GPA Tool Premium Popup
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const popupHtmlPath = path.resolve(__dirname, '../popup.html');
const popupJsPath = path.resolve(__dirname, '../popup.js');

function setupPopupDOM() {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'chrome-extension://mock-id/popup.html',
  });
  return dom;
}

test('Popup UI: 1. Header contains required titles, badge, and indicator without emoji', () => {
  const dom = setupPopupDOM();
  const doc = dom.window.document;

  const badge = doc.querySelector('.badge-tag');
  assert.ok(badge, 'Badge tag must exist');
  assert.equal(badge.textContent.trim(), 'IUH GPA TOOL');

  const title = doc.querySelector('.header-title');
  assert.ok(title, 'Header title must exist');
  assert.equal(title.textContent.trim(), 'Tính Điểm IUH');

  const subtitle = doc.querySelector('.header-subtitle');
  assert.ok(subtitle, 'Header subtitle must exist');
  assert.equal(subtitle.textContent.trim(), 'Trợ lý học tập & mô phỏng GPA');

  const dot = doc.querySelector('.indicator-dot');
  const indText = doc.querySelector('.indicator-text');
  assert.ok(dot, 'Indicator dot element must exist');
  assert.ok(indText, 'Indicator text element must exist');

  // Verify no emoji in header text
  const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}⚡🔍📊🎯🎓💡🚀❌⚠️✅🔄📈📉🗑️💾📋🛡️✕✓]/u;
  assert.equal(EMOJI_REGEX.test(doc.querySelector('.header').textContent), false);
});

test('Popup UI: 2. Switch component has accessible label and correct structure', () => {
  const dom = setupPopupDOM();
  const doc = dom.window.document;

  const toggle = doc.getElementById('extension-toggle');
  assert.ok(toggle, 'Toggle input must exist');
  assert.equal(toggle.getAttribute('type'), 'checkbox');
  assert.equal(toggle.getAttribute('aria-label'), 'Bật hoặc tắt IUH GPA Tool');

  const cardTitle = doc.querySelector('.card-title');
  assert.equal(cardTitle?.textContent.trim(), 'Tiện ích');

  const toggleDesc = doc.getElementById('toggle-desc');
  assert.ok(toggleDesc, 'Toggle description must exist');
});

test('Popup UI: 3. GPA cards are rendered in 2-column layout with official labels', () => {
  const dom = setupPopupDOM();
  const doc = dom.window.document;

  const gpaGrid = doc.getElementById('gpa-grid');
  assert.ok(gpaGrid, 'GPA grid must exist');

  const cards = doc.querySelectorAll('.gpa-card');
  assert.equal(cards.length, 2, 'Must have exactly 2 GPA cards');

  const gpa4 = doc.getElementById('popup-gpa4');
  const gpa10 = doc.getElementById('popup-gpa10');
  assert.ok(gpa4, 'GPA 4 element must exist');
  assert.ok(gpa10, 'GPA 10 element must exist');

  assert.equal(cards[0].querySelector('.gpa-card-label')?.textContent.trim(), 'GPA HỆ 4');
  assert.equal(cards[1].querySelector('.gpa-card-label')?.textContent.trim(), 'GPA HỆ 10');
});

test('Popup UI: 4. Action buttons have proper attributes and SVG icons', () => {
  const dom = setupPopupDOM();
  const doc = dom.window.document;

  const openBtn = doc.getElementById('btn-open-iuh');
  assert.ok(openBtn, 'Open IUH button must exist');
  assert.equal(openBtn.getAttribute('type'), 'button');
  assert.ok(openBtn.querySelector('svg'), 'Open IUH button must contain inline SVG');

  const resetBtn = doc.getElementById('btn-reset-sim');
  assert.ok(resetBtn, 'Reset button must exist');
  assert.equal(resetBtn.getAttribute('type'), 'button');
  assert.equal(resetBtn.disabled, true, 'Reset button must be disabled by default');
  assert.ok(resetBtn.querySelector('svg'), 'Reset button must contain inline SVG');
});

test('Popup UI: 5. Footer contains accurate privacy notice and developer credit', () => {
  const dom = setupPopupDOM();
  const doc = dom.window.document;

  const privacy = doc.querySelector('.footer-privacy');
  assert.ok(privacy, 'Privacy notice must exist');
  assert.equal(
    privacy.textContent.trim(),
    'Dữ liệu học tập không được gửi tới máy chủ của nhà phát triển.'
  );

  const devLink = doc.getElementById('dev-credit-link');
  assert.ok(devLink, 'Developer credit link must exist');
  assert.equal(devLink.textContent.trim(), 'Kain');
  assert.equal(devLink.getAttribute('href'), 'https://www.facebook.com/htphat.04');
});

test('Popup UI: 6. Developer link click invokes chrome.tabs.create with exact Facebook URL', () => {
  const dom = setupPopupDOM();
  const win = dom.window;

  let createdUrl = null;
  win.chrome = {
    tabs: {
      create: (opts) => {
        createdUrl = opts.url;
      },
      query: (opts, cb) => cb([]),
    },
    storage: {
      local: {
        get: (defaults, cb) => cb(defaults),
        set: (data, cb) => cb && cb(),
      },
      onChanged: { addListener: () => {} },
    },
  };

  const { initPopup } = require('../popup.js');
  initPopup(win.document, win.chrome);

  const devLink = win.document.getElementById('dev-credit-link');
  assert.ok(devLink);
  devLink.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));

  assert.equal(createdUrl, 'https://www.facebook.com/htphat.04');
});

test('Popup UI: 7. No remote fonts, CDN links, or emojis in popup HTML and JS', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const js = fs.readFileSync(popupJsPath, 'utf8');

  const forbiddenRemote = [/fonts\.googleapis/i, /cdnjs/i, /unpkg\.com/i, /jsdelivr\.net/i];
  for (const re of forbiddenRemote) {
    assert.equal(re.test(html), false, `popup.html must not contain ${re}`);
    assert.equal(re.test(js), false, `popup.js must not contain ${re}`);
  }

  const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}⚡🔍📊🎯🎓💡🚀❌⚠️✅🔄📈📉🗑️💾📋🛡️✕✓]/u;
  assert.equal(EMOJI_REGEX.test(html), false, 'popup.html must not contain emojis');
  assert.equal(EMOJI_REGEX.test(js), false, 'popup.js must not contain emojis');
});
