/**
 * popup.js — Premium Academic Controller for IUH GPA Tool Popup
 *
 * Quản lý trạng thái giao diện popup, switch Bật/Tắt đồng bộ qua chrome.storage.local,
 * hiển thị chỉ số GPA hệ 4 & hệ 10, trạng thái trang điểm, và điều hướng an toàn.
 */
(function (global) {
  'use strict';

  function formatGpa(val) {
    if (val === null || val === undefined || isNaN(val)) return '--';
    return Number(val).toFixed(4).replace('.', ',');
  }

  function initPopup(docRef, chromeRef) {
    const doc = docRef || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    const cr = chromeRef || (typeof chrome !== 'undefined' ? chrome : (win && win.chrome ? win.chrome : null));

    const toggleInput = doc.getElementById('extension-toggle');
    const toggleDesc = doc.getElementById('toggle-desc');
    const dotEl = doc.getElementById('indicator-dot');
    const indTextEl = doc.getElementById('indicator-text');
    const pageStatusEl = doc.getElementById('page-status');
    const gpaGrid = doc.getElementById('gpa-grid');
    const gpa4El = doc.getElementById('popup-gpa4');
    const gpa10El = doc.getElementById('popup-gpa10');
    const openIuhBtn = doc.getElementById('btn-open-iuh');
    const openIuhBtnText = doc.getElementById('btn-open-iuh-text');
    const resetBtn = doc.getElementById('btn-reset-sim');
    const devCreditLink = doc.getElementById('dev-credit-link');

    let currentEnabled = true;

    function applyExtensionState(isEnabled) {
      currentEnabled = isEnabled;
      if (toggleInput) {
        toggleInput.checked = isEnabled;
      }

      if (dotEl && indTextEl) {
        if (isEnabled) {
          dotEl.className = 'indicator-dot active';
          indTextEl.className = 'indicator-text active';
          indTextEl.textContent = 'Đang hoạt động';
        } else {
          dotEl.className = 'indicator-dot inactive';
          indTextEl.className = 'indicator-text inactive';
          indTextEl.textContent = 'Đã tắt';
        }
      }

      if (toggleDesc) {
        toggleDesc.textContent = isEnabled
          ? 'Đang hoạt động trên trang Kết quả học tập'
          : 'Tiện ích đang tạm tắt';
      }

      if (!isEnabled) {
        if (gpaGrid) gpaGrid.classList.add('muted');
        if (gpa4El) gpa4El.textContent = '--';
        if (gpa10El) gpa10El.textContent = '--';
        if (pageStatusEl) {
          pageStatusEl.textContent = 'Tiện ích đang tắt';
          pageStatusEl.classList.remove('simulating');
        }
        if (resetBtn) resetBtn.disabled = true;
      } else {
        if (gpaGrid) gpaGrid.classList.remove('muted');
      }
    }

    function inspectActiveTab(isEnabled) {
      if (!cr || !cr.tabs) {
        if (pageStatusEl) {
          pageStatusEl.textContent = isEnabled ? 'Trang điểm sẵn sàng' : 'Tiện ích đang tắt';
        }
        return;
      }

      cr.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs && tabs[0];
        const isGradePage = Boolean(
          activeTab &&
          activeTab.url &&
          activeTab.url.includes('sv.iuh.edu.vn/ket-qua-hoc-tap')
        );

        if (openIuhBtnText) {
          openIuhBtnText.textContent = isGradePage
            ? 'Quay lại trang điểm'
            : 'Mở trang Kết quả học tập';
        }

        if (!isEnabled) {
          if (pageStatusEl) {
            pageStatusEl.textContent = 'Tiện ích đang tắt';
            pageStatusEl.classList.remove('simulating');
          }
          if (resetBtn) resetBtn.disabled = true;
          if (gpa4El) gpa4El.textContent = '--';
          if (gpa10El) gpa10El.textContent = '--';
          return;
        }

        if (!isGradePage) {
          if (pageStatusEl) {
            pageStatusEl.textContent = 'Chưa mở trang Kết quả học tập';
            pageStatusEl.classList.remove('simulating');
          }
          if (resetBtn) resetBtn.disabled = true;
          if (gpa4El) gpa4El.textContent = '--';
          if (gpa10El) gpa10El.textContent = '--';
          return;
        }

        // Đang ở đúng trang và tiện ích đang bật
        if (pageStatusEl) {
          pageStatusEl.textContent = 'Đang kết nối...';
          pageStatusEl.classList.remove('simulating');
        }

        cr.tabs.sendMessage(activeTab.id, { action: 'GET_SIMULATION_SUMMARY' }, (response) => {
          if (cr.runtime && cr.runtime.lastError) {
            if (pageStatusEl) {
              pageStatusEl.textContent = 'Tiện ích đã bật. Mở trang Kết quả học tập để sử dụng.';
              pageStatusEl.classList.remove('simulating');
            }
            if (resetBtn) resetBtn.disabled = true;
            return;
          }

          if (!response || response.error) {
            if (pageStatusEl) {
              pageStatusEl.textContent = 'Trang điểm sẵn sàng';
              pageStatusEl.classList.remove('simulating');
            }
            if (resetBtn) resetBtn.disabled = true;
            return;
          }

          const { hasSimulations, activeCount, overallOriginal, overallSimulated } = response;
          const effective = hasSimulations ? overallSimulated : overallOriginal;

          if (pageStatusEl) {
            if (hasSimulations && activeCount > 0) {
              pageStatusEl.textContent = `Đang mô phỏng (${activeCount} môn)`;
              pageStatusEl.classList.add('simulating');
              if (resetBtn) resetBtn.disabled = false;
            } else {
              pageStatusEl.textContent = 'Trang điểm sẵn sàng';
              pageStatusEl.classList.remove('simulating');
              if (resetBtn) resetBtn.disabled = true;
            }
          }

          if (effective) {
            if (gpa4El) gpa4El.textContent = formatGpa(effective.gpa4);
            if (gpa10El) gpa10El.textContent = formatGpa(effective.gpa10);
          }
        });
      });
    }

    function reloadIuhTabs() {
      if (!cr || !cr.tabs) return;
      cr.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs && tabs[0];
        if (activeTab && activeTab.id && activeTab.url && activeTab.url.includes('sv.iuh.edu.vn/ket-qua-hoc-tap')) {
          if (typeof cr.tabs.reload === 'function') {
            cr.tabs.reload(activeTab.id);
          }
        } else if (typeof cr.tabs.query === 'function') {
          cr.tabs.query({}, (allTabs) => {
            if (!Array.isArray(allTabs)) return;
            allTabs.forEach((tab) => {
              if (tab && tab.id && tab.url && tab.url.includes('sv.iuh.edu.vn/ket-qua-hoc-tap')) {
                if (typeof cr.tabs.reload === 'function') {
                  cr.tabs.reload(tab.id);
                }
              }
            });
          });
        }
      });
    }

    // 1. Đọc trạng thái từ chrome.storage.local
    if (cr && cr.storage && cr.storage.local) {
      cr.storage.local.get({ iuhGpaEnabled: true }, (items) => {
        const isEnabled = (items && items.iuhGpaEnabled !== undefined)
          ? Boolean(items.iuhGpaEnabled)
          : true;
        applyExtensionState(isEnabled);
        inspectActiveTab(isEnabled);
      });
    } else {
      applyExtensionState(true);
      inspectActiveTab(true);
    }

    // 2. Lắng nghe thay đổi của nút Switch Bật / Tắt
    if (toggleInput) {
      toggleInput.addEventListener('change', () => {
        const isEnabled = Boolean(toggleInput.checked);
        applyExtensionState(isEnabled);

        if (cr && cr.storage && cr.storage.local) {
          cr.storage.local.set({ iuhGpaEnabled: isEnabled }, () => {
            inspectActiveTab(isEnabled);
            reloadIuhTabs();
          });
        } else {
          inspectActiveTab(isEnabled);
          reloadIuhTabs();
        }
      });
    }

    // 3. Lắng nghe thay đổi storage từ nguồn khác
    if (cr && cr.storage && cr.storage.onChanged) {
      cr.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.iuhGpaEnabled !== undefined) {
          const isEnabled = Boolean(changes.iuhGpaEnabled.newValue);
          applyExtensionState(isEnabled);
          inspectActiveTab(isEnabled);
        }
      });
    }

    // 4. Nút Mở trang IUH / Quay lại trang điểm
    if (openIuhBtn) {
      openIuhBtn.addEventListener('click', () => {
        if (!cr || !cr.tabs) return;

        cr.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs && tabs[0];
          if (activeTab && activeTab.url && activeTab.url.includes('sv.iuh.edu.vn/ket-qua-hoc-tap')) {
            if (win && typeof win.close === 'function') {
              win.close();
            }
          } else {
            cr.tabs.create({ url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html' });
          }
        });
      });
    }

    // 5. Nút Khôi phục tất cả mô phỏng
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!cr || !cr.tabs) return;

        cr.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs && tabs[0];
          if (activeTab && activeTab.id) {
            cr.tabs.sendMessage(activeTab.id, { action: 'RESET_ALL' }, () => {
              inspectActiveTab(true);
            });
          }
        });
      });
    }

    // 6. Developer Credit Link: Click mở trang Facebook của Kain
    if (devCreditLink) {
      devCreditLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (cr && cr.tabs && cr.tabs.create) {
          cr.tabs.create({ url: 'https://www.facebook.com/htphat.04' });
        }
      });
    }

    return {
      applyExtensionState,
      inspectActiveTab,
      reloadIuhTabs,
    };
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => initPopup());
    } else {
      initPopup();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initPopup, formatGpa };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
