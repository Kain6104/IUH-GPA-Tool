const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { SimulationStore } = require('../src/state/SimulationStore.js');
const { CompanionBar } = require('../src/ui/CompanionBar.js');

test('Modal: Vị trí DOM, Overlay Backdrop, Accessibility & Scroll Lock', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="viewBangDiem"><div class="table-wrapper"><table><tbody id="tbody"></tbody></table></div></div><div id="companion-mount"></div></body></html>');
  const doc = dom.window.document;
  const mountParent = doc.getElementById('companion-mount');

  const store = new SimulationStore([]);
  const bar = new CompanionBar({ store, mountParent, doc });

  // 1. Mở Modal
  bar.openFuturePlannerModal();

  const backdrop = doc.getElementById('iuh-gpa-future-planner-modal');
  assert.ok(backdrop, 'Modal backdrop must exist in DOM');

  // DOM parent phải là document.body (Requirement 20, 51)
  assert.strictEqual(backdrop.parentElement, doc.body, 'Modal backdrop must be a direct child of document.body');

  // Không được nằm trong table, tbody hay table-wrapper
  const table = doc.querySelector('table');
  const tableWrapper = doc.querySelector('.table-wrapper');
  const viewBangDiem = doc.getElementById('viewBangDiem');

  assert.equal(table.contains(backdrop), false, 'Modal backdrop must NOT be descendant of table');
  assert.equal(tableWrapper.contains(backdrop), false, 'Modal backdrop must NOT be descendant of table-wrapper');
  assert.equal(viewBangDiem.contains(backdrop), false, 'Modal backdrop must NOT be descendant of viewBangDiem');

  // Kiểm tra class overlay & backdrop (Requirement 21, 52)
  assert.ok(backdrop.classList.contains('iuh-gpa-modal-backdrop'));
  assert.ok(backdrop.classList.contains('iuh-gpa-modal-overlay'));

  // Kiểm tra thuộc tính Accessibility
  const modalDialog = backdrop.querySelector('.iuh-gpa-modal-dialog');
  assert.ok(modalDialog, 'Dialog card must exist');
  assert.equal(modalDialog.getAttribute('role'), 'dialog');
  assert.equal(modalDialog.getAttribute('aria-modal'), 'true');
  assert.equal(modalDialog.getAttribute('aria-labelledby'), 'iuh-gpa-modal-title');

  // Kiểm tra Background Scroll Lock (Requirement 24)
  assert.equal(doc.body.style.overflow, 'hidden', 'Body overflow must be locked to hidden when modal is open');

  // 2. Kiểm tra Single Modal Instance (Requirement 53: Bấm mở 5 lần vẫn chỉ có đúng 1 modal)
  bar.openFuturePlannerModal();
  bar.openFuturePlannerModal();
  bar.openFuturePlannerModal();
  bar.openFuturePlannerModal();

  const allModals = doc.querySelectorAll('#iuh-gpa-future-planner-modal');
  assert.equal(allModals.length, 1, 'Only one modal instance must exist at any time');

  // 3. Đóng bằng nút Hủy (Requirement 26, 54)
  const activeModal = doc.getElementById('iuh-gpa-future-planner-modal');
  const cancelBtn = activeModal.querySelector('.iuh-gpa-modal-footer button.iuh-gpa-btn-action');
  assert.ok(cancelBtn);
  cancelBtn.click();

  assert.equal(doc.getElementById('iuh-gpa-future-planner-modal'), null, 'Modal must be removed on cancel');
  assert.equal(doc.body.style.overflow, '', 'Body overflow lock must be restored on close');

  // 4. Mở lại và đóng bằng phím Escape
  bar.openFuturePlannerModal();
  assert.ok(doc.getElementById('iuh-gpa-future-planner-modal'));

  const escEvent = new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
  doc.dispatchEvent(escEvent);

  assert.equal(doc.getElementById('iuh-gpa-future-planner-modal'), null, 'Modal must close on Escape key');

  bar.destroy();
});

test('Sticky CompanionBar: Position sticky, không dùng fixed top:0 che navbar', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><header class="navbar-fixed-top" style="height: 50px; position: fixed; top: 0;"></header><div id="companion-mount"></div></body></html>');
  const doc = dom.window.document;
  const mountParent = doc.getElementById('companion-mount');

  const store = new SimulationStore([]);
  const bar = new CompanionBar({ store, mountParent, doc });

  const barEl = doc.getElementById('iuh-gpa-companion-bar');
  assert.ok(barEl, 'Companion bar must exist');

  // Kiểm tra CSS stylesheet chứa position: sticky (Requirement 31, 55)
  const css = fs.readFileSync(path.join(__dirname, '../src/ui/styles.css'), 'utf8');
  assert.ok(css.includes('position: sticky'), 'styles.css must declare position: sticky for companion bar');
  assert.equal(css.includes('position: fixed; top: 0'), false, 'Companion bar must NOT be fixed top: 0 covering school navbar');

  bar.destroy();
});

test('Fake CTK Metric Prevention: Không hiển thị số tín chỉ CTK giả khi chưa SYNCED', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="companion-mount"></div></body></html>');
  const doc = dom.window.document;
  const mountParent = doc.getElementById('companion-mount');

  const store = new SimulationStore([
    {
      semesterKey: 'HK1',
      courses: [
        {
          id: 'c1',
          courseName: 'Toán cao cấp',
          credits: { status: 'ok', value: 3 },
          officialResult: { total10: { status: 'ok', value: 8.0 }, score4: { status: 'ok', value: 3.5 }, letter: 'B+', passed: true }
        }
      ]
    }
  ]);

  const bar = new CompanionBar({ store, mountParent, doc });

  // 1. Trạng thái UNSYNCED (Chưa đồng bộ)
  store.setCurriculumSyncStatus('UNSYNCED');
  bar.update(store.getDerivedData());

  const ctkCardVal = doc.getElementById('iuh-gpa-metric-ctk-completed');
  assert.ok(ctkCardVal);
  // Tuyệt đối không hiển thị 3 / 3 TC khi chưa SYNCED CTK! (Requirement 8, 9, 57)
  assert.equal(ctkCardVal.textContent, '--', 'CTK completed metric must be "--" when UNSYNCED');

  const remCardVal = doc.getElementById('iuh-gpa-metric-remaining-after-plan');
  assert.equal(remCardVal.textContent, '--', 'Remaining credits metric must be "--" when UNSYNCED');

  // 2. Trạng thái FAILED (Lỗi đồng bộ)
  store.setCurriculumSyncStatus('FAILED', 'NETWORK_ERROR');
  bar.update(store.getDerivedData());
  assert.equal(ctkCardVal.textContent, '--', 'CTK completed metric must be "--" when FAILED');

  // 3. Trạng thái SYNCED (Đã đồng bộ thực sự với CTK hợp lệ)
  store.setCurriculumModel({
    requiredCredits: 144,
    mandatoryCredits: 120,
    electiveCredits: 24,
    totals: { totalRequiredCredits: 144, totalMandatoryCredits: 120, totalElectiveCredits: 24 },
    courses: [
      { code: 'MAND01', credits: 3, isMandatory: true, countsTowardCumulativeGPA: true }
    ],
    electiveGroups: []
  });
  store.setCurriculumSyncStatus('SYNCED');
  bar.update(store.getDerivedData());

  // Sau khi SYNCED mới hiển thị số liệu thật từ CTK
  assert.ok(ctkCardVal.textContent.includes('144 TC'), 'CTK metric must show real curriculum required credits after SYNCED');

  bar.destroy();
});
