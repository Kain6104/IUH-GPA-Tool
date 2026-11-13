/**
 * popup-storage.test.js — Storage Integrity & Non-Sensitive Data Compliance Tests
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

test('Storage Audit: 1. Manifest permissions contains strictly storage', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../manifest.json'), 'utf8'));
  assert.deepEqual(manifest.permissions, ['storage']);
});

test('Storage Audit: 2. Storage set operations only store iuhGpaEnabled and zero sensitive data', () => {
  const popupHtmlPath = path.resolve(__dirname, '../popup.html');
  const html = fs.readFileSync(popupHtmlPath, 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only' });

  const writtenKeys = new Set();
  const writtenPayloads = [];

  dom.window.chrome = {
    storage: {
      local: {
        get: (defaults, cb) => cb(defaults),
        set: (obj, cb) => {
          Object.keys(obj).forEach((k) => writtenKeys.add(k));
          writtenPayloads.push(obj);
          if (cb) cb();
        },
      },
      onChanged: { addListener: () => {} },
    },
    tabs: {
      query: (opts, cb) => cb([]),
    },
  };

  const { initPopup } = require('../popup.js');
  initPopup(dom.window.document, dom.window.chrome);

  const toggle = dom.window.document.getElementById('extension-toggle');
  assert.ok(toggle);

  // Toggle OFF
  toggle.checked = false;
  toggle.dispatchEvent(new dom.window.Event('change'));

  // Toggle ON
  toggle.checked = true;
  toggle.dispatchEvent(new dom.window.Event('change'));

  // Verify only allowed keys
  const allowedKeys = new Set(['iuhGpaEnabled']);
  for (const key of writtenKeys) {
    assert.ok(allowedKeys.has(key), `Unapproved key found in storage: ${key}`);
  }

  // Audit against sensitive fields
  const forbiddenSensitiveKeys = [
    'score', 'scores', 'diem', 'mssv', 'studentId', 'name', 'hoTen', 'email',
    'curriculum', 'ctk', 'token', 'cookie', 'password', 'auth'
  ];

  for (const payload of writtenPayloads) {
    const payloadStr = JSON.stringify(payload).toLowerCase();
    for (const forbidden of forbiddenSensitiveKeys) {
      assert.equal(
        payloadStr.includes(`"${forbidden}"`),
        false,
        `Sensitive keyword "${forbidden}" detected in storage payload: ${payloadStr}`
      );
    }
  }
});

test('Storage Audit: 3. Codebases contain 0 calls writing scores or PII to storage', () => {
  const rootDir = path.resolve(__dirname, '..');
  const codeFiles = ['popup.js', 'content.js', 'src/ui/AppController.js'];

  for (const file of codeFiles) {
    const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
    const storageSetRegex = /chrome\.storage\.local\.set\s*\(\s*\{([^}]+)\}/g;
    let match;
    while ((match = storageSetRegex.exec(content)) !== null) {
      const payloadContent = match[1];
      assert.ok(
        payloadContent.includes('iuhGpaEnabled'),
        `Unexpected storage set payload in ${file}: ${payloadContent}`
      );
    }
  }
});
