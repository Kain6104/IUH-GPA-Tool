(function (global) {
  'use strict';

  const IUHPageAdapter = (typeof require !== 'undefined')
    ? require('../adapters/IUHPageAdapter.js').IUHPageAdapter
    : (global.IUHGPA && global.IUHGPA.adapters && global.IUHGPA.adapters.IUHPageAdapter
        ? global.IUHGPA.adapters.IUHPageAdapter
        : (global._IUHPageAdapter ? global._IUHPageAdapter.IUHPageAdapter : null));

  const SimulationStore = (typeof require !== 'undefined')
    ? require('../state/SimulationStore.js').SimulationStore
    : (global.IUHGPA && global.IUHGPA.state && global.IUHGPA.state.SimulationStore
        ? global.IUHGPA.state.SimulationStore
        : (global._IUHSimulationStore ? global._IUHSimulationStore.SimulationStore : null));

  const CompanionBar = (typeof require !== 'undefined')
    ? require('./CompanionBar.js').CompanionBar
    : ((global.IUHGPA && global.IUHGPA.ui && global.IUHGPA.ui.CompanionBar)
        || (global._IUHCompanionBar ? global._IUHCompanionBar.CompanionBar : null)
        || (typeof window !== 'undefined' && window.IUHGPA && window.IUHGPA.ui && window.IUHGPA.ui.CompanionBar)
        || (typeof window !== 'undefined' && window._IUHCompanionBar ? window._IUHCompanionBar.CompanionBar : null));

  const CourseSimulationPanel = (typeof require !== 'undefined')
    ? require('./CourseSimulationPanel.js').CourseSimulationPanel
    : (global.IUHGPA && global.IUHGPA.ui && global.IUHGPA.ui.CourseSimulationPanel
        ? global.IUHGPA.ui.CourseSimulationPanel
        : (global._IUHCourseSimulationPanel ? global._IUHCourseSimulationPanel.CourseSimulationPanel : null));

  const IUHCurriculumAdapter = (typeof require !== 'undefined')
    ? require('../adapters/IUHCurriculumAdapter.js').IUHCurriculumAdapter
    : (global.IUHGPA && global.IUHGPA.adapters && global.IUHGPA.adapters.IUHCurriculumAdapter
        ? global.IUHGPA.adapters.IUHCurriculumAdapter
        : (global._IUHCurriculumAdapter ? global._IUHCurriculumAdapter.IUHCurriculumAdapter : null));

    const FutureSemesterEngine = (typeof require !== 'undefined')
    ? require('../core/FutureSemesterEngine.js').FutureSemesterEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.FutureSemesterEngine
        ? global.IUHGPA.core.FutureSemesterEngine
        : (global._IUHFutureSemesterEngine ? global._IUHFutureSemesterEngine.FutureSemesterEngine : null));

  const numParser = (typeof require !== 'undefined')
    ? require('../parsers/NumberParser.js')
    : (global.IUHGPA && global.IUHGPA.parsers && global.IUHGPA.parsers.NumberParser
        ? global.IUHGPA.parsers.NumberParser
        : (global._IUHNumberParser ? global._IUHNumberParser : {}));
  const parseScore = numParser.parseScore;
  const formatScore2 = numParser.formatScore2 || ((val) => (val !== null && val !== undefined && !isNaN(val)) ? Number(val).toFixed(2).replace('.', ',') : '');
  const formatAverage4 = numParser.formatAverage4 || ((val) => (val !== null && val !== undefined && !isNaN(val)) ? Number(val).toFixed(4).replace('.', ',') : '');

  function createSimTriggerIcon(doc) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('iuh-gpa-trigger-icon');

    // Zap / Simulation bolt (local inline SVG, no emoji, no CDN)
    const poly = doc.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', '13 2 3 14 12 14 11 22 21 10 12 10 13 2');
    svg.appendChild(poly);
    return svg;
  }


function getAutoCourseTypeLabel(course) {
  const ctk = course?.curriculumCourse || course;
  const lt = (typeof (ctk && ctk.theoryHours) === 'number') ? ctk.theoryHours : (typeof (ctk && ctk.lt) === 'number' ? ctk.lt : null);
  const th = (typeof (ctk && ctk.practiceHours) === 'number') ? ctk.practiceHours : (typeof (ctk && ctk.th) === 'number' ? ctk.th : null);

  if (lt !== null && th !== null) {
    if (lt > 0 && th === 0) return 'Lý thuyết';
    if (lt === 0 && th > 0) return 'Thực hành';
    if (lt > 0 && th > 0) return 'Kết hợp';
  }

  const inf = (ctk && ctk.inferredCourseType) || course?.inferredCourseType;
  if (inf === 'THEORY') return 'Lý thuyết';
  if (inf === 'PRACTICE') return 'Thực hành';
  if (inf === 'COMBINED') return 'Kết hợp';
  if (inf === 'SPECIAL') return 'Đặc biệt (CK)';
  return 'Chưa xác định';
}

function createCourseTypeSelect(course, options = {}) {
  const doc = options.doc || (typeof document !== 'undefined' ? document : null);
  const sel = doc.createElement('select');
  sel.className = 'iuh-gpa-course-type-select';
  sel.setAttribute('aria-label', `Loại môn cho ${course?.courseName || ''}`);

  const autoLabel = getAutoCourseTypeLabel(course);
  const items = [
    { val: 'AUTO', text: autoLabel },
    { val: 'THEORY', text: 'Lý thuyết' },
    { val: 'COMBINED', text: 'Kết hợp' },
    { val: 'PRACTICE', text: 'Thực hành' },
    { val: 'SPECIAL', text: 'Đặc biệt (CK)', title: 'Đặc biệt (chỉ tính Cuối kỳ)' },
    { val: 'EXCLUDED', text: 'Không GPA', title: 'Không tính vào GPA/TBTL' },
  ];

  items.forEach(opt => {
    const o = doc.createElement('option');
    o.value = opt.val;
    o.textContent = opt.text;
    if (opt.title) o.title = opt.title;
    sel.appendChild(o);
  });

  const currentVal = options.value || course.courseTypeOverride || 'AUTO';
  sel.value = currentVal;

  if (course.courseTypeOverride) {
    sel.classList.add('iuh-gpa-type-overridden');
  }

  const ctk = course.curriculumCourse || course;
  if (ctk && (typeof ctk.theoryHours === 'number' || typeof ctk.practiceHours === 'number')) {
    sel.title = `Xác định từ Chương trình khung: LT ${ctk.theoryHours || 0} · TH ${ctk.practiceHours || 0}`;
  } else {
    sel.title = 'Xác định tự động theo quy chế';
  }

  if (typeof options.onChange === 'function') {
    sel.addEventListener('change', (e) => {
      options.onChange(sel.value, e);
    });
  }

  return sel;
}

class AppController {
  constructor(documentRef = (typeof document !== 'undefined' ? document : null)) {
    this.doc = documentRef;
    this.store = null;
    this.table = null; // Reference to grade table
    this.companionBar = null;
    this.activePanels = new Map(); // courseId -> CourseSimulationPanel
    this._initialized = false;
    this._hasAttemptedCurriculumSync = false;
    this._isSyncingCurriculum = false;
  }

  _validateRuntimeContract() {
    const root = (typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : global));
    const core = (root && root.IUHGPA && root.IUHGPA.core) ? root.IUHGPA.core : {};
    const missing = [];

    if (!IUHPageAdapter || typeof IUHPageAdapter.isCompatiblePage !== 'function') {
      missing.push('IUHPageAdapter.isCompatiblePage');
    }
    if (!SimulationStore) {
      missing.push('SimulationStore');
    }
    if (!CompanionBar) {
      missing.push('CompanionBar');
    }
    if (!numParser || typeof numParser.parseCredit !== 'function') {
      missing.push('NumberParser.parseCredit');
    }

    const progressEngine = core.CurriculumProgressEngine || (typeof require !== 'undefined' ? require('../core/CurriculumProgressEngine.js') : null);
    const hasProgressCalc = progressEngine && (
      typeof progressEngine.calculateProgress === 'function' ||
      (progressEngine.CurriculumProgressEngine && typeof progressEngine.CurriculumProgressEngine.calculateProgress === 'function')
    );
    if (!hasProgressCalc) {
      missing.push('CurriculumProgressEngine.calculateProgress');
    }

