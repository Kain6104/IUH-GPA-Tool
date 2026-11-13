const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { CompanionBar } = require('../src/ui/CompanionBar.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');

const CSS_PATH = path.resolve(__dirname, '../src/ui/styles.css');

test('Companion Scroll Containment: CSS styles define strict viewport containment and internal scroll', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');

  // Verify sticky shell rules
  assert.ok(css.includes('#iuh-gpa-companion-bar {') || css.includes('#iuh-gpa-companion-bar'), 'Companion bar rule exists');
  assert.ok(css.includes('max-height: calc(100dvh - var(--iuh-gpa-navbar-height'), 'Max height bounded by viewport minus navbar');
  assert.ok(css.includes('overflow: hidden'), 'Shell must have overflow: hidden');
  assert.ok(css.includes('flex-direction: column'), 'Shell is flex column');

  // Verify fixed header and nav rules
  assert.ok(css.includes('.iuh-gpa-bar-header') && css.includes('flex: 0 0 auto'), 'Header does not flex/scroll');
  assert.ok(css.includes('.iuh-gpa-tab-nav') && css.includes('flex: 0 0 auto'), 'Tab nav does not flex/scroll');

  // Verify collapsible body scroll containment
  assert.ok(css.includes('.iuh-gpa-collapsible-body'), 'Collapsible body rule exists');
  assert.ok(css.includes('overflow-y: auto'), 'Body has overflow-y: auto');
  assert.ok(css.includes('overscroll-behavior-y: contain'), 'Body has overscroll-behavior-y: contain');
  assert.ok(css.includes('scrollbar-gutter: stable'), 'Body has scrollbar-gutter: stable');
});

test('Companion Scroll Containment: DOM structure ensures header & tabs are fixed while body wraps content', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="target"></div></body></html>');
  const doc = dom.window.document;
  const target = doc.getElementById('target');
  const store = new SimulationStore([]);

  const bar = new CompanionBar({
    store,
    mountParent: target,
    doc,
  });

  const header = target.querySelector('.iuh-gpa-bar-header');
  const tabNav = target.querySelector('.iuh-gpa-tab-nav');
  const bodyWrapper = target.querySelector('.iuh-gpa-collapsible-body');

  assert.ok(header, 'Header exists');
  assert.ok(tabNav, 'Tab nav exists');
  assert.ok(bodyWrapper, 'Body wrapper exists');

  // TabNav must NOT be inside collapsible body; it stays fixed at top
  assert.equal(bodyWrapper.contains(tabNav), false, 'Tab nav must be outside collapsible body');
  assert.equal(bodyWrapper.contains(header), false, 'Header must be outside collapsible body');

  // Content panels are inside collapsible body
  const tabPanels = bodyWrapper.querySelectorAll('.iuh-gpa-tab-panel');
  assert.ok(tabPanels.length > 0, 'Tab panels are nested inside collapsible body');
});

test('Companion Scroll Containment: Manual collapse/expand preserves state without auto-collapse', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="target"></div></body></html>');
  const doc = dom.window.document;
  const target = doc.getElementById('target');
  const store = new SimulationStore([]);

  const bar = new CompanionBar({
    store,
    mountParent: target,
    doc,
  });

  const barEl = target.querySelector('#iuh-gpa-companion-bar');
  assert.ok(barEl, 'Companion bar container exists');

  const toggleBtn = barEl.querySelector('#iuh-gpa-btn-toggle-collapse') || barEl.querySelector('.iuh-gpa-btn-collapse');
  assert.ok(toggleBtn, 'Toggle button exists');
  assert.equal(barEl.classList.contains('iuh-gpa-collapsed'), false, 'Default is expanded');

  // Click to collapse
  toggleBtn.click();
  assert.equal(barEl.classList.contains('iuh-gpa-collapsed'), true, 'Now collapsed');

  // Click to expand
  toggleBtn.click();
  assert.equal(barEl.classList.contains('iuh-gpa-collapsed'), false, 'Now expanded');
});
