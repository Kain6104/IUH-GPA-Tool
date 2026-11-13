const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { CompanionBar } = require('../src/ui/CompanionBar.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');

function getAllJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllJsFiles(fullPath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

test('Native Dialog Ban: Scan all src/*.js files for native alert, confirm, prompt', () => {
  const srcDir = path.resolve(__dirname, '../src');
  const jsFiles = getAllJsFiles(srcDir);

  const nativeDialogPatterns = [
    /\bwindow\.alert\s*\(/,
    /(?<!\.)\balert\s*\(/,
    /\bwindow\.confirm\s*\(/,
    /(?<!\.)\bconfirm\s*\(/,
    /\bwindow\.prompt\s*\(/,
    /(?<!\.)\bprompt\s*\(/,
  ];

  const violations = [];

  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Exclude comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
        return;
      }

      for (const pattern of nativeDialogPatterns) {
        if (pattern.test(line)) {
          // Verify it's not a method definition or variable name like showPromptModal
          if (line.includes('showConfirmModal') || line.includes('showPromptModal') || line.includes('showToast')) {
            continue;
          }
          violations.push({
            file: path.relative(srcDir, file),
            line: index + 1,
            content: line.trim()
          });
        }
      }
    });
  }

  assert.equal(violations.length, 0, `Found native dialog calls in src/: ${JSON.stringify(violations, null, 2)}`);
});

test('Native Dialog Ban: Extension provides custom inline toast and modal replacements', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="companion-host"></div></body></html>');
  const doc = dom.window.document;
  const host = doc.getElementById('companion-host');
  const store = new SimulationStore([]);

  const bar = new CompanionBar({
    store,
    mountParent: host,
    doc,
  });

  // Test toast
  bar.showToast('Test Toast Notification', 'info', 5000);
  const toast = doc.body.querySelector('.iuh-gpa-toast');
  assert.ok(toast, 'Custom toast element rendered');
  assert.ok(toast.textContent.includes('Test Toast Notification'));
  toast.remove();

  // Test confirm modal
  let confirmedResult = null;
  bar.showConfirmModal({
    title: 'Xác nhận thử nghiệm',
    message: 'Bạn có chắc chắn không?',
    onConfirm: () => { confirmedResult = true; },
    onCancel: () => { confirmedResult = false; }
  });

  const confirmModal = doc.body.querySelector('.iuh-gpa-modal-overlay');
  assert.ok(confirmModal, 'Confirm modal overlay rendered');
  const confirmBtn = confirmModal.querySelector('.iuh-gpa-btn-primary');
  assert.ok(confirmBtn, 'Confirm button exists');
  confirmBtn.click();
  assert.equal(confirmedResult, true, 'Confirm callback called');
  assert.equal(doc.body.querySelector('.iuh-gpa-modal-overlay'), null, 'Modal overlay removed on action');
});