    if (missing.length > 0) {
      console.error('[IUH-GPA][RUNTIME_CONTRACT] MISSING_METHOD:', missing.join(', '));
      return false;
    }
    return true;
  }

  init() {
    if (!this.doc || this._initialized) return { success: false, reason: 'Already initialized or no document' };

    if (!this._validateRuntimeContract()) {
      return { success: false, reason: 'RUNTIME_CONTRACT_FAILED' };
    }

    // 0. Strict URL validation: protocol === "https:", hostname === "sv.iuh.edu.vn", pathname === "/ket-qua-hoc-tap.html"
    if (this.doc.location && this.doc.location.href && this.doc.location.href !== 'about:blank') {
      const loc = this.doc.location;
      const isHttps = loc.protocol === 'https:';
      const isIuhHost = loc.hostname === 'sv.iuh.edu.vn';
      const isGradePath = loc.pathname === '/ket-qua-hoc-tap.html';

      // Trong môi trường trình duyệt thật (không phải test fixture local/JSDOM), bắt buộc validate strict
      if (!isHttps || !isIuhHost || !isGradePath) {
        // Chỉ log nếu không phải fixture unit test
        if (loc.hostname && loc.hostname !== 'localhost' && !loc.hostname.includes('127.0.0.1')) {
          console.warn('[IUH-GPA] URL không khớp phạm vi cho phép của extension.');
          return { success: false, reason: 'INVALID_PAGE_SCOPE' };
        }
      }
    }

    // 1. Kiểm tra tính tương thích của trang
    const check = IUHPageAdapter.isCompatiblePage(this.doc);
    if (!check.compatible) {
      console.info('[IUH-GPA] Trang hiện tại không phải bảng điểm IUH tương thích:', check.reason);
      return { success: false, code: check.code, reason: check.reason };
    }

    const table = check.table;
    this.table = table; // Store reference for future use

    // 2. Phát hiện ma trận cột
    const colResult = IUHPageAdapter.detectColumns(table);
    if (!colResult.ok) {
      console.warn('[IUH-GPA] Không phân tích được header bảng điểm:', colResult.error);
      return { success: false, code: colResult.error };
    }

    const columnMap = colResult.data;

    // 3. Parse dữ liệu học kỳ một lần duy nhất
    const parseResult = IUHPageAdapter.parseSemesters(table, columnMap);
    if (!parseResult.ok) {
      console.warn('[IUH-GPA] Không parse được danh sách môn học:', parseResult.error);
      return { success: false, code: parseResult.error };
    }

    const initialSemesters = parseResult.data;

    // 4. Khởi tạo SimulationStore
    this.store = new SimulationStore();
    this.store.setOriginalData(initialSemesters);

    // 5. Gắn Companion Bar và mở rộng toàn bộ chiều cao bảng điểm IUH
    const tableWrapper = table.closest('.table-wrapper.tbl-scrollable')
      || table.closest('.table-wrapper')
      || table.closest('.tbl-scrollable')
      || table.parentElement;

    if (tableWrapper) {
      tableWrapper.classList.add('iuh-gpa-expanded-grade-table');
      this.companionBar = new CompanionBar({
        store: this.store,
        mountParent: tableWrapper.parentElement || tableWrapper,
        onCurriculumRefresh: () => {
          void this.syncCurriculum({ force: true }).catch(() => {});
        },
      });
    }

    // 6. Gắn cột điều khiển (Chọn, Loại môn), inline score editor và triggers
    this._mountTableControls(table);

    // 7. Lắng nghe State để cập nhật realtime toàn bộ bảng và CompanionBar
    this._unsubscribe = this.store.subscribe((data) => this._onStateChange(data));
    this._onStateChange(this.store.getDerivedData());

    // 8. Tự động đồng bộ CTK an toàn 1 lần duy nhất trong session (chạy nền, không chặn render)
    if (typeof fetch === 'function' && typeof DOMParser !== 'undefined') {
      this.syncCurriculum({ force: false }).catch(err => {
        console.warn('[IUH-GPA][CTK] Auto-sync skipped/failed:', err?.message || err);
      });
    }

    this._initialized = true;
    console.info('[IUH-GPA] Khởi tạo thành công với', initialSemesters.length, 'học kỳ.');
    return { success: true, ok: true };
  }

  /**
   * Đồng bộ Chương trình khung (CTK) trực tiếp từ sv.iuh.edu.vn bằng cùng phiên làm việc
   * Không đọc cookies/tokens, không ghi đè innerHTML trên trang live
   * @param {Object} [options]
   * @param {boolean} [options.force=false]
   * @returns {Promise<{ ok: boolean, data?: Object, error?: string, reason?: string }>}
   */
  async syncCurriculum({ force = false } = {}) {
    if (this._isSyncingCurriculum) return { ok: false, reason: 'ALREADY_SYNCING' };
    if (this._hasAttemptedCurriculumSync && !force) {
      return { ok: false, reason: 'ALREADY_ATTEMPTED' };
    }

    this._hasAttemptedCurriculumSync = true;
    this._isSyncingCurriculum = true;
    if (this.store) {
      this.store.setCurriculumSyncStatus('LOADING');
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    this._ctkAbortController = controller;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;

    let fetchUrl = '';
    try {
      // Construct absolute same-origin URL (never chrome-extension:// path)
      if (this.doc && this.doc.location && this.doc.location.origin && this.doc.location.origin !== 'null') {
        fetchUrl = new URL('/chuong-trinh-khung.html', this.doc.location.origin).href;
      } else {
        fetchUrl = 'https://sv.iuh.edu.vn/chuong-trinh-khung.html';
      }

      const requestedUrl = new URL(fetchUrl);
      if (requestedUrl.protocol !== 'https:' || requestedUrl.hostname !== 'sv.iuh.edu.vn' ||
        requestedUrl.pathname !== '/chuong-trinh-khung.html') {
        throw new Error('INVALID_CURRICULUM_URL');
      }

      const response = await fetch(fetchUrl, {
        method: 'GET',
        credentials: 'include', // Same-origin authenticated session (IUH student login)
        redirect: 'follow',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,*/*',
        },
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const code = response.status === 401 || response.status === 403 ? 'AUTH_REQUIRED' : `HTTP_${response.status}`;
        throw new Error(code);
      }

      // Do not accept cross-origin redirects for authenticated curriculum requests.
      const finalUrl = new URL(response.url || fetchUrl, fetchUrl);
      if (finalUrl.origin !== requestedUrl.origin) {
        throw new Error('EXTERNAL_REDIRECT_BLOCKED');
      }

      const isRedirectedToLogin = finalUrl.pathname.includes('/login') || finalUrl.pathname.includes('/dang-nhap') ||
        finalUrl.pathname.includes('/auth') || finalUrl.href.includes('index.html?returnUrl');
      if (isRedirectedToLogin) {
        throw new Error('AUTH_REDIRECT_DETECTED');
      }

      const htmlText = await response.text();



      // Detached parsing strictly via DOMParser in memory - NEVER inject raw HTML to page DOM
      const DOMParserClass = typeof DOMParser !== 'undefined'
        ? DOMParser
        : (this.doc?.defaultView?.DOMParser || (typeof global !== 'undefined' ? global.DOMParser : null));
      if (!DOMParserClass) {
        throw new Error('DOM_PARSER_UNAVAILABLE');
      }
      const parser = new DOMParserClass();
      const detachedDoc = parser.parseFromString(htmlText, 'text/html');

      // Validate: must have curriculum root
      const root = detachedDoc.querySelector('#viewChuongTrinhKhung');
      if (!root) {
        throw new Error('MISSING_CURRICULUM_ROOT');
      }

      if (!IUHCurriculumAdapter) {
        throw new Error('ADAPTER_UNAVAILABLE');
      }

      const parseResult = IUHCurriculumAdapter.parseCurriculum(detachedDoc);
      if (!parseResult.ok || !parseResult.data) {
        throw new Error(parseResult.error || 'PARSE_FAILED');
      }

      if (this.store) {
        this.store.setCurriculumModel(parseResult.data);
        // setCurriculumModel sets status to SYNCED internally
      }
      console.info('[IUH-GPA][CTK] SYNCED — courses:', parseResult.data?.courses?.length || 0);

      return { ok: true, data: parseResult.data };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      let errCode;
      if (err && err.name === 'AbortError') {
        errCode = 'TIMEOUT';
      } else if (err && err.message) {
        errCode = err.message;
      } else {
        errCode = 'NETWORK_ERROR';
      }
      // Map raw error codes to user-friendly status codes
      const statusCode = (
        (errCode === 'AUTH_REQUIRED' || errCode === 'AUTH_REDIRECT_DETECTED') ? 'AUTH_REQUIRED' :
        errCode === 'TIMEOUT' ? 'TIMEOUT' :
        (errCode.startsWith('HTTP_') || errCode.startsWith('HTTP_ERROR')) ? 'HTTP_ERROR' :
        (errCode === 'INCOMPATIBLE_STRUCTURE') ? 'INCOMPATIBLE_STRUCTURE' :
        errCode === 'INVALID_HTML' ? 'INVALID_HTML' :
        'FAILED'
      );
      console.warn('[IUH-GPA][CTK] Sync status:', statusCode, errCode);
      if (this.store) {
        this.store.setCurriculumSyncStatus(statusCode, errCode);
      }
      return { ok: false, error: errCode, status: statusCode };
    } finally {
      this._isSyncingCurriculum = false;
    }
  }

  _mountTableControls(table) {
    if (!this.doc || !table) return;

    // 1. Thêm 2 cột extension-owned vào thead: Chọn & Loại môn
    this._mountHeaderControls(table);

    // 2. Cân chỉnh colspan các hàng toàn bảng (semester row, summary row)
    this._alignTableColspans(table);

    // 3. Gắn controls và inline score editor cho từng hàng
    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll(':scope > tr'));

    const derived = this.store.getDerivedData();
    const allCourses = derived.semesters?.flatMap(s => s.courses) || [];
    let currentSemesterKey = null;
    let semesterCourseIndex = 0;

    rows.forEach(row => {
      // Hàng mở rộng của extension
      if (row.classList.contains('iuh-gpa-extension') || row.hasAttribute('data-iuh-gpa-extension')) {
        return;
      }

      // Hàng header học kỳ
      const semCell = row.querySelector(':scope > td.row-head');
      if (semCell) {
        const rawLabel = semCell.textContent.trim();
        currentSemesterKey = rawLabel.replace(/[()]/g, '').replace(/[\s-]+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        semesterCourseIndex = 0;

        // Wrap semester label + reset button in sticky inner container
        if (!semCell.querySelector('.iuh-gpa-semester-sticky-content')) {
          // Extract existing text content
          const existingText = semCell.textContent.trim();
          // Clear and rebuild with sticky inner wrapper
          while (semCell.firstChild) semCell.removeChild(semCell.firstChild);
          semCell.style.padding = '0';

          const stickyInner = this.doc.createElement('div');
          stickyInner.className = 'iuh-gpa-semester-sticky-content';

          const labelSpan = this.doc.createElement('span');
          labelSpan.style.fontWeight = '700';
          labelSpan.textContent = existingText;
          stickyInner.appendChild(labelSpan);

          const resetSemBtn = this.doc.createElement('button');
          resetSemBtn.type = 'button';
          resetSemBtn.className = 'iuh-gpa-btn-reset-sem';
          resetSemBtn.textContent = 'Khôi phục HK này';
          const semKey = currentSemesterKey;
          resetSemBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.store.resetSemester(semKey);
          });
          stickyInner.appendChild(resetSemBtn);
          semCell.appendChild(stickyInner);
        }
        return;
      }

      // Hàng môn học
      if (row.querySelector(':scope > td[title="DiemTongKet"]') && row.querySelector(':scope > td[title="DiemThi"]')) {
        const nameCell = row.querySelector(':scope > td.sticky-col, :scope > td[lang="kqht-tenlhp"]') || row.children[2];
        const rawName = nameCell ? (nameCell.querySelector('.iuh-gpa-course-official-name')?.textContent || nameCell.childNodes[0]?.textContent || '').trim() : '';

        // Tìm course tương ứng
        const semCourses = derived.semesters?.find(s => s.semesterKey === currentSemesterKey)?.courses || [];
        let course = semCourses.find(c => c.courseName === rawName);
        if (!course) {
          course = allCourses.find(c => c.courseName === rawName);
        }

        if (course) {
          row.setAttribute('data-course-id', course.id);

          // Gắn điều khiển Chọn & Loại môn vào bên trong ô Tên môn (giữ nguyên logical 27 columns gốc)
          this._mountCourseRowControls(row, course);

          // Gắn Inline Score Editor cho các ô điểm thành phần
          this._setupInlineEditing(row, course);

          // Chuẩn bị ô điểm tổng kết & kết quả
          this._setupResultCellDisplay(row, course);
        }
      }
    });

    // Inject "Add semester" control row at the bottom of the actual table
    this._mountAddSemesterRow(table);

    // 4. Cân chỉnh chính xác vị trí và độ rộng của 4 cột sticky của IUH
    this._recalibrateStickyColumns(table);
  }

  /**
   * Đồng bộ hóa và cố định left offset chuẩn xác cho 4 cột sticky IUH:
   * Cột 0 (STT): 0px (rộng 55px)
   * Cột 1 (Mã LHP): 55px (rộng 140px)
   * Cột 2 (Tên môn): 195px (rộng 380px)
   * Cột 3 (Số TC): 575px (rộng 65px)
   * Chống hoàn toàn hiện tượng dãn toác bảng hoặc trôi ngang do freeze-table.
   */
  _recalibrateStickyColumns(table) {
    if (!table) return;

    // Cấu hình cố định cột theo yêu cầu người dùng:
    // Cột 0 (Chọn): STICKY (left: 0px, width: 48px)
    // Cột 1 (Loại môn): STICKY (left: 48px, width: 110px)
    // Cột 2 (STT): KHÔNG CỐ ĐỊNH (STATIC, left: auto)
    // Cột 3 (Mã LHP): KHÔNG CỐ ĐỊNH (STATIC, left: auto)
    // Cột 4 (Tên môn): STICKY (left: 158px, width: 240px)
    // Cột 5 (Số TC): STICKY (left: 398px, width: 60px)
    const configureRowCells = (cells) => {
      if (!cells || cells.length < 6) return;

      // Cột 0: Chọn (STICKY)
      cells[0].classList.add('sticky-col');
      cells[0].style.setProperty('position', 'sticky', 'important');
      cells[0].style.setProperty('left', '0px', 'important');
      cells[0].style.setProperty('width', '48px', 'important');
      cells[0].style.setProperty('min-width', '48px', 'important');
      cells[0].style.setProperty('max-width', '48px', 'important');

      // Cột 1: Loại môn (STICKY)
      cells[1].classList.add('sticky-col');
      cells[1].style.setProperty('position', 'sticky', 'important');
      cells[1].style.setProperty('left', '48px', 'important');
      cells[1].style.setProperty('width', '130px', 'important');
      cells[1].style.setProperty('min-width', '130px', 'important');
      cells[1].style.setProperty('max-width', '130px', 'important');

      // Cột 2: STT (KHÔNG CỐ ĐỊNH - STATIC)
      cells[2].classList.remove('sticky-col');
      cells[2].style.removeProperty('left');
      cells[2].style.setProperty('position', 'static', 'important');
      cells[2].style.setProperty('left', 'auto', 'important');
      cells[2].style.setProperty('width', '48px', 'important');
      cells[2].style.setProperty('min-width', '48px', 'important');

      // Cột 3: Mã lớp học phần (KHÔNG CỐ ĐỊNH - STATIC)
      cells[3].classList.remove('sticky-col');
      cells[3].style.removeProperty('left');
      cells[3].style.setProperty('position', 'static', 'important');
      cells[3].style.setProperty('left', 'auto', 'important');
      cells[3].style.setProperty('width', '140px', 'important');
      cells[3].style.setProperty('min-width', '140px', 'important');

      // Cột 4: Tên môn học (STICKY - dính tại 178px = 48 + 130)
      cells[4].classList.add('sticky-col');
      cells[4].style.setProperty('position', 'sticky', 'important');
      cells[4].style.setProperty('left', '178px', 'important');
      cells[4].style.setProperty('width', '240px', 'important');
      cells[4].style.setProperty('min-width', '240px', 'important');

      // Cột 5: Số tín chỉ (STICKY - dính tại 418px = 178 + 240)
      cells[5].classList.add('sticky-col');
      cells[5].style.setProperty('position', 'sticky', 'important');
      cells[5].style.setProperty('left', '418px', 'important');
      cells[5].style.setProperty('width', '60px', 'important');
      cells[5].style.setProperty('min-width', '60px', 'important');
      cells[5].style.setProperty('max-width', '65px', 'important');
    };

    // Căn chỉnh thead first row
    const headRow = table.querySelector('thead > tr:first-child');
    if (headRow) {
      configureRowCells(headRow.children);
    }

    // Căn chỉnh tất cả các hàng môn học trong tbody
    const bodyRows = table.querySelectorAll('tbody > tr');
    bodyRows.forEach(row => {
      if (row.classList.contains('iuh-gpa-future-semester-row') || row.classList.contains('iuh-gpa-add-semester-row')) return;
      const firstCell = row.children[0];
      if (firstCell && (firstCell.classList.contains('row-head') || firstCell.getAttribute('colspan'))) return;
      configureRowCells(row.children);
    });

    // Override window.freezeTable của IUH để bảo toàn cấu trúc
    if (this.doc && this.doc.defaultView) {
      if (!this._originalFreezeTable && this.doc.defaultView.freezeTable) {
        this._originalFreezeTable = this.doc.defaultView.freezeTable;
      }
      this.doc.defaultView.freezeTable = () => {
        this._recalibrateStickyColumns(table);
      };
    }
  }

  /**
   * Thêm hàng "+ Thêm học kỳ mới" ở cuối bảng điểm gốc (sau semester thực tế cuối cùng).
   * Hàng này owned by extension, không bị IUHPageAdapter parse.
   */
  _mountAddSemesterRow(table) {
    if (!this.doc || !table) return;
    const existing = table.querySelector('.iuh-gpa-add-semester-row');
    if (existing) existing.remove();

    const tbody = table.querySelector('tbody') || table;
    const doc = this.doc;

    const addRow = doc.createElement('tr');
    addRow.className = 'iuh-gpa-add-semester-row iuh-gpa-extension iuh-gpa-future-row';
    addRow.setAttribute('data-iuh-gpa-extension', 'true');
    addRow.id = 'iuh-gpa-add-semester-row';

    const addTd = doc.createElement('td');
    addTd.colSpan = 29;
    addTd.style.padding = '0';

    const innerDiv = doc.createElement('div');
    innerDiv.className = 'iuh-gpa-add-semester-inner';

    const addBtn = doc.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'iuh-gpa-table-add-semester-btn';
    addBtn.className = 'iuh-gpa-btn-add-semester';
    addBtn.setAttribute('aria-label', 'Thêm học kỳ mô phỏng mới vào kế hoạch');

    // Plus icon (inline SVG)
    const svgNS = 'http://www.w3.org/2000/svg';
    const plusSvg = doc.createElementNS(svgNS, 'svg');
    plusSvg.setAttribute('width', '13'); plusSvg.setAttribute('height', '13');
    plusSvg.setAttribute('viewBox', '0 0 24 24'); plusSvg.setAttribute('fill', 'none');
    plusSvg.setAttribute('stroke', 'currentColor'); plusSvg.setAttribute('stroke-width', '2.5');
    plusSvg.setAttribute('stroke-linecap', 'round'); plusSvg.setAttribute('stroke-linejoin', 'round');
    plusSvg.setAttribute('aria-hidden', 'true');
    const l1 = doc.createElementNS(svgNS, 'line');
    l1.setAttribute('x1', '12'); l1.setAttribute('y1', '5'); l1.setAttribute('x2', '12'); l1.setAttribute('y2', '19');
    const l2 = doc.createElementNS(svgNS, 'line');
    l2.setAttribute('x1', '5'); l2.setAttribute('y1', '12'); l2.setAttribute('x2', '19'); l2.setAttribute('y2', '12');
    plusSvg.appendChild(l1); plusSvg.appendChild(l2);
    addBtn.appendChild(plusSvg);

    const btnLabel = doc.createElement('span');
    btnLabel.textContent = 'Thêm học kỳ mới';
    addBtn.appendChild(btnLabel);

    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.companionBar && typeof this.companionBar.openFuturePlannerModal === 'function') {
        this.companionBar.openFuturePlannerModal();
      }
    });

    innerDiv.appendChild(addBtn);
    addTd.appendChild(innerDiv);
    addRow.appendChild(addTd);
    tbody.appendChild(addRow);
  }

  _mountHeaderControls(table) {
    const doc = this.doc;
    const theadFirstRow = table.querySelector('thead > tr:first-child');
    if (!theadFirstRow) return;

    // Tránh chèn trùng nếu đã có cột Chọn
    if (theadFirstRow.querySelector('.iuh-gpa-col-select')) return;

    // 1. Thêm cột Chọn làm cột đầu tiên của bảng
    const thSelect = doc.createElement('th');
    thSelect.rowSpan = 3;
    thSelect.className = 'iuh-gpa-col-select iuh-gpa-extension sticky-col';
    thSelect.setAttribute('data-iuh-gpa-extension', 'true');
    thSelect.setAttribute('data-root', '1');
    const divSelect = doc.createElement('div');
    divSelect.textContent = 'Chọn';
    divSelect.title = 'Chọn học phần tính điểm mô phỏng';
    thSelect.appendChild(divSelect);

    // 2. Thêm cột Loại môn làm cột thứ hai của bảng
    const thType = doc.createElement('th');
    thType.rowSpan = 3;
    thType.className = 'iuh-gpa-col-type iuh-gpa-extension sticky-col';
    thType.setAttribute('data-iuh-gpa-extension', 'true');
    thType.setAttribute('data-root', '1');
    const divType = doc.createElement('div');
    divType.textContent = 'Loại môn';
    divType.title = 'Loại môn học';
    thType.appendChild(divType);

    // Chèn vào vị trí 2 cột đầu tiên của thead
    theadFirstRow.insertBefore(thType, theadFirstRow.firstChild);
    theadFirstRow.insertBefore(thSelect, theadFirstRow.firstChild);

    // Cấu hình cố định cột trong thead:
    // Cột 2 (STT) & Cột 3 (Mã LHP): KHÔNG CỐ ĐỊNH
    const sttTh = table.querySelector('thead [lang="kqht-stt"]');
    if (sttTh) {
      sttTh.classList.remove('sticky-col');
      sttTh.style.removeProperty('left');
      sttTh.style.setProperty('position', 'static', 'important');
      sttTh.style.setProperty('left', 'auto', 'important');
    }
    const malhpTh = table.querySelector('thead [lang="kqht-malhp"]');
    if (malhpTh) {
      malhpTh.classList.remove('sticky-col');
      malhpTh.style.removeProperty('left');
      malhpTh.style.setProperty('position', 'static', 'important');
      malhpTh.style.setProperty('left', 'auto', 'important');
    }

    // Cột 4 (Tên môn): STICKY (left: 178px)
    const nameTh = table.querySelector('thead [lang="kqht-tenlhp"]');
    if (nameTh) {
      nameTh.classList.add('sticky-col');
      nameTh.style.setProperty('position', 'sticky', 'important');
      nameTh.style.setProperty('left', '178px', 'important');
      nameTh.style.setProperty('width', '240px', 'important');
    }

    // Cột 5 (Số tín chỉ): CỐ ĐỊNH (STICKY left: 418px)
    const creditsTh = table.querySelector('thead [lang="kqht-stc"]');
    if (creditsTh) {
      creditsTh.classList.add('sticky-col');
      creditsTh.style.setProperty('position', 'sticky', 'important');
      creditsTh.style.setProperty('left', '418px', 'important');
      creditsTh.style.setProperty('width', '60px', 'important');
    }
  }

  _alignTableColspans(table) {
    const tbody = table.querySelector('tbody') || table;
    const rows = Array.from(tbody.querySelectorAll(':scope > tr'));

    rows.forEach(row => {
      // Semester row colspan: 29 cột (27 cột gốc IUH + 2 cột Chọn, Loại môn)
      const semCell = row.querySelector(':scope > td.row-head');
      if (semCell) {
        semCell.colSpan = 29;
      }

      // Summary row colspan & sticky alignment: 4 + 2 + 23 = 29
      if (row.querySelector('[lang^="kqht-tkhk-"]')) {
        row.classList.add('iuh-gpa-actual-summary-row');
        const allCells = Array.from(row.querySelectorAll(':scope > td'));
        if (allCells.length >= 2) {
          allCells[0].classList.add('iuh-gpa-actual-summary-cell-1');
          allCells[0].colSpan = 4; // Chọn + Loại môn + STT + Mã LHP
          allCells[1].classList.add('iuh-gpa-actual-summary-cell-2');
          allCells[1].colSpan = 2; // Tên môn + Số TC
        }

        // Cell 3 in original IUH is hidden filler spanning the remaining 23 columns
        if (allCells.length >= 3) {
          allCells[2].className = 'hidden';
          allCells[2].colSpan = 23;
        }

        // Remove any superfluous trailing filler cells beyond 3
        for (let i = 3; i < allCells.length; i++) {
          allCells[i].remove();
        }
      }
    });
  }

  _mountCourseRowControls(row, course) {
    const doc = this.doc;
    if (row.querySelector('.iuh-gpa-col-select')) return;

    // 1. Checkbox Chọn (Cột 0)
    const chk = doc.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'iuh-gpa-course-checkbox';
    chk.setAttribute('aria-label', `Chọn môn ${course.courseName} vào tính toán GPA mô phỏng`);
    chk.checked = course.included !== false;

    if (course.isExplicitNonGpa) {
      chk.title = 'Không tính vào TBTL theo Chương trình khung.';
    } else if (course.isFallbackNonGpa) {
      chk.title = 'Môn điều kiện / không tính vào điểm TBTL tích lũy';
    } else if (course.credits === 0) {
      chk.title = 'Môn 0 tín chỉ (không tính vào GPA chính thức)';
    } else {
      chk.title = 'Chọn học phần này vào tính điểm TBTL mô phỏng';
    }

    chk.classList.toggle('iuh-gpa-checkbox-overridden', Boolean(course.isSelectionOverridden));
    if (course.isSelectionOverridden) {
      chk.title = 'Tùy chỉnh mô phỏng (Đã chọn thủ công)';
    }

    chk.addEventListener('change', () => {
      this.store.setCourseOverride(course.id, { included: chk.checked });
    });

    const tdSelect = doc.createElement('td');
    tdSelect.className = 'text-center iuh-gpa-col-select iuh-gpa-extension sticky-col';
    tdSelect.setAttribute('data-iuh-gpa-extension', 'true');
    tdSelect.appendChild(chk);

    // 2. Select Loại môn (Cột 1)
    const sel = createCourseTypeSelect(course, {
      doc,
      onChange: (val) => {
        this.store.setCourseOverride(course.id, { courseTypeOverride: val });
      }
    });

    const customBadge = doc.createElement('span');
    customBadge.className = 'iuh-gpa-custom-type-badge';
    customBadge.textContent = 'Tùy chỉnh';
    customBadge.style.display = course.isTypeOverridden ? 'block' : 'none';

    const resetTypeBtn = doc.createElement('button');
    resetTypeBtn.type = 'button';
    resetTypeBtn.className = 'iuh-gpa-btn-reset-type';
    resetTypeBtn.textContent = course.curriculumCourse ? 'Khôi phục theo CTK' : 'Khôi phục tự động';
    resetTypeBtn.style.display = (course.isTypeOverridden || course.isSelectionOverridden) ? 'block' : 'none';

    resetTypeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.store.restoreCourseToCurriculum(course.id);
      sel.value = 'AUTO';
      sel.classList.remove('iuh-gpa-type-overridden');
    });

    const tdType = doc.createElement('td');
    tdType.className = 'text-center iuh-gpa-col-type iuh-gpa-extension sticky-col';
    tdType.setAttribute('data-iuh-gpa-extension', 'true');
    tdType.appendChild(sel);
    tdType.appendChild(customBadge);
    tdType.appendChild(resetTypeBtn);

    // Chèn Chọn và Loại môn vào 2 vị trí đầu tiên của hàng
    row.insertBefore(tdType, row.firstChild);
    row.insertBefore(tdSelect, row.firstChild);

    // 3. Tên môn học: giữ nguyên nội dung gốc, chỉ gắn nút Mô phỏng bên cạnh
    const nameCell = row.children[4]; // 0: Chọn, 1: Loại môn, 2: STT, 3: Mã LHP, 4: Tên môn
    if (nameCell) {
      nameCell.classList.add('iuh-gpa-col-course-name');
      if (!nameCell.querySelector('.iuh-gpa-trigger-btn')) {
        const trigger = doc.createElement('button');
        trigger.type = 'button';
        trigger.className = 'iuh-gpa-trigger-btn';
        trigger.style.marginLeft = '8px';

        const icon = createSimTriggerIcon(doc);
        const labelSpan = doc.createElement('span');
        labelSpan.className = 'iuh-gpa-trigger-label';
        labelSpan.textContent = 'Mô phỏng';

        trigger.appendChild(icon);
        trigger.appendChild(labelSpan);

        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          this._toggleCoursePanel(row);
        });

        nameCell.appendChild(trigger);
      }
      nameCell.classList.add('sticky-col');
      nameCell.style.setProperty('position', 'sticky', 'important');
      nameCell.style.setProperty('left', '178px', 'important');
      nameCell.style.setProperty('width', '240px', 'important');
    }

    // Cột 2 (STT) & Cột 3 (Mã LHP): KHÔNG CỐ ĐỊNH (STATIC)
    if (row.children[2]) {
      row.children[2].classList.remove('sticky-col');
      row.children[2].style.removeProperty('left');
      row.children[2].style.setProperty('position', 'static', 'important');
      row.children[2].style.setProperty('left', 'auto', 'important');
    }
    if (row.children[3]) {
      row.children[3].classList.remove('sticky-col');
      row.children[3].style.removeProperty('left');
      row.children[3].style.setProperty('position', 'static', 'important');
      row.children[3].style.setProperty('left', 'auto', 'important');
    }

    // Cột 5 (Số tín chỉ): CỐ ĐỊNH (STICKY left: 418px)
    const creditsCell = row.children[5];
    if (creditsCell) {
      creditsCell.classList.add('sticky-col');
      creditsCell.style.setProperty('position', 'sticky', 'important');
      creditsCell.style.setProperty('left', '418px', 'important');
      creditsCell.style.setProperty('width', '60px', 'important');
    }
  }

  _setupInlineEditing(row, course) {
    const doc = this.doc;
    if (!doc || !row || !course) return;

    const spec = [
      { selector: ':scope > td[title="DiemChuyenCan1"]', key: 'midterm', field: 'midterm' },
      { selector: ':scope > td[title="DiemThi"]', key: 'finalExam', field: 'finalExam' },
    ];

    for (let i = 1; i <= 9; i++) {
      const title = i <= 5 ? `DiemHeSo1${i}` : `DiemThuongKy${i}`;
      spec.push({ selector: `:scope > td[title="${title}"]`, key: `regular.${i}`, field: 'regular', slot: i });
    }

    for (let i = 1; i <= 5; i++) {
      spec.push({ selector: `:scope > td[title="DiemThucHanh${i}"]`, key: `practice.${i}`, field: 'practice', slot: i });
    }

    spec.forEach(item => {
      const cell = row.querySelector(item.selector);
      if (!cell || cell.hasAttribute('data-iuh-inline-init')) return;
      cell.setAttribute('data-iuh-inline-init', 'true');
      cell.classList.add('iuh-gpa-editable-cell');
      cell.setAttribute('tabindex', '0');
      cell.setAttribute('role', 'gridcell');

      // Khởi tạo overlay mô phỏng extension-owned mà KHÔNG xoá text node gốc
      const officialVal = cell.textContent.trim();
      cell.setAttribute('data-official-val', officialVal);

      let origWrapper = cell.querySelector('.iuh-gpa-orig-val');
      if (!origWrapper) {
        origWrapper = doc.createElement('span');
        origWrapper.className = 'iuh-gpa-orig-val';
        while (cell.firstChild) {
          origWrapper.appendChild(cell.firstChild);
        }
        cell.appendChild(origWrapper);
      }

      let simOverlay = cell.querySelector('.iuh-gpa-sim-val');
      if (!simOverlay) {
        simOverlay = doc.createElement('span');
        simOverlay.className = 'iuh-gpa-sim-val iuh-gpa-extension';
        simOverlay.setAttribute('data-iuh-gpa-extension', 'true');
        simOverlay.style.display = 'none';
        cell.appendChild(simOverlay);
      }

      const activateEditor = () => {
        if (cell.querySelector('.iuh-gpa-inline-input')) return;

        const currentSimVal = simOverlay.getAttribute('data-sim-num');
        const initialVal = (currentSimVal !== null && currentSimVal !== undefined)
          ? currentSimVal
          : officialVal;

        origWrapper.style.display = 'none';
        simOverlay.style.display = 'none';

        const input = doc.createElement('input');
        input.type = 'text';
        input.className = 'iuh-gpa-inline-input iuh-gpa-extension';
        input.setAttribute('data-iuh-gpa-extension', 'true');
        input.value = initialVal;
        input.setAttribute('aria-label', `Nhập điểm mô phỏng ${item.key} môn ${course.courseName}`);

        const finishEditing = (commit) => {
          if (!input.parentElement) return;
          if (commit) {
            const raw = input.value.trim();
            if (raw === '') {
              // Khôi phục điểm gốc
              this.store.resetCourseField(course.id, item.key);
            } else {
              const parsed = parseScore(raw);
              if (parsed.status === 'ok' && parsed.value >= 0 && parsed.value <= 10) {
                const scoreVal = parsed.value;
                if (item.field === 'midterm') {
                  this.store.setCourseOverride(course.id, { scores: { midterm: scoreVal }, midterm: scoreVal });
                } else if (item.field === 'finalExam') {
                  this.store.setCourseOverride(course.id, { scores: { finalExam: scoreVal }, finalExam: scoreVal });
                } else if (item.field === 'regular') {
                  this.store.setCourseOverride(course.id, { scores: { regular: { [item.slot]: scoreVal } } });
                } else if (item.field === 'practice') {
                  this.store.setCourseOverride(course.id, { scores: { practice: { [item.slot]: scoreVal } } });
                }
              } else {
                cell.classList.add('iuh-gpa-cell-invalid');
                setTimeout(() => cell.classList.remove('iuh-gpa-cell-invalid'), 600);
              }
            }
          } else {
            // Cancel via Escape
            if (cell.classList.contains('is-simulated-cell')) {
              simOverlay.style.display = 'inline-flex';
            } else {
              origWrapper.style.display = '';
            }
          }
          input.remove();
        };

        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            finishEditing(true);
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            finishEditing(false);
          }
        });

        input.addEventListener('blur', () => {
          finishEditing(true);
        });

        cell.appendChild(input);
        input.focus();
        input.select();
      };

      cell.addEventListener('click', (e) => {
        if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') return;
        activateEditor();
      });

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!cell.querySelector('input')) {
            e.preventDefault();
            activateEditor();
          }
        }
      });
    });
  }

  _setupResultCellDisplay(row, course) {
    const doc = this.doc;
    if (!doc || !row || !course) return;

    // TBQT (DiemTBQuaTrinh) TUYỆT ĐỐI BẤT BIẾN - chỉ bọc các ô kết quả được phép cập nhật
    ['DiemTongKet', 'DiemTinChi', 'DiemChu', 'XepLoai'].forEach(title => {
      const cell = row.querySelector(`:scope > td[title="${title}"]`);
      if (cell && !cell.hasAttribute('data-iuh-result-init')) {
        cell.setAttribute('data-iuh-result-init', 'true');
        const origVal = cell.textContent.trim();
        cell.setAttribute('data-official-val', origVal);

        let origWrapper = cell.querySelector('.iuh-gpa-orig-val');
        if (!origWrapper) {
          origWrapper = doc.createElement('span');
          origWrapper.className = 'iuh-gpa-orig-val';
          while (cell.firstChild) {
            origWrapper.appendChild(cell.firstChild);
          }
          cell.appendChild(origWrapper);
        }

        let simOverlay = cell.querySelector('.iuh-gpa-sim-val');
        if (!simOverlay) {
          simOverlay = doc.createElement('span');
          simOverlay.className = 'iuh-gpa-sim-val iuh-gpa-extension';
          simOverlay.setAttribute('data-iuh-gpa-extension', 'true');
          simOverlay.style.display = 'none';
          cell.appendChild(simOverlay);
        }
      }
    });
  }

  _toggleCoursePanel(courseRow) {
    const derived = this.store.getDerivedData();
    const allCourses = derived.semesters.flatMap(s => s.courses);

    const courseId = courseRow.getAttribute('data-course-id');
    const nameCell = courseRow.querySelector(':scope > td[lang="kqht-tenmon"]') || courseRow.querySelector(':scope > td.sticky-col') || courseRow.children[2];
    const rawName = nameCell ? (nameCell.querySelector('.iuh-gpa-cell-zone-name')?.textContent?.trim() || nameCell.textContent.trim()) : '';

    const course = (courseId && allCourses.find(c => c.id === courseId)) || allCourses.find(c => c.courseName === rawName);
    if (!course) return;

    if (this.activePanels.has(course.id)) {
      const panel = this.activePanels.get(course.id);
      panel.destroy();
      this.activePanels.delete(course.id);
    } else {
      const panel = new CourseSimulationPanel({
        course,
        targetRow: courseRow,
        store: this.store,
        onClose: () => {
          this.activePanels.delete(course.id);
        }
      });
      this.activePanels.set(course.id, panel);
    }
  }

  _onStateChange(derivedData) {
    if (!this.doc || !derivedData) return;
    const allCourses = derivedData.semesters?.flatMap(s => s.courses) || [];

    allCourses.forEach(course => {
      const row = this.doc.querySelector(`tr[data-course-id="${course.id}"]`);
      if (!row) return;

      // 1. Cập nhật checkbox Chọn (Subtle visual, no row height shift)
      const chk = row.querySelector('.iuh-gpa-course-checkbox');
      if (chk) {
        chk.checked = course.included !== false;
        chk.classList.toggle('iuh-gpa-checkbox-overridden', Boolean(course.isSelectionOverridden));
        if (course.isSelectionOverridden) {
          chk.title = 'Tùy chỉnh mô phỏng (Đã chọn thủ công)';
        } else if (course.isExplicitNonGpa) {
          chk.title = 'Không tính vào TBTL theo Chương trình khung.';
        } else if (course.credits === 0) {
          chk.title = 'Môn 0 tín chỉ (không tính vào GPA chính thức)';
        } else {
          chk.title = 'Chọn học phần này vào tính điểm TBTL mô phỏng';
        }
      }

      // 2. Cập nhật select Loại môn (Amber border subtle, no text badge clutter)
      const selType = row.querySelector('.iuh-gpa-course-type-select');
      const resetTypeBtn = row.querySelector('.iuh-gpa-btn-reset-type');
      if (selType) {
        selType.value = course.courseTypeOverride || 'AUTO';
        selType.classList.toggle('iuh-gpa-select-overridden', Boolean(course.isTypeOverridden));
        const autoOpt = selType.querySelector('option[value="AUTO"]');
        if (autoOpt) {
          autoOpt.textContent = getAutoCourseTypeLabel(course);
        }
        if (course.isTypeOverridden) {
          selType.title = 'Tùy chỉnh thủ công (Đã thay đổi loại môn)';
        } else if (course.curriculumCourse) {
          selType.title = `Xác định từ Chương trình khung: LT ${course.curriculumCourse.theoryHours} · TH ${course.curriculumCourse.practiceHours}`;
        } else {
          selType.title = 'Xác định tự động theo quy chế';
        }
      }
      if (resetTypeBtn) {
        resetTypeBtn.style.display = (course.isTypeOverridden || course.isSelectionOverridden) ? 'block' : 'none';
        resetTypeBtn.textContent = course.curriculumCourse ? 'Khôi phục theo CTK' : 'Khôi phục tự động';
      }

      // 3. Cập nhật các ô điểm thành phần (Giữa kỳ, TX 1-9, TH 1-5, Cuối kỳ)
      const updateScoreCell = (selector, simNum, isSim) => {
        const cell = row.querySelector(selector);
        if (!cell) return;
        const origWrapper = cell.querySelector('.iuh-gpa-orig-val');
        let simSpan = cell.querySelector('.iuh-gpa-sim-val');
        if (!simSpan) {
          simSpan = this.doc.createElement('span');
          simSpan.className = 'iuh-gpa-sim-val iuh-gpa-extension';
          simSpan.setAttribute('data-iuh-gpa-extension', 'true');
          cell.appendChild(simSpan);
        }

        if (isSim && typeof simNum === 'number') {
          cell.classList.add('is-simulated-cell');
          if (origWrapper) origWrapper.style.display = 'none';
          simSpan.style.display = 'inline-flex';
          simSpan.setAttribute('data-sim-num', simNum.toFixed(2));
          simSpan.textContent = formatScore2(simNum);
          simSpan.title = 'Điểm mô phỏng';
        } else {
          cell.classList.remove('is-simulated-cell');
          if (origWrapper) origWrapper.style.display = '';
          simSpan.style.display = 'none';
          simSpan.removeAttribute('data-sim-num');
          simSpan.textContent = '';
          simSpan.removeAttribute('title');
        }
      };

      // Midterm
      const isMidtermSim = course.simulatedMidterm !== null && course.assessments?.midterm?.value !== course.simulatedMidterm;
      updateScoreCell(':scope > td[title="DiemChuyenCan1"]', course.simulatedMidterm, isMidtermSim);

      // Final Exam
      const isFinalSim = course.simulatedFinal !== null && course.originalFinal !== course.simulatedFinal;
      updateScoreCell(':scope > td[title="DiemThi"]', course.simulatedFinal, isFinalSim);

      // Regular
      (course.simulatedRegular || []).forEach(r => {
        const title = r.slot <= 5 ? `DiemHeSo1${r.slot}` : `DiemThuongKy${r.slot}`;
        updateScoreCell(`:scope > td[title="${title}"]`, r.value, r.isSimulated);
      });

      // Practice
      (course.simulatedPractice || []).forEach(p => {
        updateScoreCell(`:scope > td[title="DiemThucHanh${p.slot}"]`, p.value, p.isSimulated);
      });

    // 4. Cập nhật ô kết quả: Điểm tổng kết, Điểm tín chỉ, Điểm chữ, Xếp loại
    // (LƯU Ý: DiemTBQuaTrinh là dữ liệu chính thức bất biến, tuyệt đối không render kết quả mô phỏng vào TBQT)
      const updateResultCell = (selector, simVal, isChanged, isNumericScore) => {
        const cell = row.querySelector(selector);
        if (!cell) return;
        const origWrapper = cell.querySelector('.iuh-gpa-orig-val');
        let simSpan = cell.querySelector('.iuh-gpa-sim-val');
        if (!simSpan) {
          simSpan = this.doc.createElement('span');
          simSpan.className = 'iuh-gpa-sim-val iuh-gpa-extension';
          simSpan.setAttribute('data-iuh-gpa-extension', 'true');
          cell.appendChild(simSpan);
        }

        if (isChanged && simVal !== null && simVal !== undefined && simVal !== '--') {
          cell.classList.add('is-simulated-cell');
          if (origWrapper) origWrapper.style.display = 'none';
          simSpan.style.display = 'inline-flex';
          simSpan.textContent = isNumericScore ? formatScore2(simVal) : String(simVal);
          simSpan.title = 'Điểm mô phỏng';
        } else {
          cell.classList.remove('is-simulated-cell');
          if (origWrapper) origWrapper.style.display = '';
          simSpan.style.display = 'none';
          simSpan.textContent = '';
          simSpan.removeAttribute('title');
        }
      };

      // Điểm tổng kết: Nhận course.score10 (courseTotal/TBM)
      const isTotalChanged = course.isSimulated && course.score10 !== course.originalScore10;
      updateResultCell(':scope > td[title="DiemTongKet"]', course.score10, isTotalChanged, true);

      // Điểm tín chỉ (Thang 4)
      const isScore4Changed = course.isSimulated && course.score4 !== course.originalScore4;
      updateResultCell(':scope > td[title="DiemTinChi"]', course.score4, isScore4Changed, true);

      // Điểm chữ
      const isLetterChanged = course.isSimulated && course.letter !== (course.officialResult?.letter || '');
      updateResultCell(':scope > td[title="DiemChu"]', course.letter, isLetterChanged, false);

      // Xếp loại
      const isClassChanged = course.isSimulated && course.classification !== (course.officialResult?.classification || '');
      updateResultCell(':scope > td[title="XepLoai"]', course.classification, isClassChanged, false);

      // 5. Cập nhật trạng thái Đạt / Không đạt (nếu thay đổi)
      const isDatCell = row.querySelector(':scope > td.isdat') || row.children[row.children.length - 1];
      if (isDatCell) {
        let simPassSpan = isDatCell.querySelector('.iuh-gpa-pass-sim-val');
        const origPassed = Boolean(course.officialResult?.passed);
        const simPassed = Boolean(course.passed);
        const isPassChanged = course.isSimulated && origPassed !== simPassed;

        if (isPassChanged) {
          if (!simPassSpan) {
            simPassSpan = this.doc.createElement('span');
            simPassSpan.className = 'iuh-gpa-pass-sim-val iuh-gpa-extension';
            simPassSpan.setAttribute('data-iuh-gpa-extension', 'true');
            isDatCell.appendChild(simPassSpan);
          }
          const origCheck = isDatCell.querySelector('.check') || isDatCell.firstElementChild;
          if (origCheck) origCheck.style.display = 'none';
          simPassSpan.style.display = 'inline-block';
          if (simPassed) {
            simPassSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            simPassSpan.title = 'Mô phỏng: Đạt';
          } else {
            simPassSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
            simPassSpan.title = 'Mô phỏng: Không đạt';
          }
        } else {
          if (simPassSpan) {
            simPassSpan.style.display = 'none';
            simPassSpan.innerHTML = '';
          }
          const origCheck = isDatCell.querySelector('.check') || isDatCell.firstElementChild;
          if (origCheck) origCheck.style.display = '';
        }
      }

      // 6. Cập nhật nút trigger "Mô phỏng"
      const triggerBtn = row.querySelector('.iuh-gpa-trigger-btn');
      if (triggerBtn) {
        const label = triggerBtn.querySelector('.iuh-gpa-trigger-label') || triggerBtn.querySelector('span');
        if (course.isSimulated) {
          triggerBtn.classList.add('simulating');
          const txt = `Mô phỏng (${course.score10 !== null ? formatScore2(course.score10) : '--'})`;
          if (label) label.textContent = txt;
          else triggerBtn.textContent = txt;
        } else {
          triggerBtn.classList.remove('simulating');
          if (label) label.textContent = 'Mô phỏng';
          else triggerBtn.textContent = 'Mô phỏng';
        }
      }
    });

    // Cập nhật các dòng tổng kết học kỳ và tích lũy
    this._updateSummaryRows(derivedData);

    // Cập nhật các hàng học kỳ tương lai (Phase 6A.4)
    this._updateFuturePlanTable(derivedData);
  }

  _updateSummaryRows(derivedData) {
    if (!this.doc || !derivedData || !Array.isArray(derivedData.semesters)) return;

    derivedData.semesters.forEach(sem => {
      const semCourses = sem.courses || [];
      if (semCourses.length === 0) return;
      const firstCourseRow = this.doc.querySelector(`tr[data-course-id="${semCourses[0].id}"]`);
      if (!firstCourseRow) return;

      const lastCourseRow = this.doc.querySelector(`tr[data-course-id="${semCourses[semCourses.length - 1].id}"]`);
      if (!lastCourseRow) return;

      // Tìm các dòng summary sau lastCourseRow
      const summaryRows = [];
      let sibling = lastCourseRow.nextElementSibling;
      while (sibling) {
        if (sibling.querySelector('td.row-head:not(.hidden)') && !sibling.querySelector('[lang^="kqht-tkhk-"]')) {
          break;
        }
        if (sibling.querySelector('[lang^="kqht-tkhk-"]')) {
          summaryRows.push(sibling);
        }
        sibling = sibling.nextElementSibling;
      }

      if (summaryRows.length === 0) return;

      const isSemSimulated = semCourses.some(c => c.isSimulated);
      const isCumSimulated = derivedData.allSimulatedCourses ? derivedData.allSimulatedCourses.some(c => c.isSimulated) : false;

      const updateSummaryCell = (langAttr, gpaRaw, isSim) => {
        let span = null;
        for (const r of summaryRows) {
          span = r.querySelector(`[lang="${langAttr}"]`);
          if (span) break;
        }
        if (!span) return;
        const cell = span.parentElement;
        if (!cell) return;

        const origValSpan = span.nextElementSibling;
        let simSpan = cell.querySelector('.iuh-gpa-summary-sim-val');
        if (!simSpan) {
          simSpan = this.doc.createElement('span');
          simSpan.className = 'iuh-gpa-summary-sim-val iuh-gpa-extension';
          simSpan.setAttribute('data-iuh-gpa-extension', 'true');
          cell.appendChild(simSpan);
        }

        if (typeof gpaRaw === 'number' && !isNaN(gpaRaw)) {
          if (origValSpan) origValSpan.style.display = 'none';
          simSpan.style.display = 'inline';
          simSpan.textContent = ' ' + formatAverage4(gpaRaw);
          simSpan.title = 'Tính lại từ dữ liệu học phần đang hiển thị.';
          if (isSim) {
            simSpan.classList.add('is-simulated-summary');
          } else {
            simSpan.classList.remove('is-simulated-summary');
          }
        } else {
          if (origValSpan) origValSpan.style.display = '';
          simSpan.style.display = 'none';
          simSpan.classList.remove('is-simulated-summary');
          simSpan.textContent = '';
        }
      };

      // GPA Học kỳ Hệ 10
      updateSummaryCell('kqht-tkhk-diemtbhocluc', sem.calculatedSimulatedGPA?.gpa10Raw, isSemSimulated);
      // GPA Học kỳ Hệ 4
      updateSummaryCell('kqht-tkhk-diemtbtinchi', sem.calculatedSimulatedGPA?.gpa4Raw, isSemSimulated);
      // GPA Tích lũy Hệ 10
      updateSummaryCell('kqht-tkhk-diemtbhocluctichluy', sem.cumulativeSimulatedGPA?.gpa10Raw, isCumSimulated);
      // GPA Tích lũy Hệ 4
      updateSummaryCell('kqht-tkhk-diemtbtinchitichluy', sem.cumulativeSimulatedGPA?.gpa4Raw, isCumSimulated);
    });
  }

  _updateFuturePlanTable(derivedData) {
    if (!this.table || !this.doc) return;

    // 1. Remove old future plan rows
    const oldFutureRows = Array.from(this.table.querySelectorAll('tr.iuh-gpa-future-row'));
    oldFutureRows.forEach(r => r.remove());

    const tbody = this.table.querySelector('tbody') || this.table;
    const doc = this.doc;

    const futurePlan = derivedData.futurePlan;
    const fSemesters = (futurePlan && Array.isArray(futurePlan.semesters)) ? futurePlan.semesters : [];

    const allCourses = derivedData.semesters?.flatMap(s => s.courses) || [];
    let maxActualSTT = 0;
    if (allCourses && allCourses.length > 0) {
      for (const c of allCourses) {
        const ord = Number(c.ordinal || c.stt || c.displayOrdinal);
        if (!isNaN(ord) && ord > maxActualSTT) maxActualSTT = ord;
      }
    }
    // Fallback: Check DOM rows directly from actual table
    if (maxActualSTT === 0 && this.table) {
      const sttCells = this.table.querySelectorAll('tbody tr:not(.iuh-gpa-future-row) td.iuh-gpa-col-stt');
      sttCells.forEach(cell => {
        const n = parseInt(cell.textContent.trim(), 10);
        if (!isNaN(n) && n > maxActualSTT) maxActualSTT = n;
      });
    }

    const futureDisplayOrdinals = (typeof FutureSemesterEngine !== 'undefined' && typeof FutureSemesterEngine.assignFutureDisplayOrdinals === 'function')
      ? FutureSemesterEngine.assignFutureDisplayOrdinals({ actualCourses: allCourses, futureSemesters: fSemesters, maxActualSTT })
      : {};

    if (fSemesters.length > 0) {
      fSemesters.forEach(fSem => {
        // 1. Dòng Tiêu đề học kỳ tương lai
        const semTr = doc.createElement('tr');
        semTr.className = 'iuh-gpa-future-row iuh-gpa-future-semester-row iuh-gpa-extension';
        semTr.setAttribute('data-iuh-gpa-extension', 'true');
        semTr.setAttribute('data-future-semester-id', fSem.id);

        const semTd = doc.createElement('td');
        semTd.colSpan = 29;
        semTd.style.padding = '0';

        const stickyInner = doc.createElement('div');
        stickyInner.className = 'iuh-gpa-future-sem-title iuh-gpa-semester-sticky-content';

        const leftDiv = doc.createElement('div');
        leftDiv.className = 'iuh-gpa-future-sem-left';

        const titleText = doc.createElement('span');
        titleText.style.fontWeight = '700';
        titleText.style.color = '#153898';
        titleText.textContent = fSem.label;

        const badge = doc.createElement('span');
        badge.className = 'iuh-gpa-future-badge';
        badge.textContent = 'Mô phỏng';

        leftDiv.appendChild(titleText);
        leftDiv.appendChild(badge);

        const actionsDiv = doc.createElement('div');
        actionsDiv.className = 'iuh-gpa-future-sem-actions';

        const addCourseBtn = doc.createElement('button');
        addCourseBtn.type = 'button';
        addCourseBtn.className = 'iuh-gpa-btn-future-action';
        addCourseBtn.textContent = '+ Thêm môn';
        addCourseBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.companionBar && typeof this.companionBar.openFuturePlannerModal === 'function') {
            this.companionBar.openFuturePlannerModal(fSem.id);
          }
        });

        const removeSemBtn = doc.createElement('button');
        removeSemBtn.type = 'button';
        removeSemBtn.className = 'iuh-gpa-btn-future-action iuh-gpa-btn-future-danger';
        removeSemBtn.textContent = 'Xóa học kỳ';
        removeSemBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const coursesCount = fSem.courses?.length || 0;
          if (coursesCount > 0 && this.companionBar && typeof this.companionBar.showConfirmModal === 'function') {
            this.companionBar.showConfirmModal({
              title: 'Xóa học kỳ mô phỏng',
              message: `Bạn có chắc muốn xóa học kỳ ${fSem.label} cùng ${coursesCount} môn học trong kế hoạch?`,
              onConfirm: () => {
                this.store.removeFutureSemester(fSem.id);
              }
            });
            return;
          }
          this.store.removeFutureSemester(fSem.id);
        });

        actionsDiv.appendChild(addCourseBtn);
        actionsDiv.appendChild(removeSemBtn);

        stickyInner.appendChild(leftDiv);
        stickyInner.appendChild(actionsDiv);
        semTd.appendChild(stickyInner);
        semTr.appendChild(semTd);
        tbody.appendChild(semTr);

        // 2. Các dòng môn học tương lai (chuẩn 29 cột IUH)
        const courses = fSem.courses || [];
        courses.forEach((c, cIdx) => {
          const row = doc.createElement('tr');
          row.className = 'iuh-gpa-future-row iuh-gpa-future-course-row iuh-gpa-extension';
          row.setAttribute('data-iuh-gpa-extension', 'true');
          row.setAttribute('data-future-course-code', c.curriculumCourseCode);

          // Cột 0: Chọn
          const tdSelect = doc.createElement('td');
          tdSelect.className = 'text-center iuh-gpa-col-select sticky-col';
          tdSelect.setAttribute('title', 'Chon');
          const chk = doc.createElement('input');
          chk.type = 'checkbox';
          chk.className = 'iuh-gpa-course-checkbox';
          chk.checked = c.included !== false;
          chk.setAttribute('aria-label', `Chọn môn ${c.courseName} vào tính toán GPA`);
          chk.addEventListener('change', () => {
            this.store.toggleFutureCourseInclusion(c.curriculumCourseCode, chk.checked);
          });
          tdSelect.appendChild(chk);
          row.appendChild(tdSelect);

          // Cột 1: Loại môn
          const tdType = doc.createElement('td');
          tdType.className = 'text-center iuh-gpa-col-type sticky-col';
          tdType.setAttribute('title', 'LoaiMon');
          const sel = createCourseTypeSelect(c, {
            doc,
            onChange: (val) => {
              this.store.setFutureCourseType(c.curriculumCourseCode, val === 'AUTO' ? null : val);
            }
          });
          tdType.appendChild(sel);
          if (c.courseTypeOverride) {
            const resetTypeBtn = doc.createElement('button');
            resetTypeBtn.type = 'button';
            resetTypeBtn.className = 'iuh-gpa-btn-reset-type';
            resetTypeBtn.textContent = (c.curriculumCourse || c.curriculumCourseCode) ? 'Khôi phục theo CTK' : 'Khôi phục tự động';
            resetTypeBtn.style.display = 'block';
            resetTypeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.store.setFutureCourseType(c.curriculumCourseCode, null);
            });
            tdType.appendChild(resetTypeBtn);
          }
          row.appendChild(tdType);

          // Cột 2: STT (KHÔNG CỐ ĐỊNH - STATIC)
          const tdIdx = doc.createElement('td');
          tdIdx.className = 'text-center iuh-gpa-col-stt';
          tdIdx.setAttribute('title', 'STT');
          const computedSTT = futureDisplayOrdinals[c.curriculumCourseCode] || futureDisplayOrdinals[c.id] || (maxActualSTT + cIdx + 1);
          tdIdx.textContent = computedSTT.toString();
          row.appendChild(tdIdx);

          // Cột 3: Mã HP (KHÔNG CỐ ĐỊNH - STATIC)
          const tdCode = doc.createElement('td');
          tdCode.className = 'text-center iuh-gpa-col-class-code';
          tdCode.setAttribute('title', 'MaLHP');
          const codeText = doc.createElement('span');
          codeText.textContent = c.curriculumCourseCode;
          const tag = doc.createElement('span');
          tag.className = 'iuh-gpa-ctk-badge-tag';
          tag.textContent = 'Mã HP';
          tdCode.appendChild(codeText);
          tdCode.appendChild(tag);
          row.appendChild(tdCode);

          // Cột 4: Tên môn (CỐ ĐỊNH - STICKY)
          const tdName = doc.createElement('td');
          tdName.className = 'text-start iuh-gpa-col-course-name sticky-col';
          tdName.setAttribute('title', 'TenLHP');

          const nameWrap = doc.createElement('div');
          nameWrap.style.display = 'flex';
          nameWrap.style.flexDirection = 'column';
          nameWrap.style.gap = '2px';

          const nameLine = doc.createElement('div');
          nameLine.style.fontWeight = '600';
          nameLine.textContent = c.courseName;
          nameWrap.appendChild(nameLine);

          const actionsLine = doc.createElement('div');
          actionsLine.style.display = 'flex';
          actionsLine.style.alignItems = 'center';
          actionsLine.style.gap = '6px';

          const simBadge = doc.createElement('span');
          simBadge.style.fontSize = '9px';
          simBadge.style.background = '#EFF6FF';
          simBadge.style.color = '#1E40AF';
          simBadge.style.padding = '1px 4px';
          simBadge.style.borderRadius = '3px';
          simBadge.textContent = 'Mô phỏng';
          actionsLine.appendChild(simBadge);

          const delCourseBtn = doc.createElement('button');
          delCourseBtn.type = 'button';
          delCourseBtn.className = 'iuh-gpa-btn-reset-type';
          delCourseBtn.style.color = '#DC2626';
          delCourseBtn.style.borderColor = '#FCA5A5';
          delCourseBtn.textContent = 'Xóa khỏi KH';
          delCourseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.store.removeFutureCourse(c.curriculumCourseCode);
          });
          actionsLine.appendChild(delCourseBtn);

          // Di chuyển sang học kỳ khác nếu có nhiều hơn 1 học kỳ tương lai
          if (fSemesters.length > 1) {
            const moveSel = doc.createElement('select');
            moveSel.className = 'iuh-gpa-course-type-select';
            moveSel.style.fontSize = '9.5px';
            moveSel.style.maxWidth = '110px';
            const placeholder = doc.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Di chuyển...';
            moveSel.appendChild(placeholder);

            fSemesters.forEach(otherSem => {
              if (otherSem.id !== fSem.id) {
                const opt = doc.createElement('option');
                opt.value = otherSem.id;
                opt.textContent = otherSem.label;
                moveSel.appendChild(opt);
              }
            });

            moveSel.addEventListener('change', () => {
              if (moveSel.value) {
                this.store.moveFutureCourse(c.curriculumCourseCode, moveSel.value);
              }
            });
            actionsLine.appendChild(moveSel);
          }

          nameWrap.appendChild(actionsLine);
          tdName.appendChild(nameWrap);
          row.appendChild(tdName);

          // Cột 5: Số TC (CỐ ĐỊNH - STICKY)
          const tdCredits = doc.createElement('td');
          tdCredits.className = 'text-center iuh-gpa-col-credits sticky-col';
          tdCredits.setAttribute('title', 'SoTinChi');
          tdCredits.textContent = (c.credits || 0).toString();
          row.appendChild(tdCredits);

          // Xác định các component có nghĩa theo rule
          const effectiveType = c.courseTypeOverride || c.inferredCourseType || 'UNKNOWN';
          const isTheory = effectiveType === 'THEORY';
          const isPractice = effectiveType === 'PRACTICE';
          const isSpecial = effectiveType === 'SPECIAL';

          // Helper tạo ô điểm có inline editor
          const createScoreTd = (key, idx, val, titleAttr, isAllowed = true, highlightInput = false) => {
            const td = doc.createElement('td');
            td.className = 'text-center';
            td.setAttribute('title', titleAttr);
            if (highlightInput) {
              td.classList.add('iuh-gpa-special-final-score');
              td.title = 'Môn Đặc biệt: nhập điểm Cuối kỳ tại ô này để mô phỏng';
            }

            if (!isAllowed) {
              td.classList.add('iuh-gpa-score-disabled');
              td.textContent = '';
              return td;
            }

            const isSet = typeof val === 'number' && !isNaN(val);
            if (isSet) {
              td.classList.add('is-simulated-cell');
              td.textContent = formatScore2(val);
              td.title = 'Điểm mô phỏng';
            } else if (highlightInput) {
              const hint = doc.createElement('span');
              hint.className = 'iuh-gpa-special-score-hint';
              hint.textContent = 'Nhập điểm';
              td.appendChild(hint);
            } else {
              td.textContent = '';
            }
            td.style.cursor = 'pointer';

            td.addEventListener('click', () => {
              if (td.querySelector('input')) return;
              const currentVal = isSet ? val.toString() : '';
              td.textContent = '';
              const inp = doc.createElement('input');
              inp.type = 'number';
              inp.step = '0.1';
              inp.min = '0';
              inp.max = '10';
              inp.value = currentVal;
              inp.className = `iuh-gpa-inline-score-input${highlightInput ? ' iuh-gpa-special-final-input' : ''}`;
              inp.style.width = '42px';
              inp.style.textAlign = 'center';

              const commit = () => {
                const raw = inp.value.trim().replace(',', '.');
                const n = parseFloat(raw);
                const finalVal = (!isNaN(n) && n >= 0 && n <= 10) ? n : null;
                this.store.updateFutureCourseScore(c.curriculumCourseCode, key, idx, finalVal);
              };

              inp.addEventListener('keydown', (ke) => {
                if (ke.key === 'Enter') {
                  inp.blur();
                } else if (ke.key === 'Escape') {
                  inp.value = currentVal;
                  inp.blur();
                }
              });
              inp.addEventListener('blur', commit);

              td.appendChild(inp);
              inp.focus();
              inp.select();
            });

            return td;
          };

          // Cột 7: Giữa kỳ (DiemChuyenCan1)
          const allowMidterm = !isPractice && !isSpecial;
          row.appendChild(createScoreTd('midterm', 0, c.scores?.midterm, 'DiemChuyenCan1', allowMidterm));

          // Cột 8-16: TX 1-9 (DiemHeSo11...DiemThuongKy9)
          const allowRegular = !isPractice && !isSpecial;
          for (let t = 0; t < 9; t++) {
            const title = (t < 5) ? `DiemHeSo1${t + 1}` : `DiemThuongKy${t + 1}`;
            row.appendChild(createScoreTd('regular', t, c.scores?.regular ? c.scores.regular[t] : null, title, allowRegular));
          }

          // Cột 17-21: TH 1-5 (DiemThucHanh1...DiemThucHanh5)
          const allowPractice = !isTheory && !isSpecial;
          for (let p = 0; p < 5; p++) {
            const title = `DiemThucHanh${p + 1}`;
            row.appendChild(createScoreTd('practice', p, c.scores?.practice ? c.scores.practice[p] : null, title, allowPractice));
          }

          // Cột 22: Cuối kỳ (DiemThi)
          const allowFinal = !isPractice;
          row.appendChild(createScoreTd('final', 0, c.scores?.final, 'DiemThi', allowFinal, isSpecial));

          // Cột 23: Điểm tổng kết
          const tdTbm = doc.createElement('td');
          tdTbm.setAttribute('title', 'DiemTongKet');
          tdTbm.className = 'text-center';
          if (typeof c.score10 === 'number') {
            tdTbm.classList.add('is-simulated-cell');
            tdTbm.textContent = formatScore2(c.score10);
          }
          row.appendChild(tdTbm);

          // Cột 24: Thang 4
          const tdGpa4 = doc.createElement('td');
          tdGpa4.setAttribute('title', 'DiemTinChi');
          tdGpa4.className = 'text-center';
          if (typeof c.score4 === 'number') {
            tdGpa4.classList.add('is-simulated-cell');
            tdGpa4.textContent = formatScore2(c.score4);
          }
          row.appendChild(tdGpa4);

          // Cột 25: Điểm chữ
          const tdLetter = doc.createElement('td');
          tdLetter.setAttribute('title', 'DiemChu');
          tdLetter.className = 'text-center';
          tdLetter.textContent = c.letter || '';
          row.appendChild(tdLetter);

          // Cột 26: Xếp loại
          const tdClass = doc.createElement('td');
          tdClass.setAttribute('title', 'XepLoai');
          tdClass.className = 'text-center';
          tdClass.textContent = c.classification || '';
          row.appendChild(tdClass);

          // Cột 27: Ghi chú
          const tdNote = doc.createElement('td');
          tdNote.setAttribute('title', 'GhiChu');
          tdNote.className = 'text-center';
          tdNote.textContent = '';
          row.appendChild(tdNote);

          // Cột 28: TBQT
          const tdTbqt = doc.createElement('td');
          tdTbqt.setAttribute('title', 'DiemTBQuaTrinh');
          tdTbqt.className = 'text-center';
          tdTbqt.textContent = '--';
          row.appendChild(tdTbqt);

          // Cột 29: Đạt
          const tdPass = doc.createElement('td');
          tdPass.setAttribute('title', 'Dat');
          tdPass.className = 'text-center';
          if (c.isPassed === true) {
            tdPass.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          } else if (c.isPassed === false) {
            tdPass.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
          }
          row.appendChild(tdPass);

          tbody.appendChild(row);
        });

        // 3. 5 Dòng Tổng kết chuẩn IUH cho học kỳ tương lai (PHASE 6A.5.3)
        const summary = fSem.summary || {};
        const cumSummary = fSem.cumulativeSimulatedGPA || {};

        const hasPartialData = summary.coursesCompletedCount > 0 && summary.coursesCompletedCount < summary.coursesTotalCount;
        const partialDataTooltip = hasPartialData ? 'Tính trên các môn đã có đủ giả định điểm. (Tổng TC kế hoạch: ' + (summary.totalPlannedCredits || 0) + ' | TC tính GPA: ' + (summary.gpaEligibleCredits || 0) + ')' : 'Dữ liệu mô phỏng cục bộ';

        const gpa10Val = (summary.gpa10Raw !== null && summary.gpa10Raw !== undefined) ? formatAverage4(summary.gpa10Raw) : '--';
        const gpa4Val = (summary.gpa4Raw !== null && summary.gpa4Raw !== undefined) ? formatAverage4(summary.gpa4Raw) : '--';

        const cumGpa10Val = (cumSummary.gpa10Raw !== null && cumSummary.gpa10Raw !== undefined) ? formatAverage4(cumSummary.gpa10Raw) : '--';
        const cumGpa4Val = (cumSummary.gpa4Raw !== null && cumSummary.gpa4Raw !== undefined) ? formatAverage4(cumSummary.gpa4Raw) : '--';

        const summaryRowsData = [
          {
            item1: { label: 'Điểm trung bình học kỳ hệ 10:', value: gpa10Val },
            item2: { label: 'Điểm trung bình học kỳ hệ 4:', value: gpa4Val },
          },
          {
            item1: { label: 'Điểm trung bình tích lũy dự kiến:', value: cumGpa10Val },
            item2: { label: 'Điểm trung bình tích lũy dự kiến (hệ 4):', value: cumGpa4Val },
          },
          {
            item1: { label: 'Tổng số tín chỉ kế hoạch:', value: (summary.totalPlannedCredits || 0).toString() },
            item2: { label: 'Tổng số tín chỉ tích lũy dự kiến:', value: (cumSummary.totalEligibleCredits || 0).toString() },
          },
          {
            item1: { label: 'Tổng số tín chỉ đạt dự kiến:', value: (summary.earnedCredits || 0).toString() },
            item2: { label: 'Tổng số tín chỉ chưa đạt dự kiến:', value: (summary.failedCredits || 0).toString() },
          },
          {
            item1: { label: 'Xếp loại học lực tích lũy dự kiến:', value: cumSummary.classification || '--' },
            item2: { label: 'Xếp loại học lực học kỳ dự kiến:', value: summary.classification || '--' },
          }
        ];

        summaryRowsData.forEach(pair => {
          const sumTr = doc.createElement('tr');
          sumTr.className = 'iuh-gpa-future-row iuh-gpa-semester-summary-row iuh-gpa-extension';
          sumTr.setAttribute('data-iuh-gpa-extension', 'true');

          const sumTd = doc.createElement('td');
          sumTd.colSpan = 29;
          sumTd.className = 'iuh-gpa-semester-summary-host';

          const stickyInner = doc.createElement('div');
          stickyInner.className = 'iuh-gpa-semester-summary-sticky';

          const pairDiv = doc.createElement('div');
          pairDiv.className = 'iuh-gpa-summary-pair';

          const it1 = doc.createElement('div');
          it1.className = 'iuh-gpa-summary-item';
          const lbl1 = doc.createElement('span');
          lbl1.className = 'iuh-gpa-summary-label';
          lbl1.textContent = pair.item1.label;
          const val1 = doc.createElement('span');
          val1.className = 'iuh-gpa-future-summary-value';
          val1.textContent = pair.item1.value;
          val1.title = partialDataTooltip;
          it1.appendChild(lbl1);
          it1.appendChild(val1);

          const it2 = doc.createElement('div');
          it2.className = 'iuh-gpa-summary-item';
          const lbl2 = doc.createElement('span');
          lbl2.className = 'iuh-gpa-summary-label';
          lbl2.textContent = pair.item2.label;
          const val2 = doc.createElement('span');
          val2.className = 'iuh-gpa-future-summary-value';
          val2.textContent = pair.item2.value;
          val2.title = partialDataTooltip;
          it2.appendChild(lbl2);
          it2.appendChild(val2);

          pairDiv.appendChild(it1);
          pairDiv.appendChild(it2);
          stickyInner.appendChild(pairDiv);
          sumTd.appendChild(stickyInner);
          sumTr.appendChild(sumTd);
          tbody.appendChild(sumTr);
        });
      });
    }

    // Luôn gắn hàng "+ Thêm học kỳ mới" ngay sau học kỳ cuối cùng (sau cả actual hoặc future semester)
    this._mountAddSemesterRow(this.table);
    this._recalibrateStickyColumns(this.table);
  }

  /**
   * Dọn dẹp toàn bộ giao diện và lifecycle của extension khi tiện ích bị tắt.
   * Khôi phục hoàn toàn bảng điểm IUH về trạng thái chính thức ban đầu.
   */
  destroy() {
    if (!this._initialized && !this.table && !this.companionBar) {
      return { success: true, alreadyDestroyed: true };
    }

    // 1. Huỷ request fetch CTK đang chạy (nếu có)
    if (this._ctkAbortController) {
      try {
        this._ctkAbortController.abort();
      } catch (e) {}
      this._ctkAbortController = null;
    }
    this._isSyncingCurriculum = false;

    // 2. Đóng và tiêu huỷ toàn bộ CourseSimulationPanel đang mở
    if (this.activePanels && this.activePanels.size > 0) {
      for (const panel of this.activePanels.values()) {
        try {
          if (panel && typeof panel.destroy === 'function') {
            panel.destroy();
          }
        } catch (e) {}
      }
      this.activePanels.clear();
    }

    // 3. Tiêu huỷ CompanionBar
    if (this.companionBar) {
      try {
        if (typeof this.companionBar.destroy === 'function') {
          this.companionBar.destroy();
        }
      } catch (e) {}
      this.companionBar = null;
    }

    // 4. Gỡ bỏ tất cả các modal, backdrop extension-owned
    if (this.doc) {
      const modal = this.doc.getElementById('iuh-gpa-future-planner-modal');
      if (modal) modal.remove();
      const backdrops = this.doc.querySelectorAll('.iuh-gpa-modal-backdrop, .iuh-gpa-modal');
      backdrops.forEach(b => b.remove());
    }

    // 5. Khôi phục bảng điểm IUH về trạng thái nguyên bản
    const table = this.table || (this.doc ? this.doc.querySelector('#xemDiem_aaa') : null);
    if (table) {
      // 5.1. Bỏ class mở rộng wrapper bảng điểm
      const tableWrapper = table.closest('.iuh-gpa-expanded-grade-table');
      if (tableWrapper) {
        tableWrapper.classList.remove('iuh-gpa-expanded-grade-table');
      }

      // 5.2. Gỡ bỏ toàn bộ hàng & cột do extension tạo
      const extElements = table.querySelectorAll('.iuh-gpa-extension, [data-iuh-gpa-extension="true"], .iuh-gpa-future-row, .iuh-gpa-future-semester-row, .iuh-gpa-add-semester-row, .iuh-gpa-semester-summary-row, th.iuh-gpa-col-select, th.iuh-gpa-col-type, td.iuh-gpa-col-select, td.iuh-gpa-col-type');
      extElements.forEach(el => el.remove());

      // 5.3. Khôi phục các hàng môn học
      const courseRows = table.querySelectorAll('tbody > tr[data-course-id]');
      courseRows.forEach(row => {
        row.removeAttribute('data-course-id');

        // Gỡ nút mô phỏng
        row.querySelectorAll('.iuh-gpa-trigger-btn').forEach(btn => btn.remove());

        // Bỏ class custom tên môn
        row.querySelectorAll('.iuh-gpa-col-course-name').forEach(td => td.classList.remove('iuh-gpa-col-course-name'));

        // Gỡ bỏ các phần tử mô phỏng
        row.querySelectorAll('.iuh-gpa-sim-val, .iuh-gpa-inline-input, .iuh-gpa-custom-type-badge, .iuh-gpa-btn-reset-type, .iuh-gpa-pass-sim-val').forEach(el => el.remove());

        // Khôi phục icon đạt/không đạt gốc
        row.querySelectorAll('td.isdat').forEach(td => {
          const origCheck = td.querySelector('.check') || td.firstElementChild;
          if (origCheck) origCheck.style.display = '';
        });

        // Mở lại wrapper điểm gốc & gỡ bỏ các attribute inline editor
        row.querySelectorAll('td').forEach(td => {
          td.classList.remove('iuh-gpa-editable-cell', 'is-simulated-cell', 'iuh-gpa-cell-invalid');
          td.removeAttribute('data-iuh-inline-init');
          td.removeAttribute('data-iuh-result-init');
          td.removeAttribute('tabindex');
          td.removeAttribute('role');
          td.removeAttribute('data-official-val');

          const origWrapper = td.querySelector('.iuh-gpa-orig-val');
          if (origWrapper) {
            origWrapper.style.display = '';
            while (origWrapper.firstChild) {
              td.insertBefore(origWrapper.firstChild, origWrapper);
            }
            origWrapper.remove();
          }
        });
      });

      // 5.4. Khôi phục hàng header học kỳ (td.row-head)
      const semCells = table.querySelectorAll('tbody td.row-head');
      semCells.forEach(cell => {
        cell.colSpan = 27;
        cell.style.removeProperty('padding');
        const stickyInner = cell.querySelector('.iuh-gpa-semester-sticky-content');
        if (stickyInner) {
          const labelSpan = stickyInner.querySelector('span');
          const text = labelSpan ? labelSpan.textContent.trim() : stickyInner.textContent.trim();
          cell.textContent = text;
        }
      });

      // 5.5. Khôi phục các hàng tổng kết học kỳ thực tế
      const summaryRows = table.querySelectorAll('tbody tr.iuh-gpa-actual-summary-row, tbody tr:has([lang^="kqht-tkhk-"])');
      summaryRows.forEach(row => {
        row.classList.remove('iuh-gpa-actual-summary-row');
        row.querySelectorAll('.iuh-gpa-summary-sim-val').forEach(s => s.remove());
        const cells = Array.from(row.querySelectorAll(':scope > td'));
        if (cells.length >= 2) {
          cells[0].classList.remove('iuh-gpa-actual-summary-cell-1');
          cells[0].colSpan = 2;
          cells[1].classList.remove('iuh-gpa-actual-summary-cell-2');
          cells[1].colSpan = 2;
        }
        if (cells.length >= 3) {
          cells[2].colSpan = 23;
        }
        row.querySelectorAll('[lang^="kqht-tkhk-"]').forEach(span => {
          const origValSpan = span.nextElementSibling;
          if (origValSpan) origValSpan.style.display = '';
        });
      });

      // 5.6. Khôi phục hàm freezeTable của IUH nếu đã ghi đè
      if (this._originalFreezeTable && this.doc?.defaultView) {
        this.doc.defaultView.freezeTable = this._originalFreezeTable;
        this._originalFreezeTable = null;
      }

      // Khôi phục style sticky của 4 cột chính thức IUH
      const theadFirstRow = table.querySelector('thead > tr:first-child');
      if (theadFirstRow && theadFirstRow.children.length >= 4) {
        const c = theadFirstRow.children;
        // 0: STT, 1: Mã LHP, 2: Tên môn, 3: Số TC
        c[0].classList.add('sticky-col');
        c[0].style.setProperty('position', 'sticky', 'important');
        c[0].style.setProperty('left', '0px', 'important');
        c[0].style.setProperty('width', '55px', 'important');

        c[1].classList.add('sticky-col');
        c[1].style.setProperty('position', 'sticky', 'important');
        c[1].style.setProperty('left', '55px', 'important');
        c[1].style.setProperty('width', '140px', 'important');

        c[2].classList.add('sticky-col');
        c[2].style.setProperty('position', 'sticky', 'important');
        c[2].style.setProperty('left', '195px', 'important');
        c[2].style.setProperty('width', '380px', 'important');

        c[3].classList.add('sticky-col');
        c[3].style.setProperty('position', 'sticky', 'important');
        c[3].style.setProperty('left', '575px', 'important');
        c[3].style.setProperty('width', '65px', 'important');
      }

      const bodyRows = table.querySelectorAll('tbody > tr');
      bodyRows.forEach(row => {
        if (row.children.length >= 4 && !row.querySelector('.row-head') && !row.querySelector('[lang^="kqht-tkhk-"]')) {
          const c = row.children;
          c[0].classList.add('sticky-col');
          c[0].style.setProperty('position', 'sticky', 'important');
          c[0].style.setProperty('left', '0px', 'important');
          c[0].style.setProperty('width', '55px', 'important');

          c[1].classList.add('sticky-col');
          c[1].style.setProperty('position', 'sticky', 'important');
          c[1].style.setProperty('left', '55px', 'important');
          c[1].style.setProperty('width', '140px', 'important');

          c[2].classList.add('sticky-col');
          c[2].style.setProperty('position', 'sticky', 'important');
          c[2].style.setProperty('left', '195px', 'important');
          c[2].style.setProperty('width', '380px', 'important');

          c[3].classList.add('sticky-col');
          c[3].style.setProperty('position', 'sticky', 'important');
          c[3].style.setProperty('left', '575px', 'important');
          c[3].style.setProperty('width', '65px', 'important');
        }
      });
    }

    // 6. Huỷ đăng ký State Listener và xoá State
    if (this._unsubscribe) {
      try { this._unsubscribe(); } catch (e) {}
      this._unsubscribe = null;
    }
    this.store = null;
    this.table = null;
    this._initialized = false;
    this._hasAttemptedCurriculumSync = false;
    this._isSyncingCurriculum = false;

    return { success: true };
  }
}

  AppController.createCourseTypeSelect = createCourseTypeSelect;
  AppController.getAutoCourseTypeLabel = getAutoCourseTypeLabel;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppController, createCourseTypeSelect, getAutoCourseTypeLabel };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.ui = root.ui || Object.create(null);
    root.ui.AppController = AppController;
    root.ui.createCourseTypeSelect = createCourseTypeSelect;
    root.ui.getAutoCourseTypeLabel = getAutoCourseTypeLabel;
    root.AppController = AppController;
    global._IUHAppController = { AppController, createCourseTypeSelect, getAutoCourseTypeLabel };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
