/**
 * manifest-no-duplicate-scripts.test.js — Manifest Script Audit Test
 *
 * Kiểm tra:
 *  1. manifest.json không chứa duplicate entries trong content_scripts[].js.
 *  2. Các file khai báo trong manifest đều tồn tại trên ổ đĩa.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('Manifest: No Duplicate Script Files Declared in content_scripts', () => {
  const manifestPath = path.resolve(__dirname, '../manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.ok(manifest.content_scripts, 'manifest.json must have content_scripts');

  manifest.content_scripts.forEach((entry, idx) => {
    const scripts = entry.js || [];
    const seen = new Set();
    const duplicates = [];

    scripts.forEach((file) => {
      if (seen.has(file)) {
        duplicates.push(file);
      }
      seen.add(file);

      // Verify file exists
      const fullPath = path.resolve(__dirname, '..', file);
      assert.ok(fs.existsSync(fullPath), `Declared script file not found on disk: ${file}`);
    });

    assert.strictEqual(
      duplicates.length,
      0,
      `Duplicate script entries found in content_scripts[${idx}].js: ${duplicates.join(', ')}`
    );
  });
});
