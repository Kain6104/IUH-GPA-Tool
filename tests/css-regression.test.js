/**
 * css-regression.test.js — CSS Hygiene & Theme Scoping Regression Test
 *
 * Kiểm tra:
 *  1. Tuyệt đối không có gradient tím / hồng (purple, pink, magenta, linear-gradient(#..., #...)).
 *  2. Tuyệt đối không có global 'svg {' selector gây ô nhiễm SVG của IUH.
 *  3. Không có global 'body {', 'table {', 'button {', 'input {' ngoài extension scope.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

test('CSS Regression: No Purple/Pink Gradients and Strict Selector Scoping', () => {
  const cssPath = path.resolve(__dirname, '../src/ui/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // 1. Kiểm tra gradient tím / hồng
  const forbiddenColors = [/purple/i, /pink/i, /magenta/i, /#ff00/i, /#8a2be2/i];
  forbiddenColors.forEach((re) => {
    assert.strictEqual(
      re.test(css),
      false,
      `CSS must not contain forbidden color: ${re}`
    );
  });

  // 2. Không có linear-gradient hoặc radial-gradient màu trang trí rực rỡ
  const lines = css.split('\n');
  lines.forEach((line, lineNum) => {
    if (line.includes('linear-gradient') || line.includes('radial-gradient')) {
      assert.fail(`CSS contains forbidden gradient at line ${lineNum + 1}: ${line.trim()}`);
    }
  });

  // 3. Không có global unscoped svg selector
  const hasGlobalSvg = /^\s*svg\s*\{/m.test(css);
  assert.strictEqual(hasGlobalSvg, false, 'CSS must not declare global unscoped "svg {" rule');

  // 4. Không có global body, table, button, input un-scoped
  const globalElementSelectors = [/^\s*body\s*\{/m, /^\s*table\s*\{/m, /^\s*button\s*\{/m, /^\s*input\s*\{/m];
  globalElementSelectors.forEach((re) => {
    assert.strictEqual(re.test(css), false, `CSS must not declare unscoped element rule: ${re}`);
  });
});
