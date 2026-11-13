/**
 * stacking-contract.test.js — Structural Stacking Context Prerequisite Test
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, '../src/ui/styles.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

test('Stacking Architecture: CompanionBar has high stacking layer and opaque white background', () => {
  assert.ok(
    cssContent.includes('z-index: 950'),
    'CompanionBar must have z-index 950'
  );
  assert.ok(
    cssContent.includes('background: #FFFFFF !important;') || cssContent.includes('background: #FFFFFF;'),
    'CompanionBar background must be opaque #FFFFFF'
  );
  assert.ok(
    cssContent.includes('position: sticky'),
    'CompanionBar must have position: sticky'
  );
});

test('Stacking Architecture: Table wrapper creates isolated stacking context lower than CompanionBar', () => {
  assert.ok(
    cssContent.includes('z-index: 10 !important;'),
    'Table wrapper must have z-index: 10 !important to isolate table columns into a lower stacking context'
  );
  assert.ok(
    cssContent.includes('position: relative !important;'),
    'Table wrapper must have position: relative !important'
  );
});

test('Stacking Architecture: Sticky column cells are bounded inside table layer', () => {
  // Sticky header in table wrapper adheres to IUH's native 1001 / 1002 stacking
  assert.ok(
    cssContent.includes('z-index: 1001 !important;') || cssContent.includes('z-index: 1002 !important;'),
    'Table header must have z-index: 1001/1002, bounded within wrapper context'
  );

  // Modal dialog is in top layer
  assert.ok(
    cssContent.includes('z-index: 100000 !important;'),
    'Modal backdrop must have top z-index: 100000'
  );
});
