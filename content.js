/**
 * content.js — Content Script Entry Point for IUH GPA Tool
 *
 * Nhiệm vụ bootstrap, lifecycle & orchestrator:
 *  - Kiểm tra trạng thái iuhGpaEnabled từ chrome.storage.local
 *  - Khởi tạo AppController khi tiện ích BẬT (ON)
 *  - Tiêu huỷ sạch sẽ (AppController.destroy) khi tiện ích TẮT (OFF)
 *  - Lắng nghe chrome.storage.onChanged để chuyển đổi realtime không cần reload
 *  - Phản hồi message truy vấn tóm tắt mô phỏng từ extension popup
 */
'use strict';

(function (global) {
  'use strict';

  const root = global || (typeof globalThis !== 'undefined' ? globalThis : this);
  const win = (typeof window !== 'undefined' && window.document)
    ? window
    : (root.window && root.window.document ? root.window : (root.document ? root : null));
  const doc = (win && win.document) ? win.document : (typeof document !== 'undefined' ? document : null);
  const cr = (win && win.chrome) ? win.chrome : (typeof chrome !== 'undefined' ? chrome : (root.chrome || null));

  // Guard chống mount trùng lặp trên cùng cửa sổ trang IUH
  const mountHost = win || root;
  if (mountHost.IUHGPA_APP_MOUNTED) {
    return;
  }

  const AppController = (root.IUHGPA && root.IUHGPA.AppController)
    || (root.IUHGPA && root.IUHGPA.ui && root.IUHGPA.ui.AppController)
    || (win && win.IUHGPA && win.IUHGPA.AppController)
    || (win && win.IUHGPA && win.IUHGPA.ui && win.IUHGPA.ui.AppController)
    || (root._IUHAppController ? root._IUHAppController.AppController : null)
    || (win && win._IUHAppController ? win._IUHAppController.AppController : null)
    || (typeof require !== 'undefined' ? require('./src/ui/AppController.js').AppController : null);

  if (!AppController) {
    console.warn('[IUH-GPA] AppController chưa sẵn sàng.');
    return;
  }

  function setMounted(mounted, ctrl) {
    mountHost.IUHGPA_APP_MOUNTED = mounted;
    mountHost._iuhGpaController = ctrl || null;
  }

  function start() {
    if (mountHost.IUHGPA_APP_MOUNTED) return;
    if (!doc) return;

    if (doc.getElementById('iuh-gpa-companion-bar')) {
      setMounted(true, mountHost._iuhGpaController);
      return;
    }

    const controller = new AppController(doc);
    const result = controller.init();
    if (result && result.success !== false) {
      setMounted(true, controller);
    }
  }

  function stop() {
    const ctrl = mountHost._iuhGpaController;
    if (ctrl) {
      try {
        if (typeof ctrl.destroy === 'function') {
          ctrl.destroy();
        }
      } catch (err) {
        console.warn('[IUH-GPA] Lỗi khi dọn dẹp AppController:', err);
      }
    }
    setMounted(false, null);
  }

  function checkAndStart() {
    if (cr && cr.storage && cr.storage.local) {
      cr.storage.local.get({ iuhGpaEnabled: true }, (items) => {
        if (cr.runtime && cr.runtime.lastError) {
          start();
          return;
        }
        if (items && items.iuhGpaEnabled !== false) {
          start();
        } else {
          stop();
        }
      });
    } else {
      start();
    }
  }

  // Khởi động khi DOM sẵn sàng
  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', checkAndStart);
    } else {
      checkAndStart();
    }
  }

  // Lắng nghe thay đổi storage từ popup toggle (không dùng polling)
  if (cr && cr.storage && cr.storage.onChanged) {
    cr.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.iuhGpaEnabled !== undefined) {
        const isEnabled = changes.iuhGpaEnabled.newValue;
        if (isEnabled) {
          start();
        } else {
          stop();
        }
      }
    });
  }

  // Lắng nghe message từ extension popup
  if (cr && cr.runtime && cr.runtime.onMessage) {
    cr.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request) return;

      if (request.action === 'GET_SIMULATION_SUMMARY') {
        const ctrl = mountHost._iuhGpaController;
        const store = ctrl?.store;
        if (store) {
          const derived = store.getDerivedData();
          sendResponse({
            enabled: true,
            active: true,
            hasSimulations: derived.hasSimulations,
            activeCount: derived.activeSimulationsCount,
            overallOriginal: derived.overallOriginal,
            overallSimulated: derived.overallSimulated,
          });
        } else {
          sendResponse({
            enabled: Boolean(mountHost.IUHGPA_APP_MOUNTED),
            active: false,
            error: 'STORE_NOT_INITIALIZED',
          });
        }
      } else if (request.action === 'RESET_ALL') {
        const ctrl = mountHost._iuhGpaController;
        const store = ctrl?.store;
        if (store) {
          store.resetAllSimulations();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'NOT_ACTIVE' });
        }
      } else if (request.action === 'GET_STATUS') {
        sendResponse({
          mounted: Boolean(mountHost.IUHGPA_APP_MOUNTED),
          active: Boolean(mountHost._iuhGpaController),
        });
      }
      return true;
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { start, stop, checkAndStart };
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));