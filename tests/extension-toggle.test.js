/**
 * extension-toggle.test.js — Persistence & Switch Toggle Tests for IUH GPA Tool
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const popupHtmlPath = path.resolve(__dirname, '../popup.html');

function createMockChrome(initialStorage = {}, tabsList = [{ id: 1, url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html' }]) {
  const storageData = { ...initialStorage };
  const storageListeners = [];
  const reloadedTabs = [];

  return {
    storageData,
    reloadedTabs,
    chrome: {
      storage: {
        local: {
          get: (keys, callback) => {
            const result = {};
            if (typeof keys === 'object' && keys !== null) {
              for (const [k, defaultVal] of Object.entries(keys)) {
                result[k] = storageData[k] !== undefined ? storageData[k] : defaultVal;
              }
            } else if (typeof keys === 'string') {
              result[keys] = storageData[keys];
            }
            callback(result);
          },
          set: (items, callback) => {
            const changes = {};
            for (const [k, v] of Object.entries(items)) {
              changes[k] = { oldValue: storageData[k], newValue: v };
              storageData[k] = v;
            }
            storageListeners.forEach((fn) => fn(changes, 'local'));
            if (callback) callback();
          },
        },
        onChanged: {
          addListener: (fn) => storageListeners.push(fn),
        },
      },
      tabs: {
        query: (opts, cb) => cb(tabsList),
        sendMessage: (id, msg, cb) => cb && cb({ enabled: true, active: true }),
        create: () => {},
        reload: (tabId) => {
          reloadedTabs.push(tabId);
        },
      },
      runtime: {
        lastError: null,
      },
    },
  };
}

test('Extension Toggle: 1. Default state is enabled (true) if not set in storage', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const { chrome } = createMockChrome({});
  dom.window.chrome = chrome;

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');
  const indText = dom.window.document.getElementById('indicator-text');
  const toggleDesc = dom.window.document.getElementById('toggle-desc');

  assert.equal(toggle.checked, true, 'Switch should default to checked');
  assert.equal(indText.textContent.trim(), 'Đang hoạt động');
  assert.equal(toggleDesc.textContent.trim(), 'Đang hoạt động trên trang Kết quả học tập');
});

test('Extension Toggle: 2. Toggling switch to OFF persists false and updates UI', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const mock = createMockChrome({});
  dom.window.chrome = mock.chrome;

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');
  const indText = dom.window.document.getElementById('indicator-text');
  const toggleDesc = dom.window.document.getElementById('toggle-desc');
  const pageStatus = dom.window.document.getElementById('page-status');

  // User flips switch to OFF
  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event('change'));

  assert.equal(mock.storageData.iuhGpaEnabled, false, 'Storage must persist iuhGpaEnabled = false');
  assert.equal(indText.textContent.trim(), 'Đã tắt');
  assert.equal(toggleDesc.textContent.trim(), 'Tiện ích đang tạm tắt');
  assert.equal(pageStatus.textContent.trim(), 'Tiện ích đang tắt');
});

test('Extension Toggle: 3. Reloading popup when disabled maintains OFF state', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  // Initial storage has iuhGpaEnabled: false
  const mock = createMockChrome({ iuhGpaEnabled: false });
  dom.window.chrome = mock.chrome;

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');
  const indText = dom.window.document.getElementById('indicator-text');
  const toggleDesc = dom.window.document.getElementById('toggle-desc');
  const pageStatus = dom.window.document.getElementById('page-status');
  const gpa4 = dom.window.document.getElementById('popup-gpa4');
  const gpa10 = dom.window.document.getElementById('popup-gpa10');
  const resetBtn = dom.window.document.getElementById('btn-reset-sim');

  assert.equal(toggle.checked, false, 'Switch must be unchecked');
  assert.equal(indText.textContent.trim(), 'Đã tắt');
  assert.equal(toggleDesc.textContent.trim(), 'Tiện ích đang tạm tắt');
  assert.equal(pageStatus.textContent.trim(), 'Tiện ích đang tắt');
  assert.equal(gpa4.textContent.trim(), '--');
  assert.equal(gpa10.textContent.trim(), '--');
  assert.equal(resetBtn.disabled, true);
});

test('Extension Toggle: 4. Toggling from OFF to ON persists true and re-enables UI', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const mock = createMockChrome({ iuhGpaEnabled: false });
  dom.window.chrome = mock.chrome;

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');
  const indText = dom.window.document.getElementById('indicator-text');
  const toggleDesc = dom.window.document.getElementById('toggle-desc');

  // User flips switch back to ON
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event('change'));

  assert.equal(mock.storageData.iuhGpaEnabled, true, 'Storage must persist iuhGpaEnabled = true');
  assert.equal(indText.textContent.trim(), 'Đang hoạt động');
  assert.equal(toggleDesc.textContent.trim(), 'Đang hoạt động trên trang Kết quả học tập');
});

test('Extension Toggle: 5. storage.onChanged updates popup dynamically without reload', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const mock = createMockChrome({ iuhGpaEnabled: true });
  dom.window.chrome = mock.chrome;

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');
  const indText = dom.window.document.getElementById('indicator-text');

  assert.equal(toggle.checked, true);

  // External trigger (e.g. from background or another window)
  mock.chrome.storage.local.set({ iuhGpaEnabled: false });

  assert.equal(toggle.checked, false);
  assert.equal(indText.textContent.trim(), 'Đã tắt');
});

test('Extension Toggle: 6. Toggling switch automatically reloads active IUH grade tab', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const mock = createMockChrome({}, [{ id: 42, url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html' }]);
  dom.window.chrome = mock.chrome;

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');

  // Toggle switch to OFF
  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event('change'));

  assert.equal(mock.reloadedTabs.length, 1, 'Should have triggered tab reload once on toggle OFF');
  assert.equal(mock.reloadedTabs[0], 42, 'Should reload the active IUH grade tab (id: 42)');

  // Toggle switch back to ON
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event('change'));

  assert.equal(mock.reloadedTabs.length, 2, 'Should have triggered tab reload again on toggle ON');
  assert.equal(mock.reloadedTabs[1], 42, 'Should reload the active IUH grade tab again');
});

test('Extension Toggle: 7. Toggling switch does not reload tabs if active tab is non-IUH', () => {
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  const mock = createMockChrome({}, [{ id: 99, url: 'https://google.com' }]);
  dom.window.chrome = mock.chrome;

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');

  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event('change'));

  assert.equal(mock.reloadedTabs.length, 0, 'Must NOT reload non-IUH tabs');
});
