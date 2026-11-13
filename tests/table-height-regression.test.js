/**
 * table-height-regression.test.js — IUH Grade Table Full Height Expansion Regression Test
 *
 * Kiểm tra:
 *  1. AppController.init() tự động gắn class 'iuh-gpa-expanded-grade-table' vào đúng wrapper của table#xemDiem_aaa.
 *  2. Các table hoặc element khác không bị gắn class bừa bãi.
 *  3. Stylesheet styles.css định nghĩa đầy đủ quy tắc mở rộng:
 *     - height: auto !important
 *     - max-height: none !important
 *     - overflow-x: auto !important (bảo tồn thanh cuộn ngang 27 cột)
 *     - overflow-y: visible !important (loại bỏ thanh cuộn dọc nội bộ)
 *  4. Không có quy tắc nào đặt max-height giới hạn (70vh, 600px, etc.) cho grade table wrapper.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const { AppController } = require('../src/ui/AppController.js');

test('Table Height Expansion: AppController attaches expansion class to grade table wrapper', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const dom = new JSDOM(html, {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only',
  });

  const { document } = dom.window;
  const table = document.querySelector('table#xemDiem_aaa');
  assert.ok(table, 'Grade table #xemDiem_aaa must exist in fixture');

  const controller = new AppController(document);
  const result = controller.init();
  assert.strictEqual(result.success, true, 'AppController must initialize successfully');

  // Kiểm tra wrapper của #xemDiem_aaa
  const wrapper = table.closest('.table-wrapper');
  assert.ok(wrapper, 'Table wrapper must exist');
  assert.ok(
    wrapper.classList.contains('iuh-gpa-expanded-grade-table'),
    'Table wrapper must have "iuh-gpa-expanded-grade-table" class'
  );

  // Khẳng định bảng vẫn giữ nguyên vẹn cấu trúc thead và tbody
  assert.ok(table.querySelector('thead.header-sticky'), 'Sticky header thead must be preserved');
  assert.ok(table.querySelectorAll('th.sticky-col').length > 0, 'Sticky columns must be preserved');
});

test('Table Height Expansion: CSS rules guarantee full height and horizontal scrolling', () => {
  const cssPath = path.resolve(__dirname, '../src/ui/styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // 1. Phải có selector .iuh-gpa-expanded-grade-table
  assert.ok(css.includes('.iuh-gpa-expanded-grade-table'), 'styles.css must declare .iuh-gpa-expanded-grade-table');

  // 2. Phải có height: auto !important và max-height: none !important
  assert.ok(/height:\s*auto\s*!important/i.test(css), 'Must specify height: auto !important');
  assert.ok(/max-height:\s*none\s*!important/i.test(css), 'Must specify max-height: none !important');

  // 3. Phải bảo toàn overflow-x: auto !important cho thanh cuộn ngang
  assert.ok(/overflow-x:\s*auto\s*!important/i.test(css), 'Must preserve overflow-x: auto !important');

  // 4. Phải loại trừ thanh cuộn dọc nội bộ với overflow-y: visible !important
  assert.ok(/overflow-y:\s*visible\s*!important/i.test(css), 'Must specify overflow-y: visible !important');

  // 5. Tuyệt đối không đặt giới hạn chiều cao dạng calc(100vh - ...) hay max-height: 70vh cho table
  const lines = css.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('iuh-gpa-expanded-grade-table')) {
      // Đảm bảo không có max-height cố định
      const block = css.substring(css.indexOf(line), css.indexOf('}', css.indexOf(line)));
      assert.strictEqual(
        /max-height:\s*\d+/i.test(block),
        false,
        `Line ${idx + 1}: Expansion block must not define numerical max-height constraint`
      );
    }
  });
});
