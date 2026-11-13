/**
 * modal-transaction-safety.test.js — Modal Transactional Lifecycle & Freeze Prevention Test
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { CompanionBar } = require('../src/ui/CompanionBar.js');

test('Modal Lifecycle: Body is NEVER locked on initialization failure', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="mount"></div></body></html>');
  const doc = dom.window.document;
  const mountParent = doc.getElementById('mount');

  const store = new SimulationStore([]);
  // Intentionally make getCoursePool throw
  store.getCoursePool = () => {
    throw new Error('Course pool calculation failed catastrophically');
  };

  const bar = new CompanionBar({ store, mountParent, doc });

  doc.body.style.overflow = '';
  assert.strictEqual(doc.body.style.overflow, '');

  // Attempt to open modal
  bar.openFuturePlannerModal();

  // Assertions:
  // 1. Body overflow must NOT be locked to 'hidden'
  assert.strictEqual(doc.body.style.overflow, '', 'Body overflow must remain unlocked on failure');

  // 2. Backdrop must NOT be left orphan in DOM
  const backdrop = doc.getElementById('iuh-gpa-future-planner-modal');
  assert.strictEqual(backdrop, null, 'No broken modal backdrop left in DOM on failure');

  // 3. Page is not frozen
  bar.destroy();
});

test('Modal Lifecycle: Idempotent close does not throw', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="mount"></div></body></html>');
  const doc = dom.window.document;
  const mountParent = doc.getElementById('mount');

  const store = new SimulationStore([]);
  const bar = new CompanionBar({ store, mountParent, doc });

  // Calling close 3 times without open should be completely safe
  assert.doesNotThrow(() => {
    bar.closeFuturePlannerModal();
    bar.closeFuturePlannerModal();
    bar.closeFuturePlannerModal();
  });

  bar.destroy();
});
