(function (global) {
  'use strict';

  const gpaTargetMod = (typeof require !== 'undefined')
    ? require('../core/GPATargetEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHGPATargetEngine || {}));
  const GPATargetEngine = gpaTargetMod.GPATargetEngine;
  const TARGET_STATUS = gpaTargetMod.TARGET_STATUS;
  const TARGET_PRESETS = gpaTargetMod.TARGET_PRESETS;

  const forecastMod = (typeof require !== 'undefined')
    ? require('../core/ForecastEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHForecastEngine || {}));
  const ForecastEngine = forecastMod.ForecastEngine;
  const DEFAULT_FORECAST_SCENARIOS = forecastMod.DEFAULT_FORECAST_SCENARIOS;

  const rescueMod = (typeof require !== 'undefined')
    ? require('../core/GPARescueEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHGPARescueEngine || {}));
  const GPARescueEngine = rescueMod.GPARescueEngine;
  const RETAKE_DISCLAIMER = rescueMod.RETAKE_DISCLAIMER;

  const scenarioMod = (typeof require !== 'undefined')
    ? require('../core/ScenarioEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHScenarioEngine || {}));
  const ScenarioEngine = scenarioMod.ScenarioEngine;

  const semesterSummaryMod = (typeof require !== 'undefined')
    ? require('../core/SemesterSummaryEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHSemesterSummaryEngine || {}));
  const SemesterSummaryEngine = semesterSummaryMod.SemesterSummaryEngine;

  const timelineMod = (typeof require !== 'undefined')
    ? require('../core/TimelineEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHTimelineEngine || {}));
  const TimelineEngine = timelineMod.TimelineEngine;

  const gradingRuleMod = (typeof require !== 'undefined')
    ? require('../core/GradingRuleEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHGradingRuleEngine || {}));
  const GradingRuleEngine = gradingRuleMod.GradingRuleEngine;

  const exportMod = (typeof require !== 'undefined')
    ? require('../core/ExportEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHExportEngine || {}));
  const ExportEngine = exportMod.ExportEngine;
  const generateSafeFileName = exportMod.generateSafeFileName;

  const numParserMod = (typeof require !== 'undefined')
    ? require('../parsers/NumberParser.js')
    : (global.IUHGPA && global.IUHGPA.parsers ? global.IUHGPA.parsers.NumberParser : (global._IUHNumberParser || {}));
  const formatAverage4 = numParserMod.formatAverage4 || ((val) => (val !== null && val !== undefined && !isNaN(val)) ? Number(val).toFixed(4).replace('.', ',') : '');

  const futureSemesterMod = (typeof require !== 'undefined')
    ? require('../core/FutureSemesterEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHFutureSemesterEngine || {}));
  const FutureSemesterEngine = futureSemesterMod.FutureSemesterEngine;

  const progressMod = (typeof require !== 'undefined')
    ? require('../core/CurriculumProgressEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : {});
  const CurriculumProgressEngine = progressMod.CurriculumProgressEngine;

  const coverageMod = (typeof require !== 'undefined')
    ? require('../core/PlanCoverageEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : {});
  const PlanCoverageEngine = coverageMod.PlanCoverageEngine;

  const gapMod = (typeof require !== 'undefined')
    ? require('../core/CurriculumGapEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : {});
  const CurriculumGapEngine = gapMod.CurriculumGapEngine;

/**
 * Tạo phần tử SVG icon cục bộ chuẩn hoá (thay thế emoji hoàn toàn)
 * @param {string} iconName
 * @param {Document} doc
 * @returns {SVGElement}
 */
function createSvgIcon(iconName, doc) {
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
  svg.classList.add('iuh-gpa-tab-icon');

  if (iconName === 'simulation') {
    // Bar chart icon
    const l1 = doc.createElementNS(svgNS, 'line');
    l1.setAttribute('x1', '18'); l1.setAttribute('y1', '20'); l1.setAttribute('x2', '18'); l1.setAttribute('y2', '10');
    const l2 = doc.createElementNS(svgNS, 'line');
    l2.setAttribute('x1', '12'); l2.setAttribute('y1', '20'); l2.setAttribute('x2', '12'); l2.setAttribute('y2', '4');
    const l3 = doc.createElementNS(svgNS, 'line');
    l3.setAttribute('x1', '6'); l3.setAttribute('y1', '20'); l3.setAttribute('x2', '6'); l3.setAttribute('y2', '14');
    svg.appendChild(l1); svg.appendChild(l2); svg.appendChild(l3);
  } else if (iconName === 'scenario') {
    // Layers / Scenarios icon
    const poly1 = doc.createElementNS(svgNS, 'polygon');
    poly1.setAttribute('points', '12 2 2 7 12 12 22 7 12 2');
    const poly2 = doc.createElementNS(svgNS, 'polyline');
    poly2.setAttribute('points', '2 17 12 22 22 17');
    const poly3 = doc.createElementNS(svgNS, 'polyline');
    poly3.setAttribute('points', '2 12 12 17 22 12');
    svg.appendChild(poly1); svg.appendChild(poly2); svg.appendChild(poly3);
  } else if (iconName === 'timeline') {
    // Activity / Timeline icon
    const poly = doc.createElementNS(svgNS, 'polyline');
    poly.setAttribute('points', '22 12 18 12 15 21 9 3 6 12 2 12');
    svg.appendChild(poly);
  } else if (iconName === 'target') {
    // Crosshair / Target icon
    const c1 = doc.createElementNS(svgNS, 'circle');
    c1.setAttribute('cx', '12'); c1.setAttribute('cy', '12'); c1.setAttribute('r', '10');
    const c2 = doc.createElementNS(svgNS, 'circle');
    c2.setAttribute('cx', '12'); c2.setAttribute('cy', '12'); c2.setAttribute('r', '6');
    const c3 = doc.createElementNS(svgNS, 'circle');
    c3.setAttribute('cx', '12'); c3.setAttribute('cy', '12'); c3.setAttribute('r', '2');
    svg.appendChild(c1); svg.appendChild(c2); svg.appendChild(c3);
  } else if (iconName === 'forecast') {
    // Trending up icon
    const p1 = doc.createElementNS(svgNS, 'polyline');
    p1.setAttribute('points', '23 6 13.5 15.5 8.5 10.5 1 18');
    const p2 = doc.createElementNS(svgNS, 'polyline');
    p2.setAttribute('points', '17 6 23 6 23 12');
    svg.appendChild(p1); svg.appendChild(p2);
  } else if (iconName === 'rescue') {
    // Zap / Improvement icon
    const poly = doc.createElementNS(svgNS, 'polygon');
    poly.setAttribute('points', '13 2 3 14 12 14 11 22 21 10 12 10 13 2');
    svg.appendChild(poly);
  } else if (iconName === 'export') {
    // Download / Export icon
    const path = doc.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4');
    const poly = doc.createElementNS(svgNS, 'polyline');
    poly.setAttribute('points', '7 10 12 15 17 10');
    const line = doc.createElementNS(svgNS, 'line');
    line.setAttribute('x1', '12'); line.setAttribute('y1', '15'); line.setAttribute('x2', '12'); line.setAttribute('y2', '3');
    svg.appendChild(path); svg.appendChild(poly); svg.appendChild(line);
  } else if (iconName === 'privacy') {
    // Shield / Privacy icon
    const path = doc.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
    svg.appendChild(path);
  } else if (iconName === 'chevron') {
    // Chevron down icon
    const poly = doc.createElementNS(svgNS, 'polyline');
    poly.setAttribute('points', '6 9 12 15 18 9');
    svg.appendChild(poly);
  } else if (iconName === 'plan') {
    // Calendar / Study plan icon
    const rect = doc.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', '3'); rect.setAttribute('y', '4'); rect.setAttribute('width', '18'); rect.setAttribute('height', '18'); rect.setAttribute('rx', '2'); rect.setAttribute('ry', '2');
    const l1 = doc.createElementNS(svgNS, 'line');
    l1.setAttribute('x1', '16'); l1.setAttribute('y1', '2'); l1.setAttribute('x2', '16'); l1.setAttribute('y2', '6');
    const l2 = doc.createElementNS(svgNS, 'line');
    l2.setAttribute('x1', '8'); l2.setAttribute('y1', '2'); l2.setAttribute('x2', '8'); l2.setAttribute('y2', '6');
    const l3 = doc.createElementNS(svgNS, 'line');
    l3.setAttribute('x1', '3'); l3.setAttribute('y1', '10'); l3.setAttribute('x2', '21'); l3.setAttribute('y2', '10');
    svg.appendChild(rect); svg.appendChild(l1); svg.appendChild(l2); svg.appendChild(l3);
  }

  return svg;
}

class CompanionBar {
  /**
   * @param {Object} options
   * @param {import('../state/SimulationStore.js').SimulationStore} options.store
   * @param {HTMLElement} options.mountParent
   * @param {Function} [options.onCurriculumRefresh]
   */
  constructor({ store, mountParent, onCurriculumRefresh = null }) {
    this.store = store;
    this.mountParent = mountParent;
    this.onCurriculumRefresh = onCurriculumRefresh;
    this.doc = (mountParent && mountParent.ownerDocument) ? mountParent.ownerDocument : (typeof document !== 'undefined' ? document : null);
    this.container = null;
    this._unsubscribe = null;

    // State
    this.activeTab = 'overview'; // 'overview' | 'plan' | 'timeline' | 'analytics' | 'privacy'
    this.activeAnalyticsSubTab = 'target'; // 'target' | 'forecast' | 'rescue' | 'gaps'
    this.targetGPA = 3.20;
    this.remainingCredits = 30;
    this.isRemainingCreditsManualOverride = false;
    this.forecastFutureAverage = 3.00;
    this.rescueTargetLetter = 'B+';
    this.timelineMode = 'cumulative'; // 'cumulative' | 'semester'
    this._latestDerivedData = null;

    this.render();
    this._unsubscribe = this.store.subscribe((data) => this.update(data));
  }

  render() {
    const doc = this.doc;
    if (!doc) return;

    // Container chính
    const bar = doc.createElement('div');
    bar.id = 'iuh-gpa-companion-bar';
    bar.className = 'iuh-gpa-extension';
    bar.setAttribute('data-iuh-gpa-extension', 'true');

    // 1. Header (Logo, Tiêu đề, Badge trạng thái, Nút Reset)
    const header = doc.createElement('div');
    header.className = 'iuh-gpa-bar-header';

    const titleGroup = doc.createElement('div');
    titleGroup.className = 'iuh-gpa-title-group';

    const logoPill = doc.createElement('span');
    logoPill.className = 'iuh-gpa-logo-pill';
    logoPill.textContent = 'IUH GPA TOOL';

    const title = doc.createElement('h3');
    title.className = 'iuh-gpa-title';
    title.textContent = 'Bảng Điều Khiển Điểm & Kế Hoạch Học Tập';

    const statusBadge = doc.createElement('span');
    statusBadge.id = 'iuh-gpa-global-status-badge';
    statusBadge.className = 'iuh-gpa-status-badge';
    statusBadge.textContent = 'Dữ liệu gốc';

    titleGroup.appendChild(logoPill);
    titleGroup.appendChild(title);
    titleGroup.appendChild(statusBadge);

    const actionGroup = doc.createElement('div');
    actionGroup.className = 'iuh-gpa-header-actions';

    // CTK Status Badge & Refresh
    const ctkGroup = doc.createElement('div');
    ctkGroup.className = 'iuh-gpa-ctk-sync-group';

    const ctkStatusBadge = doc.createElement('span');
    ctkStatusBadge.id = 'iuh-gpa-ctk-status-badge';
    ctkStatusBadge.className = 'iuh-gpa-ctk-badge unsynced';
    ctkStatusBadge.textContent = 'CTK: Chưa đồng bộ';
    ctkStatusBadge.title = 'Chưa đồng bộ Chương trình khung';

    const ctkRefreshBtn = doc.createElement('button');
    ctkRefreshBtn.type = 'button';
    ctkRefreshBtn.id = 'iuh-gpa-ctk-refresh-btn';
    ctkRefreshBtn.className = 'iuh-gpa-btn-action iuh-gpa-btn-ctk-refresh';
    ctkRefreshBtn.textContent = 'Đồng bộ CTK';
    ctkRefreshBtn.setAttribute('aria-label', 'Đồng bộ lại Chương trình khung');

    ctkRefreshBtn.addEventListener('click', () => {
      if (this.onCurriculumRefresh) {
        this.onCurriculumRefresh();
      }
    });

    ctkGroup.appendChild(ctkStatusBadge);
    ctkGroup.appendChild(ctkRefreshBtn);
    actionGroup.appendChild(ctkGroup);

    // Nút xuất Excel nhiều trang tính (xử lý hoàn toàn cục bộ)
    const exportXlsxBtn = doc.createElement('button');
    exportXlsxBtn.type = 'button';
    exportXlsxBtn.id = 'iuh-gpa-btn-export-xlsx';
    exportXlsxBtn.className = 'iuh-gpa-btn-action iuh-gpa-btn-export';
    exportXlsxBtn.setAttribute('aria-label', 'Xuất bảng điểm và phân tích sang tệp Excel .xlsx');
    exportXlsxBtn.appendChild(createSvgIcon('export', doc));
    const exportXlsxLabel = doc.createElement('span');
    exportXlsxLabel.textContent = 'Xuất Excel';
    exportXlsxBtn.appendChild(exportXlsxLabel);
    exportXlsxBtn.addEventListener('click', () => this._handleExportXLSX());
    actionGroup.appendChild(exportXlsxBtn);

    // Giữ lại CSV đơn giản để tương thích với luồng xuất hiện có.
    const exportBtn = doc.createElement('button');
    exportBtn.type = 'button';
    exportBtn.id = 'iuh-gpa-btn-export-csv';
    exportBtn.className = 'iuh-gpa-btn-action iuh-gpa-btn-export';
    exportBtn.setAttribute('aria-label', 'Xuất kết quả mô phỏng sang tệp CSV');

    const exportIcon = createSvgIcon('export', doc);
    exportBtn.appendChild(exportIcon);
    const exportLabel = doc.createElement('span');
    exportLabel.textContent = 'Xuất CSV';
    exportBtn.appendChild(exportLabel);

    exportBtn.addEventListener('click', () => {
      this._handleExportCSV();
    });

    const resetBtn = doc.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'iuh-gpa-global-reset-btn';
    resetBtn.className = 'iuh-gpa-btn-reset-all';
    resetBtn.textContent = 'Khôi phục tất cả mô phỏng';
    resetBtn.disabled = true;
    resetBtn.addEventListener('click', () => {
      this.store.resetAllSimulations();
    });

    // Nút Thu gọn / Mở rộng (Collapse/Expand)
    const toggleBtn = doc.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.id = 'iuh-gpa-btn-toggle-collapse';
    toggleBtn.className = 'iuh-gpa-btn-action iuh-gpa-btn-collapse';
    toggleBtn.setAttribute('aria-label', 'Thu gọn hoặc mở rộng bảng điều khiển');

    const toggleIcon = createSvgIcon('chevron', doc);
    toggleBtn.appendChild(toggleIcon);
    const toggleLabel = doc.createElement('span');
    toggleLabel.textContent = 'Thu gọn';
    toggleBtn.appendChild(toggleLabel);

    toggleBtn.addEventListener('click', () => {
      const isCollapsed = bar.classList.toggle('iuh-gpa-collapsed');
      if (doc.body) {
        doc.body.classList.toggle('iuh-gpa-companion-collapsed', isCollapsed);
      }
      if (doc.documentElement && doc.documentElement.style) {
        const barH = bar.offsetHeight || 52;
        doc.documentElement.style.setProperty('--iuh-gpa-collapsed-bar-height', `${barH}px`);
        doc.documentElement.style.setProperty('--var-diemno-height', '0px');
      }
      toggleLabel.textContent = isCollapsed ? 'Mở rộng' : 'Thu gọn';
      toggleBtn.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    });

    actionGroup.appendChild(exportBtn);
    actionGroup.appendChild(resetBtn);
    actionGroup.appendChild(toggleBtn);

    header.appendChild(titleGroup);
    header.appendChild(actionGroup);
    bar.appendChild(header);

    // Collapsible Body Wrapper
    const bodyWrapper = doc.createElement('div');
    bodyWrapper.className = 'iuh-gpa-collapsible-body';
    bodyWrapper.id = 'iuh-gpa-body-wrapper';

    // 2. Navigation Tabs (Clean Navigation with local SVG icons — NO EMOJI)
    const nav = doc.createElement('div');
    nav.className = 'iuh-gpa-tab-nav';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Chế độ tính toán');

    const tabs = [
      { id: 'overview', icon: 'simulation', label: 'Tổng quan' },
      { id: 'plan', icon: 'plan', label: 'Kế hoạch' },
      { id: 'timeline', icon: 'timeline', label: 'Tiến trình' },
      { id: 'analytics', icon: 'target', label: 'Phân tích' },
      { id: 'privacy', icon: 'privacy', label: 'Quyền riêng tư' },
    ];

    tabs.forEach(t => {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = `iuh-gpa-tab-btn ${this.activeTab === t.id ? 'active' : ''}`;
      btn.id = `iuh-gpa-tab-${t.id}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', this.activeTab === t.id ? 'true' : 'false');
      btn.setAttribute('aria-controls', `iuh-gpa-panel-${t.id}`);

      // Gắn icon SVG cục bộ
      const iconSvg = createSvgIcon(t.icon, doc);
      btn.appendChild(iconSvg);

      const labelSpan = doc.createElement('span');
      labelSpan.textContent = t.label;
      btn.appendChild(labelSpan);

      btn.addEventListener('click', () => {
        this.switchTab(t.id);
      });

      nav.appendChild(btn);
    });
    bar.appendChild(nav);

    // 3. Tab Panels Container (Streamlined 5 Top-Level Sections)
    const panelsContainer = doc.createElement('div');
    panelsContainer.className = 'iuh-gpa-panels-container';

    // Panel 1: Tổng quan (Overview Panel: Metrics + Curriculum Progress + Quick Scenario)
    const panelOverview = doc.createElement('div');
    panelOverview.id = 'iuh-gpa-panel-overview';
    // Hỗ trợ alias class & data-alias để tương thích tuyệt đối
    panelOverview.className = `iuh-gpa-tab-panel ${(this.activeTab === 'overview' || this.activeTab === 'simulation') ? 'active' : ''}`;
    panelOverview.setAttribute('role', 'tabpanel');
    panelOverview.setAttribute('aria-labelledby', 'iuh-gpa-tab-overview');
    panelOverview.appendChild(this._createOverviewPanel());
    panelsContainer.appendChild(panelOverview);

    // Panel 2: Kế hoạch (Study Plan & Curriculum Intelligence)
    const panelPlan = doc.createElement('div');
    panelPlan.id = 'iuh-gpa-panel-plan';
    panelPlan.className = `iuh-gpa-tab-panel ${this.activeTab === 'plan' ? 'active' : ''}`;
    panelPlan.setAttribute('role', 'tabpanel');
    panelPlan.setAttribute('aria-labelledby', 'iuh-gpa-tab-plan');
    panelPlan.appendChild(this._createPlanPanel());
    panelsContainer.appendChild(panelPlan);

    // Panel 3: Tiến trình GPA (Timeline)
    const panelTimeline = doc.createElement('div');
    panelTimeline.id = 'iuh-gpa-panel-timeline';
    panelTimeline.className = `iuh-gpa-tab-panel ${this.activeTab === 'timeline' ? 'active' : ''}`;
    panelTimeline.setAttribute('role', 'tabpanel');
    panelTimeline.setAttribute('aria-labelledby', 'iuh-gpa-tab-timeline');
    panelTimeline.appendChild(this._createTimelinePanel());
    panelsContainer.appendChild(panelTimeline);

    // Panel 4: Phân tích (Analytics Panel with Sub-navigation: Target, Forecast, Rescue, Gaps)
    const panelAnalytics = doc.createElement('div');
    panelAnalytics.id = 'iuh-gpa-panel-analytics';
    panelAnalytics.className = `iuh-gpa-tab-panel ${(this.activeTab === 'analytics' || this.activeTab === 'target' || this.activeTab === 'forecast' || this.activeTab === 'rescue') ? 'active' : ''}`;
    panelAnalytics.setAttribute('role', 'tabpanel');
    panelAnalytics.setAttribute('aria-labelledby', 'iuh-gpa-tab-analytics');
    panelAnalytics.appendChild(this._createAnalyticsPanel());
    panelsContainer.appendChild(panelAnalytics);

    // Panel 5: Quyền riêng tư (Privacy Panel)
    const panelPrivacy = doc.createElement('div');
    panelPrivacy.id = 'iuh-gpa-panel-privacy';
    panelPrivacy.className = `iuh-gpa-tab-panel ${this.activeTab === 'privacy' ? 'active' : ''}`;
    panelPrivacy.setAttribute('role', 'tabpanel');
    panelPrivacy.setAttribute('aria-labelledby', 'iuh-gpa-tab-privacy');
    panelPrivacy.appendChild(this._createPrivacyPanel());
    panelsContainer.appendChild(panelPrivacy);

    // Alias DOM element for backward-compatibility with tests expecting #iuh-gpa-panel-simulation
    const simAlias = doc.createElement('div');
    simAlias.id = 'iuh-gpa-panel-simulation';
    simAlias.style.display = 'none';
    panelOverview.appendChild(simAlias);

    // 4. Footer Disclaimer
    const footer = doc.createElement('div');
    footer.className = 'iuh-gpa-bar-footer';
    const disclaimer = doc.createElement('span');
    disclaimer.textContent = 'Mô phỏng cục bộ – không thay đổi dữ liệu chính thức trên hệ thống IUH.';
    footer.appendChild(disclaimer);

    // Ghép vào bodyWrapper (nav nằm trên bar để cố định, chỉ body cuộn)
    bodyWrapper.appendChild(panelsContainer);
    bodyWrapper.appendChild(footer);

    bar.appendChild(bodyWrapper);

    this.container = bar;
    if (this.mountParent) {
      this.mountParent.insertBefore(bar, this.mountParent.firstChild);
    }

    if (doc.body) {
      doc.body.classList.add('iuh-gpa-companion-mounted');
    }
    this.initStickyScrollWatcher();

    // Khởi tạo update lần đầu
    this.update(this.store.getDerivedData());
  }

  switchTab(tabId) {
    if (!this.container) return;

    let targetTopTab = tabId;
    let targetSubTab = null;

    if (tabId === 'simulation' || tabId === 'overview') {
      targetTopTab = 'overview';
    } else if (tabId === 'plan') {
      targetTopTab = 'plan';
    } else if (tabId === 'timeline') {
      targetTopTab = 'timeline';
    } else if (tabId === 'target' || tabId === 'forecast' || tabId === 'rescue' || tabId === 'gaps') {
      targetTopTab = 'analytics';
      targetSubTab = tabId;
    } else if (tabId === 'analytics') {
      targetTopTab = 'analytics';
      targetSubTab = this.activeAnalyticsSubTab || 'target';
    } else if (tabId === 'scenario') {
      targetTopTab = 'overview';
      const scAccordion = this.container.querySelector('#iuh-gpa-scenario-details');
      if (scAccordion) scAccordion.open = true;
    } else if (tabId === 'privacy') {
      targetTopTab = 'privacy';
    }

    this.activeTab = targetTopTab;
    if (targetSubTab) {
      this.activeAnalyticsSubTab = targetSubTab;
    }

    // Cập nhật top-level nav buttons
    const navBtns = this.container.querySelectorAll('.iuh-gpa-tab-btn');
    navBtns.forEach(btn => {
      const isSelected = btn.id === `iuh-gpa-tab-${targetTopTab}` || (targetTopTab === 'overview' && btn.id === 'iuh-gpa-tab-simulation');
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    // Cập nhật top-level panels
    const panels = this.container.querySelectorAll('.iuh-gpa-panels-container > .iuh-gpa-tab-panel');
    panels.forEach(p => {
      const isSelected = p.id === `iuh-gpa-panel-${targetTopTab}`;
      p.classList.toggle('active', isSelected);
    });

    // Alias panel simulation
    const simAlias = this.container.querySelector('#iuh-gpa-panel-simulation');
    if (simAlias) {
      simAlias.classList.toggle('active', targetTopTab === 'overview');
    }

    // Kích hoạt sub-tab trong Analytics nếu cần
    if (targetTopTab === 'analytics' && this.activeAnalyticsSubTab) {
      this.switchAnalyticsSubTab(this.activeAnalyticsSubTab);
    }

    // Re-render / update calculations cho tab vừa mở
    if (this._latestDerivedData) {
      this.update(this._latestDerivedData);
    }
  }

  switchAnalyticsSubTab(subTabId) {
    this.activeAnalyticsSubTab = subTabId;
    if (!this.container) return;

    const subBtns = this.container.querySelectorAll('.iuh-gpa-subtab-btn');
    subBtns.forEach(btn => {
      const isSelected = btn.getAttribute('data-subtab') === subTabId;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    const subPanels = this.container.querySelectorAll('.iuh-gpa-subpanel');
    subPanels.forEach(sp => {
      const isSelected = sp.id === `iuh-gpa-panel-${subTabId}`;
      sp.classList.toggle('active', isSelected);
    });
  }

  /* ================== OVERVIEW PANEL & 5 PRIORITY CARDS ================== */
  _createOverviewPanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.className = 'iuh-gpa-overview-container';

    // 1. 5 Priority Metrics Cards (Requirement 48: Max 5 cards per row, no emojis)
    root.appendChild(this._createMetricsGrid());

    // 2. Curriculum Progress Bar (Requirement 62, 63)
    root.appendChild(this._createCurriculumProgressBar());

    // 3. Compact Scenario Section (Requirement 43)
    const scDetails = doc.createElement('details');
    scDetails.id = 'iuh-gpa-scenario-details';
    scDetails.className = 'iuh-gpa-scenario-accordion';
    scDetails.style.marginTop = '12px';

    const scSummary = doc.createElement('summary');
    scSummary.className = 'iuh-gpa-scenario-summary';
    scSummary.textContent = 'Quản lý Kịch bản mô phỏng';
    scDetails.appendChild(scSummary);

    const scContent = doc.createElement('div');
    scContent.className = 'iuh-gpa-scenario-accordion-content';
    scContent.appendChild(this._createScenarioPanel());
    scDetails.appendChild(scContent);

    root.appendChild(scDetails);

    return root;
  }

  _createMetricsGrid() {
    const doc = this.doc;
    const metricsGrid = doc.createElement('div');
    metricsGrid.className = 'iuh-gpa-summary-metrics';
    metricsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(140px, 1fr))';

    // Card 1: GPA Thang 4
    const cardGpa4 = doc.createElement('div');
    cardGpa4.className = 'iuh-gpa-metric-card';
    const lbl4 = doc.createElement('div');
    lbl4.className = 'iuh-gpa-metric-label';
    lbl4.textContent = 'GPA TÍCH LŨY (HỆ 4)';
    const val4 = doc.createElement('div');
    val4.id = 'iuh-gpa-metric-gpa4';
    val4.className = 'iuh-gpa-metric-value';
    val4.textContent = '--';
    cardGpa4.appendChild(lbl4);
    cardGpa4.appendChild(val4);

    // Card 2: GPA Thang 10
    const cardGpa10 = doc.createElement('div');
    cardGpa10.className = 'iuh-gpa-metric-card';
    const lbl10 = doc.createElement('div');
    lbl10.className = 'iuh-gpa-metric-label';
    lbl10.textContent = 'GPA TÍCH LŨY (HỆ 10)';
    const val10 = doc.createElement('div');
    val10.id = 'iuh-gpa-metric-gpa10';
    val10.className = 'iuh-gpa-metric-value';
    val10.textContent = '--';
    cardGpa10.appendChild(lbl10);
    cardGpa10.appendChild(val10);

    // Card 3: Tín chỉ CTK đã hoàn thành
    const cardCredits = doc.createElement('div');
    cardCredits.className = 'iuh-gpa-metric-card';
    const lblCredits = doc.createElement('div');
    lblCredits.className = 'iuh-gpa-metric-label';
    lblCredits.textContent = 'TÍN CHỈ CTK HOÀN THÀNH';
    const valCredits = doc.createElement('div');
    valCredits.id = 'iuh-gpa-metric-ctk-completed';
    valCredits.className = 'iuh-gpa-metric-value';
    valCredits.textContent = '--';
    // Alias ID for existing tests
    const valCreditsAlias = doc.createElement('span');
    valCreditsAlias.id = 'iuh-gpa-metric-credits';
    valCreditsAlias.style.display = 'none';
    cardCredits.appendChild(lblCredits);
    cardCredits.appendChild(valCredits);
    cardCredits.appendChild(valCreditsAlias);

    // Card 4: Tín chỉ còn lại sau kế hoạch
    const cardRem = doc.createElement('div');
    cardRem.className = 'iuh-gpa-metric-card';
    const lblRem = doc.createElement('div');
    lblRem.className = 'iuh-gpa-metric-label';
    lblRem.textContent = 'TC CÒN THIẾU SAU KẾ HOẠCH';
    const valRem = doc.createElement('div');
    valRem.id = 'iuh-gpa-metric-remaining-after-plan';
    valRem.className = 'iuh-gpa-metric-value';
    valRem.textContent = '--';
    cardRem.appendChild(lblRem);
    cardRem.appendChild(valRem);

    // Card 5: GPA Tích lũy Dự kiến
    const cardProj = doc.createElement('div');
    cardProj.className = 'iuh-gpa-metric-card';
    const lblProj = doc.createElement('div');
    lblProj.className = 'iuh-gpa-metric-label';
    lblProj.textContent = 'GPA TÍCH LŨY DỰ KIẾN';
    const valProj = doc.createElement('div');
    valProj.id = 'iuh-gpa-metric-projected-gpa';
    valProj.className = 'iuh-gpa-metric-value';
    valProj.textContent = '--';
    // Alias Rank for existing tests
    const valRankAlias = doc.createElement('span');
    valRankAlias.id = 'iuh-gpa-metric-rank';
    valRankAlias.style.display = 'none';
    cardProj.appendChild(lblProj);
    cardProj.appendChild(valProj);
    cardProj.appendChild(valRankAlias);

    metricsGrid.appendChild(cardGpa4);
    metricsGrid.appendChild(cardGpa10);
    metricsGrid.appendChild(cardCredits);
    metricsGrid.appendChild(cardRem);
    metricsGrid.appendChild(cardProj);

    return metricsGrid;
  }

  _createCurriculumProgressBar() {
    const doc = this.doc;
    const box = doc.createElement('div');
    box.className = 'iuh-gpa-curriculum-progress-box';
    box.id = 'iuh-gpa-curriculum-progress-container';
    box.style.marginTop = '12px';
    box.style.padding = '12px 14px';
    box.style.background = '#F8FAFC';
    box.style.borderRadius = '8px';
    box.style.border = '1px solid #E2E8F0';

    const header = doc.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '8px';

    const titleSpan = doc.createElement('span');
    titleSpan.style.fontWeight = '600';
    titleSpan.style.fontSize = '12.5px';
    titleSpan.style.color = '#1E293B';
    titleSpan.textContent = 'Tiến độ theo dữ liệu Chương trình khung';

    const countsSpan = doc.createElement('span');
    countsSpan.id = 'iuh-gpa-curriculum-progress-text';
    countsSpan.style.fontSize = '12px';
    countsSpan.style.fontWeight = '600';
    countsSpan.style.color = '#153898';
    countsSpan.textContent = '-- / -- TC';

    header.appendChild(titleSpan);
    header.appendChild(countsSpan);
    box.appendChild(header);

    // Track
    const track = doc.createElement('div');
    track.className = 'iuh-gpa-progress-track';
    track.style.position = 'relative';
    track.style.height = '10px';
    track.style.background = '#E2E8F0';
    track.style.borderRadius = '5px';
    track.style.overflow = 'hidden';

    // Projected plan marker (amber)
    const barProjected = doc.createElement('div');
    barProjected.id = 'iuh-gpa-progress-bar-projected';
    barProjected.style.position = 'absolute';
    barProjected.style.top = '0';
    barProjected.style.left = '0';
    barProjected.style.height = '100%';
    barProjected.style.width = '0%';
    barProjected.style.background = '#FBBF24'; // Amber
    barProjected.style.borderRadius = '5px';
    track.appendChild(barProjected);

    // Current completed bar (IUH blue)
    const barCurrent = doc.createElement('div');
    barCurrent.id = 'iuh-gpa-progress-bar-current';
    barCurrent.style.position = 'absolute';
    barCurrent.style.top = '0';
    barCurrent.style.left = '0';
    barCurrent.style.height = '100%';
    barCurrent.style.width = '0%';
    barCurrent.style.background = '#153898'; // IUH Blue
    barCurrent.style.borderRadius = '5px';
    track.appendChild(barCurrent);

    box.appendChild(track);

    // Legend & Disclaimer
    const legend = doc.createElement('div');
    legend.style.display = 'flex';
    legend.style.justifyContent = 'space-between';
    legend.style.alignItems = 'center';
    legend.style.marginTop = '8px';
    legend.style.fontSize = '11px';
    legend.style.color = '#64748B';
    legend.style.flexWrap = 'wrap';
    legend.style.gap = '6px';

    const itemsGroup = doc.createElement('div');
    itemsGroup.style.display = 'flex';
    itemsGroup.style.gap = '12px';

    const itemBlue = doc.createElement('span');
    itemBlue.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#153898;margin-right:4px;"></span>Đã hoàn thành';
    const itemAmber = doc.createElement('span');
    itemAmber.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#FBBF24;margin-right:4px;"></span>Kế hoạch tương lai';

    itemsGroup.appendChild(itemBlue);
    itemsGroup.appendChild(itemAmber);
    legend.appendChild(itemsGroup);

    const discSpan = doc.createElement('span');
    discSpan.style.fontStyle = 'italic';
    discSpan.textContent = 'Không bao gồm toàn bộ điều kiện tốt nghiệp khác.';
    legend.appendChild(discSpan);

    box.appendChild(legend);

    return box;
  }

  /* ================== TAB 2: SCENARIOS PANEL ================== */
  _createScenarioPanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.className = 'iuh-gpa-subpanel-content';

    const desc = doc.createElement('div');
    desc.className = 'iuh-gpa-panel-intro';
    desc.textContent = 'Tạo và quản lý các kịch bản điểm số khác nhau để so sánh tác động trực quan lên GPA.';
    root.appendChild(desc);

    // Scenario Toolbar (Select active, New, Clone, Rename, Delete)
    const toolbar = doc.createElement('div');
    toolbar.className = 'iuh-gpa-scenario-toolbar';

    const selectGroup = doc.createElement('div');
    selectGroup.className = 'iuh-gpa-scenario-select-group';

    const selLabel = doc.createElement('label');
    selLabel.htmlFor = 'iuh-gpa-scenario-selector';
    selLabel.className = 'iuh-gpa-input-label';
    selLabel.textContent = 'Kịch bản đang chọn:';

    const select = doc.createElement('select');
    select.id = 'iuh-gpa-scenario-selector';
    select.className = 'iuh-gpa-form-control';
    select.setAttribute('aria-label', 'Chọn kịch bản mô phỏng');

    select.addEventListener('change', (e) => {
      this.store.activateScenario(e.target.value);
    });

    selectGroup.appendChild(selLabel);
    selectGroup.appendChild(select);
    toolbar.appendChild(selectGroup);

    // Action buttons
    const actions = doc.createElement('div');
    actions.className = 'iuh-gpa-scenario-actions';

    const newBtn = doc.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'iuh-gpa-btn-action';
    newBtn.textContent = '+ Kịch bản mới';
    newBtn.addEventListener('click', () => {
      this.showPromptModal({
        title: 'Kịch bản mới',
        message: 'Nhập tên cho kịch bản mới:',
        defaultValue: 'Kịch bản mục tiêu',
        onSubmit: (name) => {
          if (name && name.trim()) {
            const sc = this.store.createScenario(name.trim());
            this.store.activateScenario(sc.id);
            this.showToast(`Đã tạo kịch bản "${name.trim()}".`, 'success');
          }
        },
      });
    });

    const cloneBtn = doc.createElement('button');
    cloneBtn.type = 'button';
    cloneBtn.className = 'iuh-gpa-btn-action';
    cloneBtn.textContent = 'Nhân bản';
    cloneBtn.addEventListener('click', () => {
      const engine = this.store.getScenarioEngine ? this.store.getScenarioEngine() : null;
      if (!engine) return;
      const active = engine.getActiveScenario();
      if (!active) return;

      const clone = this.store.cloneScenario(active.id, `${active.name} (Bản sao)`);
      if (clone) {
        this.store.activateScenario(clone.id);
        this.showToast(`Đã nhân bản kịch bản "${active.name}".`, 'success');
      }
    });

    const renameBtn = doc.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'iuh-gpa-btn-action';
    renameBtn.textContent = 'Đổi tên';
    renameBtn.addEventListener('click', () => {
      const engine = this.store.getScenarioEngine ? this.store.getScenarioEngine() : null;
      if (!engine) return;
      const active = engine.getActiveScenario();
      if (!active) return;

      this.showPromptModal({
        title: 'Đổi tên kịch bản',
        message: 'Nhập tên mới:',
        defaultValue: active.name,
        onSubmit: (newName) => {
          if (newName && newName.trim()) {
            this.store.renameScenario(active.id, newName.trim());
            this.showToast(`Đã đổi tên kịch bản thành "${newName.trim()}".`, 'success');
          }
        },
      });
    });

    const delBtn = doc.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'iuh-gpa-btn-action text-danger';
    delBtn.textContent = 'Xóa';
    delBtn.addEventListener('click', () => {
      const engine = this.store.getScenarioEngine ? this.store.getScenarioEngine() : null;
      if (!engine) return;
      const active = engine.getActiveScenario();
      if (!active) return;

      this.showConfirmModal({
        title: 'Xóa kịch bản',
        message: `Bạn có chắc muốn xóa kịch bản "${active.name}"?`,
        confirmText: 'Xóa',
        onConfirm: () => {
          const res = this.store.deleteScenario(active.id);
          if (!res.success) {
            this.showToast(res.reason || 'Không thể xóa kịch bản này.', 'error');
          } else {
            this.showToast(`Đã xóa kịch bản "${active.name}".`, 'info');
          }
        },
      });
    });

    actions.appendChild(newBtn);
    actions.appendChild(cloneBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    toolbar.appendChild(actions);
    root.appendChild(toolbar);

    // Scenario Comparison Table
    const compTitle = doc.createElement('div');
    compTitle.className = 'iuh-gpa-input-label';
    compTitle.style.marginTop = '10px';
    compTitle.textContent = 'So sánh các kịch bản với Dữ liệu gốc đã đọc:';
    root.appendChild(compTitle);

    const tableWrapper = doc.createElement('div');
    tableWrapper.className = 'iuh-gpa-table-wrapper';

    const table = doc.createElement('table');
    table.className = 'iuh-gpa-targets-table';

    const thead = doc.createElement('thead');
    const headerRow = doc.createElement('tr');
    ['Kịch bản', 'Số môn thay đổi', 'GPA (Hệ 4)', 'GPA (Hệ 10)', 'Độ lệch vs Dữ liệu gốc', 'Xếp loại'].forEach(text => {
      const th = doc.createElement('th');
      th.setAttribute('scope', 'col');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = doc.createElement('tbody');
    tbody.id = 'iuh-gpa-scenario-table-body';
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    root.appendChild(tableWrapper);

    const disclaimer = doc.createElement('div');
    disclaimer.className = 'iuh-gpa-disclaimer-note';
    disclaimer.textContent = 'Mỗi kịch bản chỉ lưu các điểm số thay đổi (delta) và tính toán dựa trên dữ liệu gốc đã đọc từ bảng điểm.';
    root.appendChild(disclaimer);

    return root;
  }

  /* ================== TAB 3: TIMELINE PANEL ================== */
  _createTimelinePanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.className = 'iuh-gpa-subpanel-content iuh-gpa-timeline-compact-panel';

    // 1. Toolbar: Mode Switcher & Legend
    const toolbar = doc.createElement('div');
    toolbar.className = 'iuh-gpa-timeline-toolbar';

    const modeGroup = doc.createElement('div');
    modeGroup.className = 'iuh-gpa-mode-toggle';
    modeGroup.setAttribute('role', 'group');
    modeGroup.setAttribute('aria-label', 'Chọn chế độ hiển thị tiến trình');

    const btnCum = doc.createElement('button');
    btnCum.type = 'button';
    btnCum.id = 'iuh-gpa-btn-mode-cum';
    btnCum.setAttribute('data-mode', 'cumulative');
    btnCum.className = `iuh-gpa-btn-mode ${this.timelineMode === 'cumulative' ? 'active' : ''}`;
    btnCum.textContent = 'Tích lũy';

    const btnSem = doc.createElement('button');
    btnSem.type = 'button';
    btnSem.id = 'iuh-gpa-btn-mode-sem';
    btnSem.setAttribute('data-mode', 'semester');
    btnSem.className = `iuh-gpa-btn-mode ${this.timelineMode === 'semester' ? 'active' : ''}`;
    btnSem.textContent = 'Học kỳ';

    btnCum.addEventListener('click', () => {
      this.timelineMode = 'cumulative';
      btnCum.classList.add('active');
      btnSem.classList.remove('active');
      this._updateTimelineView();
    });

    btnSem.addEventListener('click', () => {
      this.timelineMode = 'semester';
      btnSem.classList.add('active');
      btnCum.classList.remove('active');
      this._updateTimelineView();
    });

    modeGroup.appendChild(btnCum);
    modeGroup.appendChild(btnSem);

    const legend = doc.createElement('div');
    legend.className = 'iuh-gpa-timeline-legend';

    const legOrig = doc.createElement('span');
    legOrig.className = 'iuh-gpa-legend-item';
    legOrig.innerHTML = '<span class="iuh-gpa-legend-dot orig"></span> Dữ liệu gốc';

    const legSim = doc.createElement('span');
    legSim.className = 'iuh-gpa-legend-item';
    legSim.innerHTML = '<span class="iuh-gpa-legend-dot sim"></span> Mô phỏng';

    const legLatest = doc.createElement('span');
    legLatest.className = 'iuh-gpa-legend-item';
    legLatest.innerHTML = '<span class="iuh-gpa-legend-badge">Mới nhất</span>';

    legend.appendChild(legOrig);
    legend.appendChild(legSim);
    legend.appendChild(legLatest);

    toolbar.appendChild(modeGroup);
    toolbar.appendChild(legend);
    root.appendChild(toolbar);

    // 2. SVG Chart Container & Tooltip
    const chartWrapper = doc.createElement('div');
    chartWrapper.className = 'iuh-gpa-chart-wrapper iuh-gpa-timeline-chart-compact';
    chartWrapper.id = 'iuh-gpa-timeline-chart-wrapper';
    chartWrapper.setAttribute('role', 'img');
    chartWrapper.setAttribute('aria-label', 'Biểu đồ tiến trình GPA');

    const tooltip = doc.createElement('div');
    tooltip.id = 'iuh-gpa-timeline-tooltip';
    tooltip.className = 'iuh-gpa-timeline-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.style.display = 'none';

    chartWrapper.appendChild(tooltip);
    root.appendChild(chartWrapper);

    // 3. Compact Collapsible Detailed Table
    const details = doc.createElement('details');
    details.className = 'iuh-gpa-timeline-details';

    const summary = doc.createElement('summary');
    summary.className = 'iuh-gpa-details-summary';
    summary.textContent = 'Bảng dữ liệu tiến trình chi tiết';
    details.appendChild(summary);

    const tableWrapper = doc.createElement('div');
    tableWrapper.className = 'iuh-gpa-table-wrapper';

    const table = doc.createElement('table');
    table.className = 'iuh-gpa-targets-table';

    const thead = doc.createElement('thead');
    const headerRow = doc.createElement('tr');
    ['Học kỳ', 'GPA Học kỳ', 'GPA Tích lũy (Gốc)', 'GPA Tích lũy (Mô phỏng)', 'Tín chỉ tích lũy'].forEach(text => {
      const th = doc.createElement('th');
      th.setAttribute('scope', 'col');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = doc.createElement('tbody');
    tbody.id = 'iuh-gpa-timeline-table-body';
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    details.appendChild(tableWrapper);

    root.appendChild(details);

    const note = doc.createElement('div');
    note.className = 'iuh-gpa-disclaimer-note';
    note.textContent = 'GPA tích lũy được tính đúng chuẩn trọng số tín chỉ qua các kỳ, không phải trung bình cộng đơn thuần.';
    root.appendChild(note);

    return root;
  }

  /* ================== TAB 4: TARGET PLANNER PANEL ================== */
  _createTargetPanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.className = 'iuh-gpa-subpanel-content';

    const desc = doc.createElement('div');
    desc.className = 'iuh-gpa-panel-intro';
    desc.textContent = 'Xác định GPA trung bình (Hệ 4) cần đạt trong phần còn lại để đạt GPA mục tiêu mong muốn.';
    root.appendChild(desc);

    const formGrid = doc.createElement('div');
    formGrid.className = 'iuh-gpa-target-form-grid';

    // Current State Card
    const currentCard = doc.createElement('div');
    currentCard.className = 'iuh-gpa-target-current-card';
    const curTitle = doc.createElement('div');
    curTitle.className = 'iuh-gpa-input-label';
    curTitle.textContent = 'GPA hiện tại & Tín chỉ đã tính';
    const curVal = doc.createElement('div');
    curVal.id = 'iuh-gpa-target-cur-val';
    curVal.className = 'iuh-gpa-target-cur-text';
    curVal.textContent = '--';
    currentCard.appendChild(curTitle);
    currentCard.appendChild(curVal);
    formGrid.appendChild(currentCard);

    // Target GPA Input
    const targetInputGroup = doc.createElement('div');
    targetInputGroup.className = 'iuh-gpa-input-group';
    const targetLabel = doc.createElement('label');
    targetLabel.htmlFor = 'iuh-gpa-target-input-gpa';
    targetLabel.className = 'iuh-gpa-input-label';
    targetLabel.textContent = 'GPA mục tiêu (Hệ 4)';

    const targetInput = doc.createElement('input');
    targetInput.type = 'number';
    targetInput.id = 'iuh-gpa-target-input-gpa';
    targetInput.className = 'iuh-gpa-form-control';
    targetInput.min = '0.00';
    targetInput.max = '4.00';
    targetInput.step = '0.05';
    targetInput.value = this.targetGPA.toFixed(2);
    targetInput.setAttribute('aria-label', 'GPA mục tiêu hệ 4');

    targetInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.targetGPA = e.target.value.trim() === '' ? NaN : val;
      this._updateTargetCalculation();
    });

    targetInputGroup.appendChild(targetLabel);
    targetInputGroup.appendChild(targetInput);

    // Target presets
    const presetsGroup = doc.createElement('div');
    presetsGroup.className = 'iuh-gpa-presets-group';
    const presets = GPATargetEngine.getPresets ? GPATargetEngine.getPresets() : TARGET_PRESETS;
    presets.forEach(p => {
      const pBtn = doc.createElement('button');
      pBtn.type = 'button';
      pBtn.className = 'iuh-gpa-preset-btn';
      pBtn.textContent = p.label;
      pBtn.setAttribute('aria-label', `Chọn mục tiêu ${p.label}`);
      pBtn.addEventListener('click', () => {
        this.targetGPA = p.value;
        targetInput.value = p.value.toFixed(2);
        this._updateTargetCalculation();
      });
      presetsGroup.appendChild(pBtn);
    });
    targetInputGroup.appendChild(presetsGroup);
    formGrid.appendChild(targetInputGroup);

    // Remaining Credits Input (Không đoán mò, ghi rõ label)
    const creditsInputGroup = doc.createElement('div');
    creditsInputGroup.className = 'iuh-gpa-input-group';
    const creditsLabel = doc.createElement('label');
    creditsLabel.htmlFor = 'iuh-gpa-target-input-remaining';
    creditsLabel.className = 'iuh-gpa-input-label';
    creditsLabel.textContent = 'Tín chỉ còn lại dự kiến ';

    const overrideBadge = doc.createElement('span');
    overrideBadge.id = 'iuh-gpa-target-override-badge';
    overrideBadge.className = 'iuh-gpa-badge-override';
    overrideBadge.style.display = 'none';
    overrideBadge.style.marginLeft = '6px';
    overrideBadge.style.padding = '2px 6px';
    overrideBadge.style.borderRadius = '4px';
    overrideBadge.style.fontSize = '11px';
    overrideBadge.style.background = '#FEF3C7';
    overrideBadge.style.color = '#92400E';
    overrideBadge.style.fontWeight = '600';
    overrideBadge.textContent = 'Tùy chỉnh thủ công';
    creditsLabel.appendChild(overrideBadge);

    const creditsInput = doc.createElement('input');
    creditsInput.type = 'number';
    creditsInput.id = 'iuh-gpa-target-input-remaining';
    creditsInput.className = 'iuh-gpa-form-control';
    creditsInput.min = '0';
    creditsInput.max = '500';
    creditsInput.step = '1';
    creditsInput.value = this.remainingCredits.toString();
    creditsInput.placeholder = 'Ví dụ: 45';
    creditsInput.setAttribute('aria-label', 'Số tín chỉ còn lại dự kiến');

    creditsInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.isRemainingCreditsManualOverride = true;
      this.remainingCredits = e.target.value.trim() === '' ? NaN : val;
      this._updateTargetSourceIndicator();
      this._updateTargetCalculation();
      this._updateForecastCalculation();
    });

    const sourceIndicator = doc.createElement('div');
    sourceIndicator.id = 'iuh-gpa-target-source-indicator';
    sourceIndicator.className = 'iuh-gpa-source-indicator';
    sourceIndicator.style.fontSize = '11.5px';
    sourceIndicator.style.color = '#64748B';
    sourceIndicator.style.marginTop = '4px';
    sourceIndicator.textContent = 'Nguồn: Nhập thủ công';

    creditsInputGroup.appendChild(creditsLabel);
    creditsInputGroup.appendChild(creditsInput);
    creditsInputGroup.appendChild(sourceIndicator);

    // Action: Dùng tín chỉ còn lại từ CTK (Requirement 52, 53)
    const applyCtkBtn = doc.createElement('button');
    applyCtkBtn.type = 'button';
    applyCtkBtn.id = 'iuh-gpa-btn-apply-ctk-credits';
    applyCtkBtn.className = 'iuh-gpa-btn-action';
    applyCtkBtn.style.marginTop = '6px';
    applyCtkBtn.style.fontSize = '12px';
    applyCtkBtn.textContent = 'Khôi phục theo CTK';
    applyCtkBtn.title = 'Áp dụng số tín chỉ còn lại theo Chương trình khung';
    applyCtkBtn.addEventListener('click', () => {
      const cur = this._latestDerivedData?.curriculum;
      const cp = this._latestDerivedData?.curriculumProgress;
      if (!cur && !cp) {
        this.showToast('Chưa có dữ liệu Chương trình khung. Vui lòng nhấn "Đồng bộ CTK" ở trên.', 'warning');
        return;
      }
      this.isRemainingCreditsManualOverride = false;
      let remCredits = 0;
      if (cp && typeof cp.gpaEligibleRemainingCredits === 'number') {
        remCredits = cp.gpaEligibleRemainingCredits;
      } else if (cp && typeof cp.curriculumRemainingCredits === 'number') {
        remCredits = cp.curriculumRemainingCredits;
      } else if (cur?.remainingCredits) {
        remCredits = cur.remainingCredits;
      }
      creditsInput.value = remCredits.toString();
      this.remainingCredits = remCredits;
      this._updateTargetSourceIndicator(true);
      this._updateTargetCalculation();
      this._updateForecastCalculation();
      this.showToast(`Đã khôi phục ${remCredits} tín chỉ GPA còn lại theo CTK.`, 'success');
    });
    creditsInputGroup.appendChild(applyCtkBtn);
    formGrid.appendChild(creditsInputGroup);

    root.appendChild(formGrid);

    // Result Banner Card
    const resultCard = doc.createElement('div');
    resultCard.id = 'iuh-gpa-target-result-card';
    resultCard.className = 'iuh-gpa-result-card';

    const resLabel = doc.createElement('div');
    resLabel.className = 'iuh-gpa-result-title';
    resLabel.textContent = 'GPA TRUNG BÌNH CẦN ĐẠT TRONG PHẦN CÒN LẠI';

    const resValue = doc.createElement('div');
    resValue.id = 'iuh-gpa-target-res-value';
    resValue.className = 'iuh-gpa-result-main';
    resValue.textContent = '--';

    const resBadge = doc.createElement('div');
    resBadge.id = 'iuh-gpa-target-res-badge';
    resBadge.className = 'iuh-gpa-difficulty-badge';
    resBadge.textContent = '--';

    const resNotice = doc.createElement('div');
    resNotice.id = 'iuh-gpa-target-res-notice';
    resNotice.className = 'iuh-gpa-result-notice';

    resultCard.appendChild(resLabel);
    resultCard.appendChild(resValue);
    resultCard.appendChild(resBadge);
    resultCard.appendChild(resNotice);
    root.appendChild(resultCard);

    // Subpanel disclaimer
    const note = doc.createElement('div');
    note.className = 'iuh-gpa-disclaimer-note';
    note.textContent = 'Kết quả là ước tính dựa trên dữ liệu và thông số bạn nhập.';
    root.appendChild(note);

    return root;
  }

  /* ================== TAB 5: FORECAST PANEL ================== */
  _createForecastPanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.className = 'iuh-gpa-subpanel-content';

    const desc = doc.createElement('div');
    desc.className = 'iuh-gpa-panel-intro';
    desc.textContent = 'Dự báo GPA tốt nghiệp dựa trên giả định kết quả của phần tín chỉ còn lại.';
    root.appendChild(desc);

    // Controls Grid
    const controls = doc.createElement('div');
    controls.className = 'iuh-gpa-forecast-controls';

    // Custom slider group
    const sliderGroup = doc.createElement('div');
    sliderGroup.className = 'iuh-gpa-forecast-slider-box';

    const sLabel = doc.createElement('div');
    sLabel.className = 'iuh-gpa-input-label';
    sLabel.textContent = 'GPA trung bình dự kiến cho phần còn lại:';

    const sRow = doc.createElement('div');
    sRow.className = 'iuh-gpa-slider-group';

    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.id = 'iuh-gpa-forecast-slider';
    slider.className = 'iuh-gpa-range-slider';
    slider.min = '0.00';
    slider.max = '4.00';
    slider.step = '0.05';
    slider.value = this.forecastFutureAverage.toFixed(2);
    slider.setAttribute('aria-label', 'GPA trung bình dự kiến cho phần còn lại');

    const numInput = doc.createElement('input');
    numInput.type = 'number';
    numInput.id = 'iuh-gpa-forecast-input';
    numInput.className = 'iuh-gpa-number-input';
    numInput.min = '0.00';
    numInput.max = '4.00';
    numInput.step = '0.05';
    numInput.value = this.forecastFutureAverage.toFixed(2);
    numInput.setAttribute('aria-label', 'Nhập số GPA trung bình dự kiến');

    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.forecastFutureAverage = val;
      numInput.value = val.toFixed(2);
      this._updateForecastCalculation();
    });

    numInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (e.target.value.trim() === '') {
        this.forecastFutureAverage = NaN;
        this._updateForecastCalculation();
      } else if (!isNaN(val) && val >= 0 && val <= 4.0) {
        this.forecastFutureAverage = val;
        slider.value = val.toFixed(2);
        this._updateForecastCalculation();
      } else {
        this.forecastFutureAverage = val;
        this._updateForecastCalculation();
      }
    });

    sRow.appendChild(slider);
    sRow.appendChild(numInput);
    sliderGroup.appendChild(sLabel);
    sliderGroup.appendChild(sRow);
    controls.appendChild(sliderGroup);

    // Projected Result Card
    const projCard = doc.createElement('div');
    projCard.className = 'iuh-gpa-forecast-proj-card';
    const pTitle = doc.createElement('div');
    pTitle.className = 'iuh-gpa-result-title';
    pTitle.textContent = 'GPA DỰ KIẾN TỔNG KẾT';
    const pVal = doc.createElement('div');
    pVal.id = 'iuh-gpa-forecast-proj-val';
    pVal.className = 'iuh-gpa-result-main';
    pVal.textContent = '--';
    const pRank = doc.createElement('div');
    pRank.id = 'iuh-gpa-forecast-proj-rank';
    pRank.className = 'iuh-gpa-forecast-rank-text';
    pRank.textContent = '--';

    projCard.appendChild(pTitle);
    projCard.appendChild(pVal);
    projCard.appendChild(pRank);
    controls.appendChild(projCard);

    root.appendChild(controls);

    // Forecast Scenarios Table
    const tableTitle = doc.createElement('div');
    tableTitle.className = 'iuh-gpa-input-label';
    tableTitle.style.marginTop = '12px';
    tableTitle.textContent = 'Bảng so sánh các kịch bản GPA phần còn lại:';
    root.appendChild(tableTitle);

    const tableWrapper = doc.createElement('div');
    tableWrapper.className = 'iuh-gpa-table-wrapper';

    const table = doc.createElement('table');
    table.className = 'iuh-gpa-targets-table';

    const thead = doc.createElement('thead');
    const headerRow = doc.createElement('tr');
    ['GPA Phần Còn Lại', 'GPA Dự Kiến Cuối', 'Xếp Loại Tương Ứng'].forEach(colText => {
      const th = doc.createElement('th');
      th.setAttribute('scope', 'col');
      th.textContent = colText;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = doc.createElement('tbody');
    tbody.id = 'iuh-gpa-forecast-table-body';
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    root.appendChild(tableWrapper);

    // Disclaimer
    const note = doc.createElement('div');
    note.className = 'iuh-gpa-disclaimer-note';
    note.textContent = 'GPA dự kiến theo thông số bạn nhập, không bao gồm các điều kiện tốt nghiệp khác.';
    root.appendChild(note);

    return root;
  }

  /* ================== TAB 6: RESCUE PANEL ================== */
  _createRescuePanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.className = 'iuh-gpa-subpanel-content';

    const desc = doc.createElement('div');
    desc.className = 'iuh-gpa-panel-intro';
    desc.textContent = 'Phân tích dựa trên mô phỏng hiện tại — Xếp hạng các môn có tác động tiềm năng lớn nhất nếu cải thiện điểm.';
    root.appendChild(desc);

    // Target Letter Selector
    const targetRow = doc.createElement('div');
    targetRow.className = 'iuh-gpa-rescue-target-row';

    const targetLabel = doc.createElement('span');
    targetLabel.className = 'iuh-gpa-input-label';
    targetLabel.textContent = 'Mục tiêu cải thiện giả định:';
    targetRow.appendChild(targetLabel);

    const letters = ['B', 'B+', 'A', 'A+'];
    letters.forEach(letter => {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = `iuh-gpa-pill-btn ${this.rescueTargetLetter === letter ? 'active' : ''}`;
      btn.textContent = `Bậc ${letter}`;
      btn.setAttribute('aria-label', `Mô phỏng nâng lên điểm ${letter}`);
      btn.addEventListener('click', () => {
        this.rescueTargetLetter = letter;
        const allPills = targetRow.querySelectorAll('.iuh-gpa-pill-btn');
        allPills.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        this._updateRescueCalculation();
      });
      targetRow.appendChild(btn);
    });
    root.appendChild(targetRow);

    // Course List
    const courseList = doc.createElement('div');
    courseList.id = 'iuh-gpa-rescue-course-list';
    courseList.className = 'iuh-gpa-rescue-list';
    root.appendChild(courseList);

    // Exclusion notice
    const exclNotice = doc.createElement('div');
    exclNotice.id = 'iuh-gpa-rescue-excl-notice';
    exclNotice.className = 'iuh-gpa-disclaimer-note';
    root.appendChild(exclNotice);

    // Mandatory Retake Disclaimer
    const disclaimer = doc.createElement('div');
    disclaimer.className = 'iuh-gpa-retake-disclaimer';
    disclaimer.textContent = RETAKE_DISCLAIMER || 'Kết quả học lại/cải thiện chỉ là mô phỏng tác động toán học. Không thay thế quy định học lại/học cải thiện chính thức.';
    root.appendChild(disclaimer);

    return root;
  }

  _createAnalyticsPanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.className = 'iuh-gpa-analytics-container';

    // Sub-navigation segmented pills
    const subNav = doc.createElement('div');
    subNav.className = 'iuh-gpa-subnav-pills';
    subNav.style.display = 'flex';
    subNav.style.gap = '8px';
    subNav.style.marginBottom = '14px';
    subNav.style.borderBottom = '1px solid #E2E8F0';
    subNav.style.paddingBottom = '10px';
    subNav.style.flexWrap = 'wrap';

    const subTabs = [
      { id: 'target', label: 'Mục tiêu GPA' },
      { id: 'forecast', label: 'Dự báo' },
      { id: 'rescue', label: 'Cải thiện GPA' },
      { id: 'gaps', label: 'Cảnh báo đối chiếu' }
    ];

    subTabs.forEach(st => {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.id = `iuh-gpa-tab-${st.id}`;
      btn.className = `iuh-gpa-btn-action iuh-gpa-subtab-btn ${this.activeAnalyticsSubTab === st.id ? 'active' : ''}`;
      btn.setAttribute('data-subtab', st.id);
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', this.activeAnalyticsSubTab === st.id ? 'true' : 'false');
      btn.textContent = st.label;

      if (st.id === 'gaps') {
        const badge = doc.createElement('span');
        badge.id = 'iuh-gpa-gaps-count-badge';
        badge.style.display = 'none';
        badge.style.marginLeft = '6px';
        badge.style.padding = '1px 5px';
        badge.style.fontSize = '10px';
        badge.style.borderRadius = '10px';
        badge.style.background = '#EF4444';
        badge.style.color = '#FFFFFF';
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => {
        this.switchAnalyticsSubTab(st.id);
      });
      subNav.appendChild(btn);
    });

    root.appendChild(subNav);

    // Sub-panels container
    const subPanelsContainer = doc.createElement('div');
    subPanelsContainer.className = 'iuh-gpa-subpanels-container';

    // Sub-panel 1: Target
    const pTarget = doc.createElement('div');
    pTarget.id = 'iuh-gpa-panel-target';
    pTarget.className = `iuh-gpa-subpanel ${this.activeAnalyticsSubTab === 'target' ? 'active' : ''}`;
    pTarget.appendChild(this._createTargetPanel());
    subPanelsContainer.appendChild(pTarget);

    // Sub-panel 2: Forecast
    const pForecast = doc.createElement('div');
    pForecast.id = 'iuh-gpa-panel-forecast';
    pForecast.className = `iuh-gpa-subpanel ${this.activeAnalyticsSubTab === 'forecast' ? 'active' : ''}`;
    pForecast.appendChild(this._createForecastPanel());
    subPanelsContainer.appendChild(pForecast);

    // Sub-panel 3: Rescue
    const pRescue = doc.createElement('div');
    pRescue.id = 'iuh-gpa-panel-rescue';
    pRescue.className = `iuh-gpa-subpanel ${this.activeAnalyticsSubTab === 'rescue' ? 'active' : ''}`;
    pRescue.appendChild(this._createRescuePanel());
    subPanelsContainer.appendChild(pRescue);

    // Sub-panel 4: Gaps
    const pGaps = doc.createElement('div');
    pGaps.id = 'iuh-gpa-panel-gaps';
    pGaps.className = `iuh-gpa-subpanel ${this.activeAnalyticsSubTab === 'gaps' ? 'active' : ''}`;
    pGaps.appendChild(this._createGapPanel());
    subPanelsContainer.appendChild(pGaps);

    root.appendChild(subPanelsContainer);
    return root;
  }

  _createGapPanel() {
    const doc = this.doc;
    const box = doc.createElement('div');
    box.className = 'iuh-gpa-gap-panel-content';

    const header = doc.createElement('div');
    header.style.marginBottom = '12px';

    const title = doc.createElement('h4');
    title.style.margin = '0 0 4px 0';
    title.style.fontSize = '14px';
    title.textContent = 'Kiểm tra và Đối chiếu Dữ liệu';

    const desc = doc.createElement('p');
    desc.style.margin = '0';
    desc.style.fontSize = '12px';
    desc.style.color = '#64748B';
    desc.textContent = 'Hệ thống tự động đối chiếu giữa Bảng điểm và Chương trình khung. Tiện ích không tự động sửa dữ liệu để bảo đảm an toàn.';

    header.appendChild(title);
    header.appendChild(desc);
    box.appendChild(header);

    const statusCard = doc.createElement('div');
    statusCard.id = 'iuh-gpa-gaps-status-card';
    statusCard.style.padding = '12px 14px';
    statusCard.style.borderRadius = '8px';
    statusCard.style.background = '#F8FAFC';
    statusCard.style.border = '1px solid #E2E8F0';
    statusCard.style.fontSize = '12.5px';
    statusCard.textContent = 'Đang kiểm tra đối chiếu dữ liệu...';
    box.appendChild(statusCard);

    const listContainer = doc.createElement('div');
    listContainer.id = 'iuh-gpa-gaps-list-container';
    listContainer.style.marginTop = '12px';
    box.appendChild(listContainer);

    return box;
  }

  _createPrivacyPanel() {
    const doc = this.doc;
    const panel = doc.createElement('div');
    panel.className = 'iuh-gpa-privacy-panel';

    const header = doc.createElement('div');
    header.className = 'iuh-gpa-privacy-header';

    const title = doc.createElement('h3');
    title.className = 'iuh-gpa-privacy-title';
    title.textContent = 'Chính Sách & Cam Kết Quyền Riêng Tư Cục Bộ';
    header.appendChild(title);

    const intro = doc.createElement('p');
    intro.className = 'iuh-gpa-privacy-desc';
    intro.textContent = 'Tiện ích không gửi dữ liệu học tập tới máy chủ của nhà phát triển hoặc bên thứ ba. Khi đồng bộ Chương trình khung, trình duyệt gửi yêu cầu trực tiếp tới cổng sinh viên IUH bằng phiên đăng nhập hiện tại.';
    header.appendChild(intro);
    panel.appendChild(header);

    const grid = doc.createElement('div');
    grid.className = 'iuh-gpa-privacy-grid';

    const items = [
      {
        title: 'Xử lý dữ liệu cục bộ',
        desc: 'Bảng điểm được đọc trực tiếp từ tab đang mở và lưu tạm thời trong bộ nhớ máy (in-memory) để tính toán điểm số và vẽ tiến trình GPA.',
      },
      {
        title: 'Bảo mật mạng & Không gửi dữ liệu ra ngoài',
        desc: 'Tiện ích không tải thư viện từ xa, không gửi analytics hay telemetry, và không có máy chủ thu thập thông tin.',
      },
      {
        title: 'Đồng bộ Chương trình khung an toàn',
        desc: 'Tính năng đồng bộ CTK chỉ gửi duy nhất 1 yêu cầu GET nội bộ cùng nguồn gốc (same-origin) tới sv.iuh.edu.vn để đọc môn học của bạn.',
      },
      {
        title: 'Bảo toàn dữ liệu gốc',
        desc: 'Tất cả mô phỏng điểm số, học kỳ dự kiến chỉ tồn tại trên giao diện trình duyệt và không làm thay đổi bảng điểm chính thức trên cổng trường.',
      },
    ];

    items.forEach(it => {
      const card = doc.createElement('div');
      card.className = 'iuh-gpa-privacy-card';

      const cTitle = doc.createElement('h4');
      cTitle.className = 'iuh-gpa-privacy-card-title';
      cTitle.textContent = it.title;

      const cDesc = doc.createElement('p');
      cDesc.className = 'iuh-gpa-privacy-card-desc';
      cDesc.textContent = it.desc;

      card.appendChild(cTitle);
      card.appendChild(cDesc);
      grid.appendChild(card);
    });

    panel.appendChild(grid);
    return panel;
  }

  _createPlanPanel() {
    const doc = this.doc;
    const root = doc.createElement('div');
    root.id = 'iuh-gpa-plan-container';
    root.className = 'iuh-gpa-plan-view-container';

    // 1. What-if Presets Bar (Requirement 26-32)
    const whatIfBar = doc.createElement('div');
    whatIfBar.className = 'iuh-gpa-whatif-bar';
    whatIfBar.style.display = 'flex';
    whatIfBar.style.alignItems = 'center';
    whatIfBar.style.gap = '8px';
    whatIfBar.style.padding = '10px 14px';
    whatIfBar.style.background = '#EFF6FF';
    whatIfBar.style.border = '1px solid #BFDBFE';
    whatIfBar.style.borderRadius = '8px';
    whatIfBar.style.marginBottom = '12px';
    whatIfBar.style.flexWrap = 'wrap';

    const whatIfLabel = doc.createElement('span');
    whatIfLabel.style.fontWeight = '600';
    whatIfLabel.style.fontSize = '12px';
    whatIfLabel.style.color = '#1E3A8A';
    whatIfLabel.textContent = 'Giả lập nhanh:';
    whatIfBar.appendChild(whatIfLabel);

    const presetGrades = ['B', 'B+', 'A'];
    presetGrades.forEach(g => {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'iuh-gpa-btn-action iuh-gpa-btn-preset';
      btn.textContent = `Tất cả ${g}`;
      btn.style.fontSize = '11.5px';
      btn.style.padding = '4px 8px';
      btn.addEventListener('click', () => {
        if (this.store && typeof this.store.applyWhatIfPreset === 'function') {
          this.store.applyWhatIfPreset(g);
        }
      });
      whatIfBar.appendChild(btn);
    });

    const undoBtn = doc.createElement('button');
    undoBtn.type = 'button';
    undoBtn.id = 'iuh-gpa-btn-whatif-undo';
    undoBtn.className = 'iuh-gpa-btn-action';
    undoBtn.textContent = 'Hoàn tác';
    undoBtn.disabled = true;
    undoBtn.style.fontSize = '11.5px';
    undoBtn.style.padding = '4px 8px';
    undoBtn.addEventListener('click', () => {
      if (this.store && typeof this.store.restoreWhatIfPreset === 'function') {
        this.store.restoreWhatIfPreset();
      }
    });
    whatIfBar.appendChild(undoBtn);

    const whatIfDisc = doc.createElement('span');
    whatIfDisc.style.fontSize = '11px';
    whatIfDisc.style.color = '#64748B';
    whatIfDisc.style.marginLeft = 'auto';
    whatIfDisc.textContent = 'Giả định kết quả GPA (không tự sinh điểm thành phần).';
    whatIfBar.appendChild(whatIfDisc);

    root.appendChild(whatIfBar);

    // 2. Plan Coverage & Target Insights Card (PlanCoverageEngine)
    const coverageCard = doc.createElement('div');
    coverageCard.id = 'iuh-gpa-plan-coverage-card';
    coverageCard.style.padding = '12px 14px';
    coverageCard.style.background = '#FFFFFF';
    coverageCard.style.border = '1px solid #E2E8F0';
    coverageCard.style.borderRadius = '8px';
    coverageCard.style.marginBottom = '12px';

    const covTitle = doc.createElement('div');
    covTitle.style.fontWeight = '600';
    covTitle.style.fontSize = '13px';
    covTitle.style.color = '#0F172A';
    covTitle.style.marginBottom = '6px';
    covTitle.textContent = 'Tổng quan Kế hoạch học tập';
    coverageCard.appendChild(covTitle);

    const covStats = doc.createElement('div');
    covStats.id = 'iuh-gpa-plan-coverage-stats';
    covStats.style.fontSize = '12px';
    covStats.style.color = '#334155';
    covStats.style.marginBottom = '8px';
    covStats.textContent = '0 học kỳ · 0 môn · 0 TC kế hoạch';
    coverageCard.appendChild(covStats);

    const covInsight = doc.createElement('div');
    covInsight.id = 'iuh-gpa-plan-target-insight';
    covInsight.style.fontSize = '12px';
    covInsight.style.padding = '6px 10px';
    covInsight.style.background = '#F8FAFC';
    covInsight.style.borderRadius = '6px';
    covInsight.style.color = '#1E293B';
    covInsight.style.marginBottom = '8px';
    covInsight.textContent = 'Chưa thiết lập mục tiêu GPA.';
    coverageCard.appendChild(covInsight);

    const covDisclaimer = doc.createElement('div');
    covDisclaimer.style.fontSize = '11px';
    covDisclaimer.style.color = '#64748B';
    covDisclaimer.style.fontStyle = 'italic';
    covDisclaimer.textContent = 'Học phần trong kế hoạch không đồng nghĩa Nhà trường sẽ mở lớp trong học kỳ đã chọn.';
    coverageCard.appendChild(covDisclaimer);

    root.appendChild(coverageCard);

    // 3. Mandatory Courses Remaining (Requirement 7 & 8)
    const mandCard = doc.createElement('div');
    mandCard.id = 'iuh-gpa-mandatory-progress-card';
    mandCard.style.padding = '12px 14px';
    mandCard.style.background = '#FFFFFF';
    mandCard.style.border = '1px solid #E2E8F0';
    mandCard.style.borderRadius = '8px';
    mandCard.style.marginBottom = '12px';

    const mandHeader = doc.createElement('div');
    mandHeader.style.display = 'flex';
    mandHeader.style.justifyContent = 'space-between';
    mandHeader.style.alignItems = 'center';
    mandHeader.style.marginBottom = '8px';

    const mandTitle = doc.createElement('span');
    mandTitle.style.fontWeight = '600';
    mandTitle.style.fontSize = '13px';
    mandTitle.textContent = 'Học phần bắt buộc';
    mandHeader.appendChild(mandTitle);

    const mandCounts = doc.createElement('span');
    mandCounts.id = 'iuh-gpa-mandatory-progress-counts';
    mandCounts.style.fontSize = '12px';
    mandCounts.style.fontWeight = '600';
    mandCounts.style.color = '#153898';
    mandCounts.textContent = 'Đã đạt -- / -- TC';
    mandHeader.appendChild(mandCounts);
    mandCard.appendChild(mandHeader);

    // Expandable table for mandatory remaining
    const mandDetails = doc.createElement('details');
    mandDetails.style.marginTop = '6px';

    const mandSummary = doc.createElement('summary');
    mandSummary.id = 'iuh-gpa-mandatory-summary-toggle';
    mandSummary.style.cursor = 'pointer';
    mandSummary.style.fontSize = '12px';
    mandSummary.style.color = '#2563EB';
    mandSummary.textContent = 'Xem danh sách học phần bắt buộc còn lại (0 môn)';
    mandDetails.appendChild(mandSummary);

    const mandListContainer = doc.createElement('div');
    mandListContainer.id = 'iuh-gpa-mandatory-remaining-list';
    mandListContainer.style.marginTop = '8px';
    mandListContainer.style.maxHeight = '240px';
    mandListContainer.style.overflowY = 'auto';
    mandDetails.appendChild(mandListContainer);

    mandCard.appendChild(mandDetails);
    root.appendChild(mandCard);

    // 4. Elective Groups Progress (Requirement 9-13)
    const electCard = doc.createElement('div');
    electCard.id = 'iuh-gpa-elective-progress-card';
    electCard.style.padding = '12px 14px';
    electCard.style.background = '#FFFFFF';
    electCard.style.border = '1px solid #E2E8F0';
    electCard.style.borderRadius = '8px';
    electCard.style.marginBottom = '12px';

    const electTitle = doc.createElement('div');
    electTitle.style.fontWeight = '600';
    electTitle.style.fontSize = '13px';
    electTitle.style.marginBottom = '8px';
    electTitle.textContent = 'Tiến độ các nhóm học phần tự chọn';
    electCard.appendChild(electTitle);

    const electGroupsList = doc.createElement('div');
    electGroupsList.id = 'iuh-gpa-elective-groups-container';
    electCard.appendChild(electGroupsList);

    root.appendChild(electCard);

    // 5. Actions bar (Thêm học kỳ & Đi tới kế hoạch)
    const actionsBar = doc.createElement('div');
    actionsBar.id = 'iuh-gpa-plan-actions-bar';
    actionsBar.style.display = 'flex';
    actionsBar.style.justifyContent = 'space-between';
    actionsBar.style.alignItems = 'center';
    actionsBar.style.padding = '8px 12px';
    actionsBar.style.background = '#F8FAFC';
    actionsBar.style.borderRadius = '6px';
    actionsBar.style.border = '1px solid #E2E8F0';
    actionsBar.style.flexWrap = 'wrap';
    actionsBar.style.gap = '8px';

    const infoSpan = doc.createElement('span');
    infoSpan.id = 'iuh-gpa-plan-quick-info';
    infoSpan.style.fontSize = '12px';
    infoSpan.style.color = '#64748B';
    infoSpan.textContent = 'Kế hoạch học kỳ tương lai được mô phỏng trực tiếp trên bảng điểm chính.';
    actionsBar.appendChild(infoSpan);

    const btnGroup = doc.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';

    const addFutureSemBtn = doc.createElement('button');
    addFutureSemBtn.type = 'button';
    addFutureSemBtn.id = 'iuh-gpa-btn-add-future-sem';
    addFutureSemBtn.className = 'iuh-gpa-btn-action';
    addFutureSemBtn.textContent = '+ Thêm học kỳ mới';
    addFutureSemBtn.addEventListener('click', () => {
      this.openFuturePlannerModal();
    });
    btnGroup.appendChild(addFutureSemBtn);

    const scrollToPlanBtn = doc.createElement('button');
    scrollToPlanBtn.type = 'button';
    scrollToPlanBtn.id = 'iuh-gpa-btn-scroll-to-plan';
    scrollToPlanBtn.className = 'iuh-gpa-btn-action';
    scrollToPlanBtn.textContent = 'Đi tới kế hoạch';
    scrollToPlanBtn.addEventListener('click', () => {
      const target = doc.querySelector('.iuh-gpa-future-semester-row') || doc.querySelector('.iuh-gpa-add-semester-row');
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    btnGroup.appendChild(scrollToPlanBtn);

    actionsBar.appendChild(btnGroup);
    root.appendChild(actionsBar);

    return root;
  }

  update(derivedData) {
    if (!this.container || !derivedData || !this.doc) return;
    this._latestDerivedData = derivedData;
    const doc = this.doc;

    const { overallOriginal, overallSimulated, hasSimulations, activeSimulationsCount } = derivedData;

    // 1. Status badge & Reset button
    const statusBadge = this.container.querySelector('#iuh-gpa-global-status-badge');
    const resetBtn = this.container.querySelector('#iuh-gpa-global-reset-btn');

    if (hasSimulations && activeSimulationsCount > 0) {
      statusBadge.textContent = `Đang mô phỏng (${activeSimulationsCount} môn)`;
      statusBadge.className = 'iuh-gpa-status-badge active';
      resetBtn.disabled = false;
    } else {
      statusBadge.textContent = 'Dữ liệu gốc';
      statusBadge.className = 'iuh-gpa-status-badge';
      resetBtn.disabled = true;
    }

    // CTK Status Badge Update
    const ctkStatusBadge = this.container.querySelector('#iuh-gpa-ctk-status-badge');
    const ctkRefreshBtn = this.container.querySelector('#iuh-gpa-ctk-refresh-btn');
    if (ctkStatusBadge) {
      const ctkStatus = derivedData?.curriculumStatus || 'UNSYNCED';
      if (ctkStatus === 'SYNCED') {
        ctkStatusBadge.className = 'iuh-gpa-ctk-badge synced';
        const isEngineErr = derivedData?.curriculumAnalyticsStatus === 'ENGINE_ERROR';
        ctkStatusBadge.textContent = isEngineErr ? 'CTK: Đã đồng bộ (Tiến độ: --)' : 'CTK: Đã đồng bộ';
        ctkStatusBadge.title = isEngineErr ? 'CTK đã tải thành công nhưng engine không thể tính tiến độ' : 'Nguồn: Chương trình khung IUH';
        if (ctkRefreshBtn) {
          ctkRefreshBtn.textContent = 'Làm mới CTK';
        }
      } else if (ctkStatus === 'SYNCING') {
        ctkStatusBadge.className = 'iuh-gpa-ctk-badge syncing';
        ctkStatusBadge.textContent = 'CTK: Đang đồng bộ...';
        ctkStatusBadge.title = 'Đang tải Chương trình khung từ sv.iuh.edu.vn';
      } else if (ctkStatus === 'FAILED') {
        ctkStatusBadge.className = 'iuh-gpa-ctk-badge failed';
        ctkStatusBadge.textContent = 'CTK: Chưa đồng bộ';
        ctkStatusBadge.title = `Chưa đồng bộ CTK (${derivedData.curriculumError || 'Lỗi kết nối'}). Nhấn Thử lại`;
        if (ctkRefreshBtn) {
          ctkRefreshBtn.textContent = 'Thử lại';
        }
      } else {
        ctkStatusBadge.className = 'iuh-gpa-ctk-badge unsynced';
        ctkStatusBadge.textContent = 'CTK: Chưa đồng bộ';
        ctkStatusBadge.title = 'Chưa đồng bộ Chương trình khung';
        if (ctkRefreshBtn) {
          ctkRefreshBtn.textContent = 'Đồng bộ CTK';
        }
      }
    }

    const effective = hasSimulations ? overallSimulated : overallOriginal;

    // 2. Metrics Grid & Summary Cards (Requirement 48: 5 priority cards)
    const val4 = this.container.querySelector('#iuh-gpa-metric-gpa4');
    if (val4) {
      val4.textContent = '';
      if (effective && (effective.gpa4Raw !== null || effective.gpa4 !== null)) {
        const text4 = effective.gpa4Raw !== null ? formatAverage4(effective.gpa4Raw) : effective.gpa4.toFixed(2);
        val4.appendChild(doc.createTextNode(text4));
        if (hasSimulations && overallOriginal && overallOriginal.gpa4 !== null) {
          const delta = Math.round((overallSimulated.gpa4 - overallOriginal.gpa4) * 100) / 100;
          if (delta !== 0) {
            const pill = doc.createElement('span');
            pill.className = `iuh-gpa-delta-pill ${delta > 0 ? 'iuh-gpa-delta-up' : 'iuh-gpa-delta-down'}`;
            pill.textContent = (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2));
            val4.appendChild(pill);
          }
        }
      } else {
        val4.textContent = '--';
      }
    }

    const val10 = this.container.querySelector('#iuh-gpa-metric-gpa10');
    if (val10) {
      val10.textContent = '';
      if (effective && (effective.gpa10Raw !== null || effective.gpa10 !== null)) {
        const text10 = effective.gpa10Raw !== null ? formatAverage4(effective.gpa10Raw) : effective.gpa10.toFixed(2);
        val10.appendChild(doc.createTextNode(text10));
        if (hasSimulations && overallOriginal && overallOriginal.gpa10 !== null) {
          const delta = Math.round((overallSimulated.gpa10 - overallOriginal.gpa10) * 100) / 100;
          if (delta !== 0) {
            const pill = doc.createElement('span');
            pill.className = `iuh-gpa-delta-pill ${delta > 0 ? 'iuh-gpa-delta-up' : 'iuh-gpa-delta-down'}`;
            pill.textContent = (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2));
            val10.appendChild(pill);
          }
        }
      } else {
        val10.textContent = '--';
      }
    }

    // Card 3: Tín chỉ CTK đã hoàn thành (Chỉ hiển thị khi CTK đã SYNCED thật sự)
    const valCtkCompleted = this.container.querySelector('#iuh-gpa-metric-ctk-completed');
    const isCtkSynced = derivedData.curriculumStatus === 'SYNCED';
    const isAnalyticsError = derivedData.curriculumAnalyticsStatus === 'ENGINE_ERROR';
    if (valCtkCompleted) {
      if (isCtkSynced && derivedData.curriculumProgress && derivedData.curriculumProgress.curriculumRequiredCredits > 0) {
        valCtkCompleted.textContent = `${derivedData.curriculumProgress.curriculumCompletedCredits} / ${derivedData.curriculumProgress.curriculumRequiredCredits} TC`;
        valCtkCompleted.title = 'Nguồn: Chương trình khung';
      } else if (isCtkSynced && isAnalyticsError) {
        valCtkCompleted.textContent = '--';
        valCtkCompleted.title = 'Không thể tính tiến độ CTK (Lỗi engine tính toán)';
      } else {
        valCtkCompleted.textContent = '--';
        valCtkCompleted.title = 'Chưa có dữ liệu Chương trình khung';
      }
    }
    // Backward compatibility for existing tests
    const valCredits = this.container.querySelector('#iuh-gpa-metric-credits');
    if (valCredits) {
      valCredits.textContent = effective ? `${effective.earnedCredits} / ${effective.totalCredits}` : '--';
    }

    // Card 4: TC Còn lại sau kế hoạch (Chỉ hiển thị khi CTK đã SYNCED thật sự)
    const valRem = this.container.querySelector('#iuh-gpa-metric-remaining-after-plan');
    if (valRem) {
      if (isCtkSynced && derivedData.curriculumProgress && derivedData.curriculumProgress.curriculumRequiredCredits > 0) {
        valRem.textContent = `${derivedData.curriculumProgress.curriculumRemainingAfterPlan} TC`;
        valRem.title = 'Số tín chỉ còn lại theo CTK';
      } else if (isCtkSynced && isAnalyticsError) {
        valRem.textContent = '--';
        valRem.title = 'Không thể tính tiến độ còn lại (Lỗi engine tính toán)';
      } else {
        valRem.textContent = '--';
        valRem.title = 'Chưa có dữ liệu Chương trình khung';
      }
    }

    // Card 5: GPA Dự kiến (sau kế hoạch tương lai)
    const valProj = this.container.querySelector('#iuh-gpa-metric-projected-gpa');
    if (valProj) {
      const projGpa = derivedData.projectedCumulative?.projectedCumulativeGPA4Raw;
      if (typeof projGpa === 'number') {
        valProj.textContent = formatAverage4(projGpa);
      } else if (effective && effective.gpa4Raw !== null) {
        valProj.textContent = formatAverage4(effective.gpa4Raw);
      } else {
        valProj.textContent = '--';
      }
    }
    // Backward compatibility for existing tests
    const valRank = this.container.querySelector('#iuh-gpa-metric-rank');
    if (valRank) {
      valRank.textContent = effective ? (effective.classification4 || 'Chưa xếp loại') : '--';
    }

    // 3. Current State in Target Panel
    const curValEl = this.container.querySelector('#iuh-gpa-target-cur-val');
    if (curValEl && effective) {
      const gpaText = effective.gpa4 !== null ? effective.gpa4.toFixed(2) : '--';
      curValEl.textContent = `${gpaText} / 4.00 (${effective.gradedCredits} tín chỉ đã tính)`;
    }

    // 4. Update Views
    this._syncTargetCreditsWithCTK(derivedData);
    this._updateCurriculumProgressBar(derivedData);
    this._updatePlanView();
    this._updateGapView();
    this._updateScenarioView();
    this._updateTimelineView();
    this._updateTargetCalculation();
    this._updateForecastCalculation();
    this._updateRescueCalculation();
  }

  _syncTargetCreditsWithCTK(derivedData) {
    const cp = derivedData?.curriculumProgress;
    const isCtkSynced = derivedData?.curriculumStatus === 'SYNCED' && cp;
    const creditsInput = this.container ? this.container.querySelector('#iuh-gpa-target-input-remaining') : null;

    if (isCtkSynced && typeof cp.gpaEligibleRemainingCredits === 'number') {
      const ctkGpaRemaining = cp.gpaEligibleRemainingCredits;
      if (!this.isRemainingCreditsManualOverride) {
        this.remainingCredits = ctkGpaRemaining;
        if (creditsInput) {
          creditsInput.value = ctkGpaRemaining.toString();
        }
      }
    }
    this._updateTargetSourceIndicator(Boolean(isCtkSynced));
  }

  _updateTargetSourceIndicator(isCtkSynced = null) {
    if (!this.container) return;
    if (isCtkSynced === null) {
      isCtkSynced = this._latestDerivedData?.curriculumStatus === 'SYNCED' && Boolean(this._latestDerivedData?.curriculumProgress);
    }
    const badge = this.container.querySelector('#iuh-gpa-target-override-badge');
    const indicator = this.container.querySelector('#iuh-gpa-target-source-indicator');
    const applyBtn = this.container.querySelector('#iuh-gpa-btn-apply-ctk-credits');

    if (badge) {
      badge.style.display = (isCtkSynced && this.isRemainingCreditsManualOverride) ? 'inline-block' : 'none';
      badge.textContent = 'Tùy chỉnh thủ công';
    }

    if (indicator) {
      if (isCtkSynced) {
        indicator.textContent = this.isRemainingCreditsManualOverride 
          ? 'Nguồn: Nhập thủ công' 
          : 'Nguồn tín chỉ còn lại: Chương trình khung IUH';
      } else {
        indicator.textContent = 'Nguồn: Nhập thủ công';
      }
    }

    if (applyBtn) {
      if (isCtkSynced) {
        applyBtn.textContent = this.isRemainingCreditsManualOverride ? 'Khôi phục theo CTK' : 'Đồng bộ theo CTK';
        applyBtn.style.display = 'inline-block';
      } else {
        applyBtn.textContent = 'Dùng tín chỉ còn lại từ CTK';
        applyBtn.style.display = 'inline-block';
      }
    }
  }

  _updateCurriculumProgressBar(derivedData) {
    if (!this.container) return;
    const box = this.container.querySelector('#iuh-gpa-curriculum-progress-container');
    if (!box) return;

    const cp = derivedData.curriculumProgress;
    const isCtkSynced = derivedData.curriculumStatus === 'SYNCED';
    if (!isCtkSynced || !cp || !cp.curriculumRequiredCredits) {
      box.style.display = 'none';
      return;
    }

    box.style.display = 'block';

    const completed = cp.verifiedCurriculumCompletedCredits ?? cp.curriculumCompletedCredits;
    const required = cp.curriculumRequiredCredits;
    const currentPercent = cp.currentProgressPercent;
    const planned = cp.curriculumPlannedCredits || 0;
    const projected = cp.projectedCurriculumCompletedCredits ?? (completed + planned);
    const projPercent = cp.projectedProgressPercent;

    const textEl = this.container.querySelector('#iuh-gpa-curriculum-progress-text');
    if (textEl) {
      if (planned > 0) {
        textEl.textContent = `Hiện tại: ${completed} / ${required} TC (${currentPercent}%) · Sau kế hoạch: ${projected} / ${required} TC (${projPercent}%)`;
      } else {
        textEl.textContent = `Hiện tại: ${completed} / ${required} TC (${currentPercent}%)`;
      }
    }

    const barCurrent = this.container.querySelector('#iuh-gpa-progress-bar-current');
    if (barCurrent) {
      barCurrent.style.width = `${Math.min(100, Math.max(0, currentPercent))}%`;
    }

    const barProj = this.container.querySelector('#iuh-gpa-progress-bar-projected');
    if (barProj) {
      const projDeltaPercent = Math.max(0, projPercent - currentPercent);
      barProj.style.width = `${Math.min(100 - currentPercent, projDeltaPercent)}%`;
    }

    const detailsEl = this.container.querySelector('#iuh-gpa-curriculum-legend-details');
    if (detailsEl) {
      let detailMsg = `Hiện tại: ${completed} TC`;
      if (planned > 0) {
        detailMsg += ` · Kế hoạch bổ sung: +${planned} TC · Sau kế hoạch: ${projected} TC · Còn thiếu sau kế hoạch: ${cp.curriculumRemainingAfterPlan} TC`;
      } else {
        detailMsg += ` · Còn thiếu: ${cp.curriculumRemainingCredits} TC`;
      }
      if (cp.reconciliationStatus === 'SIGNIFICANT_DISCREPANCY') {
        detailMsg += ` (Lưu ý: Bảng điểm tích lũy ${cp.officialTranscriptCumulativeCredits} TC khác ${completed} TC môn CTK)`;
      }
      detailsEl.textContent = detailMsg;
    }
  }

  _updateGapView() {
    if (!this.container || !this._latestDerivedData) return;
    const doc = this.doc;
    const derived = this._latestDerivedData;
    const gapsData = derived.curriculumGaps;

    const countBadge = this.container.querySelector('#iuh-gpa-gaps-count-badge');
    const statusCard = this.container.querySelector('#iuh-gpa-gaps-status-card');
    const listContainer = this.container.querySelector('#iuh-gpa-gaps-list-container');

    if (!gapsData || !gapsData.hasGaps) {
      if (countBadge) countBadge.style.display = 'none';
      if (statusCard) {
        const isSynced = derived.curriculumStatus === 'SYNCED';
        statusCard.style.background = isSynced ? '#F0FDF4' : '#FFFBEB';
        statusCard.style.borderColor = isSynced ? '#BBF7D0' : '#FDE68A';
        statusCard.style.color = isSynced ? '#166534' : '#92400E';
        statusCard.textContent = isSynced
          ? (gapsData?.summaryText || 'Đã đồng bộ CTK; chưa phát hiện bất nhất.')
          : 'Chưa đồng bộ Chương trình khung IUH nên chưa thể đối chiếu đầy đủ.';
      }
      if (listContainer) listContainer.innerHTML = '';
      return;
    }

    if (countBadge) {
      countBadge.style.display = 'inline-block';
      countBadge.textContent = gapsData.gapCount;
    }

    if (statusCard) {
      statusCard.style.background = '#FFFBEB';
      statusCard.style.borderColor = '#FDE68A';
      statusCard.style.color = '#92400E';
      statusCard.textContent = `${gapsData.gapCount} vấn đề đối chiếu cần xem xét. Danh sách bên dưới nêu rõ mức độ và lý do; tiện ích không tự sửa dữ liệu.`;
    }

    if (listContainer) {
      listContainer.innerHTML = '';
      gapsData.gaps.forEach(g => {
        const item = doc.createElement('div');
        item.style.padding = '8px 12px';
        item.style.marginBottom = '6px';
        item.style.borderRadius = '6px';
        item.style.border = '1px solid #E2E8F0';
        item.style.background = '#FFFFFF';
        item.style.fontSize = '12px';

        const head = doc.createElement('div');
        head.style.display = 'flex';
        head.style.justifyContent = 'space-between';
        head.style.fontWeight = '600';
        head.style.color = '#1E293B';
        head.textContent = `${g.courseCode ? g.courseCode + ' - ' : ''}${g.courseName || 'Học phần'}`;

        const sevBadge = doc.createElement('span');
        sevBadge.style.fontSize = '11px';
        sevBadge.style.padding = '1px 6px';
        sevBadge.style.borderRadius = '4px';
        const requiresReview = g.severity === 'HIGH' || g.severity === 'WARNING';
        sevBadge.style.background = requiresReview ? '#FEE2E2' : '#FEF3C7';
        sevBadge.style.color = requiresReview ? '#991B1B' : '#92400E';
        sevBadge.textContent = requiresReview ? 'Cần kiểm tra' : 'Thông tin';
        head.appendChild(sevBadge);
        item.appendChild(head);

        const msg = doc.createElement('div');
        msg.style.marginTop = '4px';
        msg.style.color = '#475569';
        msg.textContent = g.message;
        item.appendChild(msg);

        listContainer.appendChild(item);
      });
    }
  }

  _updatePlanView() {
    if (!this.container || !this._latestDerivedData) return;
    const doc = this.doc;
    const derived = this._latestDerivedData;
    const futurePlan = derived.futurePlan || { semesters: [] };
    const fSemesters = futurePlan.semesters || [];
    const cp = derived.curriculumProgress;
    const pc = derived.planCoverage;

    // 1. Undo What-if button
    const undoBtn = this.container.querySelector('#iuh-gpa-btn-whatif-undo');
    if (undoBtn) {
      undoBtn.disabled = !derived.canRestoreWhatIfPreset;
    }

    // 2. Plan Coverage Summary Card
    const covStats = this.container.querySelector('#iuh-gpa-plan-coverage-stats');
    if (covStats) {
      if (pc) {
        covStats.textContent = `${pc.futureSemesterCount} học kỳ · ${pc.plannedCourseCount} môn · ${pc.plannedCurriculumCredits} TC kế hoạch (${pc.plannedGpaCredits} TC tính GPA)`;
      } else {
        const totalPlannedCourses = fSemesters.reduce((acc, s) => acc + (s.courses?.length || 0), 0);
        const totalPlannedCredits = fSemesters.reduce((acc, s) => acc + (s.courses || []).reduce((cAcc, c) => cAcc + (c.credits || 0), 0), 0);
        covStats.textContent = `${fSemesters.length} học kỳ · ${totalPlannedCourses} môn · ${totalPlannedCredits} TC kế hoạch`;
      }
    }

    const covInsight = this.container.querySelector('#iuh-gpa-plan-target-insight');
    if (covInsight) {
      if (pc && pc.targetInsight) {
        covInsight.style.display = 'block';
        covInsight.textContent = pc.targetInsight;
      } else {
        covInsight.style.display = 'none';
      }
    }

    // 3. Mandatory Courses Remaining (Requirement 7 & 8)
    const mandCounts = this.container.querySelector('#iuh-gpa-mandatory-progress-counts');
    const mandToggle = this.container.querySelector('#iuh-gpa-mandatory-summary-toggle');
    const mandList = this.container.querySelector('#iuh-gpa-mandatory-remaining-list');

    if (cp && cp.mandatory) {
      const mand = cp.mandatory;
      if (mandCounts) {
        const remMand = Number.isFinite(mand.remainingCreditsAfterPlan) ? mand.remainingCreditsAfterPlan : (Number.isFinite(mand.remainingAfterPlan) ? mand.remainingAfterPlan : (Number.isFinite(mand.remainingCredits) ? mand.remainingCredits : 0));
        mandCounts.textContent = `Đã đạt: ${mand.completedCredits || 0} / ${mand.requiredCredits || 0} TC · Kế hoạch: ${mand.plannedCredits || 0} TC · Còn thiếu: ${remMand} TC`;
      }
      const remCourses = mand.remainingCourses || [];
      if (mandToggle) {
        mandToggle.textContent = `Xem danh sách học phần bắt buộc còn lại (${remCourses.length} môn)`;
      }
      if (mandList) {
        mandList.innerHTML = '';
        if (remCourses.length === 0) {
          const empty = doc.createElement('div');
          empty.style.padding = '8px';
          empty.style.fontSize = '12px';
          empty.style.color = '#166534';
          empty.textContent = 'Đã hoàn thành toàn bộ học phần bắt buộc trong CTK.';
          mandList.appendChild(empty);
        } else {
          const table = doc.createElement('table');
          table.className = 'iuh-gpa-table-mini';
          table.style.width = '100%';
          table.style.fontSize = '11.5px';
          table.style.borderCollapse = 'collapse';

          const thead = doc.createElement('thead');
          thead.innerHTML = '<tr style="border-bottom: 1px solid #CBD5E1; color: #475569; text-align: left;">' +
            '<th style="padding: 4px 6px;">Mã HP</th>' +
            '<th style="padding: 4px 6px;">Tên môn học</th>' +
            '<th style="padding: 4px 6px; text-align: center;">TC</th>' +
            '<th style="padding: 4px 6px; text-align: center;">Học kỳ CTK</th>' +
            '<th style="padding: 4px 6px; text-align: center;">Loại môn</th>' +
            '<th style="padding: 4px 6px; text-align: center;">Trạng thái</th>' +
            '</tr>';
          table.appendChild(thead);

          const tbody = doc.createElement('tbody');
          remCourses.forEach(c => {
            const tr = doc.createElement('tr');
            tr.style.borderBottom = '1px solid #F1F5F9';

            const tdCode = doc.createElement('td');
            tdCode.style.padding = '4px 6px';
            tdCode.style.fontFamily = 'monospace';
            tdCode.textContent = c.code || '--';
            tr.appendChild(tdCode);

            const tdName = doc.createElement('td');
            tdName.style.padding = '4px 6px';
            tdName.textContent = c.name;
            tr.appendChild(tdName);

            const tdCredits = doc.createElement('td');
            tdCredits.style.padding = '4px 6px';
            tdCredits.style.textAlign = 'center';
            tdCredits.textContent = c.credits;
            tr.appendChild(tdCredits);

            const tdTerm = doc.createElement('td');
            tdTerm.style.padding = '4px 6px';
            tdTerm.style.textAlign = 'center';
            tdTerm.textContent = (c.curriculumSemester && !c.curriculumSemester.includes('undefined'))
              ? c.curriculumSemester
              : (Number.isFinite(c.curriculumSemesterIndex)
                ? `Học kỳ ${c.curriculumSemesterIndex}`
                : (Number.isFinite(c.term) ? `HK${c.term}` : 'Chưa xác định'));
            tr.appendChild(tdTerm);

            const tdType = doc.createElement('td');
            tdType.style.padding = '4px 6px';
            tdType.style.textAlign = 'center';
            tdType.textContent = c.type === 'TH' ? 'Thực hành' : (c.type === 'LT+TH' ? 'Kết hợp' : 'Lý thuyết');
            tr.appendChild(tdType);

            const tdStatus = doc.createElement('td');
            tdStatus.style.padding = '4px 6px';
            tdStatus.style.textAlign = 'center';
            const statusBadge = doc.createElement('span');
            statusBadge.style.fontSize = '10px';
            statusBadge.style.padding = '1px 5px';
            statusBadge.style.borderRadius = '3px';
            if (c.status === 'PLANNED') {
              statusBadge.style.background = '#DBEAFE';
              statusBadge.style.color = '#1E40AF';
              statusBadge.textContent = 'Trong kế hoạch';
            } else if (c.status === 'NOT_PASSED') {
              statusBadge.style.background = '#FEE2E2';
              statusBadge.style.color = '#991B1B';
              statusBadge.textContent = 'Chưa đạt';
            } else {
              statusBadge.style.background = '#F1F5F9';
              statusBadge.style.color = '#475569';
              statusBadge.textContent = 'Chưa học';
            }
            tdStatus.appendChild(statusBadge);
            tr.appendChild(tdStatus);

            tbody.appendChild(tr);
          });
          table.appendChild(tbody);
          mandList.appendChild(table);
        }
      }
    } else {
      if (mandCounts) mandCounts.textContent = 'Đã đạt: -- / -- TC';
      if (mandToggle) mandToggle.textContent = 'Xem danh sách học phần bắt buộc còn lại (0 môn)';
      if (mandList) mandList.innerHTML = '';
    }

    // 4. Elective Groups Progress (Requirement 9-13)
    const electGroupsList = this.container.querySelector('#iuh-gpa-elective-groups-container');
    if (electGroupsList) {
      electGroupsList.innerHTML = '';
      const groups = cp?.electives?.groups || [];
      if (groups.length === 0) {
        const noElect = doc.createElement('div');
        noElect.style.fontSize = '12px';
        noElect.style.color = '#64748B';
        noElect.style.padding = '6px 0';
        noElect.textContent = 'Không có nhóm tự chọn hoặc chưa đồng bộ CTK.';
        electGroupsList.appendChild(noElect);
      } else {
        let hasRenderedInvalidWarning = false;
        groups.forEach(g => {
          const reqCr = (typeof g.requiredCredits === 'number' && Number.isFinite(g.requiredCredits)) ? g.requiredCredits : 0;
          if (g.status === 'INCOMPATIBLE_GROUP' || !g.id || String(g.id).includes('undefined') || reqCr <= 0) {
            if (!hasRenderedInvalidWarning) {
              hasRenderedInvalidWarning = true;
              const warn = doc.createElement('div');
              warn.style.padding = '8px 12px';
              warn.style.marginBottom = '6px';
              warn.style.borderRadius = '6px';
              warn.style.border = '1px solid #FCD34D';
              warn.style.background = '#FFFBEB';
              warn.style.color = '#B45309';
              warn.style.fontSize = '12px';
              warn.textContent = 'Không thể xác định một nhóm học phần tự chọn từ dữ liệu CTK.';
              electGroupsList.appendChild(warn);
            }
            return;
          }

          const card = doc.createElement('div');
          card.style.padding = '8px 12px';
          card.style.marginBottom = '6px';
          card.style.borderRadius = '6px';
          card.style.border = '1px solid #E2E8F0';
          card.style.background = '#F8FAFC';
          card.style.fontSize = '12px';

          const top = doc.createElement('div');
          top.style.display = 'flex';
          top.style.justifyContent = 'space-between';
          top.style.alignItems = 'center';
          top.style.fontWeight = '600';
          const rawGName = (g.name || g.label || g.groupName || '').trim();
          const cleanGroupName = (rawGName && !rawGName.includes('undefined'))
            ? rawGName
            : (g.groupIndex ? `Nhóm tự chọn ${g.groupIndex}` : 'Nhóm tự chọn');
          top.textContent = cleanGroupName;

          const statusBadge = doc.createElement('span');
          statusBadge.style.fontSize = '11px';
          statusBadge.style.padding = '1px 6px';
          statusBadge.style.borderRadius = '4px';

          if (g.status === 'SATISFIED_COMPLETED') {
            statusBadge.style.background = '#DCFCE7';
            statusBadge.style.color = '#15803D';
            statusBadge.textContent = 'Đã đạt';
          } else if (g.status === 'SATISFIED_WITH_PLAN') {
            statusBadge.style.background = '#DBEAFE';
            statusBadge.style.color = '#1D4ED8';
            statusBadge.textContent = 'Đã đủ theo kế hoạch';
          } else if (g.status === 'OVER_PLANNED') {
            statusBadge.style.background = '#EDE9FE';
            statusBadge.style.color = '#6D28D9';
            statusBadge.textContent = 'Đã chọn vượt yêu cầu';
          } else if (g.status === 'IN_PROGRESS') {
            statusBadge.style.background = '#FEF3C7';
            statusBadge.style.color = '#B45309';
            statusBadge.textContent = 'Đang thực hiện';
          } else {
            statusBadge.style.background = '#F1F5F9';
            statusBadge.style.color = '#64748B';
            statusBadge.textContent = 'Chưa bắt đầu';
          }
          top.appendChild(statusBadge);
          card.appendChild(top);

          const desc = doc.createElement('div');
          desc.style.marginTop = '4px';
          desc.style.color = '#475569';
          const reqG = Number.isFinite(g.requiredCredits) ? g.requiredCredits : 0;
          const compG = Number.isFinite(g.completedCredits) ? g.completedCredits : 0;
          const planG = Number.isFinite(g.plannedCredits) ? g.plannedCredits : 0;
          const remG = Number.isFinite(g.remainingCreditsAfterPlan)
            ? g.remainingCreditsAfterPlan
            : (Number.isFinite(g.remainingAfterPlan)
              ? g.remainingAfterPlan
              : (Number.isFinite(g.remainingCredits) ? g.remainingCredits : 0));
          desc.textContent = `Yêu cầu: ${reqG} TC · Đã đạt: ${compG} TC · Trong kế hoạch: ${planG} TC · Còn thiếu: ${remG} TC`;
          card.appendChild(desc);

          electGroupsList.appendChild(card);
        });
      }
    }

    const quickInfo = this.container.querySelector('#iuh-gpa-plan-quick-info');
    if (quickInfo) {
      if (fSemesters.length === 0) {
        quickInfo.textContent = 'Chưa có học kỳ mô phỏng nào trong kế hoạch.';
      } else {
        const totalCourses = fSemesters.reduce((acc, s) => acc + (s.courses?.length || 0), 0);
        const totalCredits = fSemesters.reduce((acc, s) => acc + (s.courses || []).reduce((cAcc, c) => cAcc + (c.credits || 0), 0), 0);
        quickInfo.textContent = `Kế hoạch: ${fSemesters.length} học kỳ · ${totalCourses} môn · ${totalCredits} TC. Mô phỏng trực tiếp trên bảng điểm.`;
      }
    }
  }
  /* ================== SCENARIO LOGIC ================== */
  _updateScenarioView() {
    if (!this.container) return;
    const engine = this.store.getScenarioEngine ? this.store.getScenarioEngine() : null;
    if (!engine) return;

    const selector = this.container.querySelector('#iuh-gpa-scenario-selector');
    if (selector) {
      selector.textContent = ''; // safe clear
      const allScenarios = engine.getAllScenarios();
      const activeId = engine.getActiveScenarioId();

      allScenarios.forEach(sc => {
        const opt = this.doc.createElement('option');
        opt.value = sc.id;
        opt.textContent = sc.name;
        if (sc.id === activeId) opt.selected = true;
        selector.appendChild(opt);
      });
    }

    // Update Comparison Table
    const tbody = this.container.querySelector('#iuh-gpa-scenario-table-body');
    if (tbody && this._latestDerivedData) {
      tbody.textContent = '';
      const allScenarios = engine.getAllScenarios();
      const allOriginalCourses = this._latestDerivedData.allOriginalCourses || [];

      const comparison = ScenarioEngine.compareScenarios({
        scenarioEngine: engine,
        scenarioIds: allScenarios.map(s => s.id),
        allOriginalCourses,
        gradingRuleEngine: GradingRuleEngine,
      });

      // Dòng Baseline
      if (comparison.baseline) {
        const trBase = this.doc.createElement('tr');
        trBase.className = 'iuh-gpa-row-baseline';
        const tdName = this.doc.createElement('td');
        tdName.style.fontWeight = '700';
        tdName.textContent = `${comparison.baseline.label} (Gốc)`;
        const tdCount = this.doc.createElement('td');
        tdCount.textContent = '0';
        const tdGpa4 = this.doc.createElement('td');
        tdGpa4.textContent = comparison.baseline.gpa4.toFixed(2);
        const tdGpa10 = this.doc.createElement('td');
        tdGpa10.textContent = comparison.baseline.gpa10.toFixed(2);
        const tdDelta = this.doc.createElement('td');
        tdDelta.textContent = 'Baseline (0.00)';
        const tdRank = this.doc.createElement('td');
        tdRank.textContent = comparison.baseline.classification4;

        trBase.appendChild(tdName);
        trBase.appendChild(tdCount);
        trBase.appendChild(tdGpa4);
        trBase.appendChild(tdGpa10);
        trBase.appendChild(tdDelta);
        trBase.appendChild(tdRank);
        tbody.appendChild(trBase);
      }

      // Các dòng Scenarios
      comparison.scenarios.forEach(sc => {
        const tr = this.doc.createElement('tr');
        const tdName = this.doc.createElement('td');
        tdName.style.fontWeight = '600';
        tdName.textContent = sc.scenarioName;

        const tdCount = this.doc.createElement('td');
        tdCount.textContent = sc.modifiedCoursesCount.toString();

        const tdGpa4 = this.doc.createElement('td');
        tdGpa4.textContent = sc.gpa4Display !== null ? sc.gpa4Display.toFixed(2) : '--';

        const tdGpa10 = this.doc.createElement('td');
        tdGpa10.textContent = sc.gpa10Display !== null ? sc.gpa10Display.toFixed(2) : '--';

        const tdDelta = this.doc.createElement('td');
        if (sc.deltaGpa4 > 0) {
          tdDelta.className = 'iuh-gpa-delta-up';
          tdDelta.textContent = `+${sc.deltaGpa4.toFixed(2)}`;
        } else if (sc.deltaGpa4 < 0) {
          tdDelta.className = 'iuh-gpa-delta-down';
          tdDelta.textContent = `${sc.deltaGpa4.toFixed(2)}`;
        } else {
          tdDelta.textContent = '0.00';
        }

        const tdRank = this.doc.createElement('td');
        tdRank.textContent = sc.classification4 || '--';

        tr.appendChild(tdName);
        tr.appendChild(tdCount);
        tr.appendChild(tdGpa4);
        tr.appendChild(tdGpa10);
        tr.appendChild(tdDelta);
        tr.appendChild(tdRank);
        tbody.appendChild(tr);
      });
    }
  }

  /* ================== TIMELINE LOGIC ================== */
  _updateTimelineView() {
    if (!this.container || !this._latestDerivedData) return;
    const semesters = this._latestDerivedData.semesters || [];
    const timelineData = TimelineEngine.generateTimelineData(semesters);

    const chartWrapper = this.container.querySelector('#iuh-gpa-timeline-chart-wrapper');
    const tbody = this.container.querySelector('#iuh-gpa-timeline-table-body');
    if (!chartWrapper || !tbody) return;

    // Render Native SVG Chart
    chartWrapper.textContent = '';
    const chartModel = TimelineEngine.computeSVGChartModel(timelineData, { width: 620, height: 210, padding: 36 });

    if (!chartModel.isEmpty) {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = this.doc.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${chartModel.width} ${chartModel.height}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.classList.add('iuh-gpa-timeline-svg');

      // Grid Guidelines
      chartModel.yGuides.forEach(g => {
        const line = this.doc.createElementNS(svgNS, 'line');
        line.setAttribute('x1', chartModel.padding.toString());
        line.setAttribute('y1', g.y.toString());
        line.setAttribute('x2', (chartModel.width - chartModel.padding).toString());
        line.setAttribute('y2', g.y.toString());
        line.setAttribute('stroke', '#E2E8F0');
        line.setAttribute('stroke-dasharray', '3 3');
        svg.appendChild(line);

        const txt = this.doc.createElementNS(svgNS, 'text');
        txt.setAttribute('x', (chartModel.padding - 4).toString());
        txt.setAttribute('y', (g.y + 3).toString());
        txt.setAttribute('text-anchor', 'end');
        txt.setAttribute('font-size', '9');
        txt.setAttribute('fill', '#94A3B8');
        txt.textContent = g.label;
        svg.appendChild(txt);
      });

      // Path Original Cumulative GPA (Primary Blue)
      if (chartModel.pathOrigCumulative) {
        const path = this.doc.createElementNS(svgNS, 'path');
        path.setAttribute('d', chartModel.pathOrigCumulative);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#153898');
        path.setAttribute('stroke-width', '2.5');
        svg.appendChild(path);
      }

      // Path Simulated Cumulative GPA (Amber, if delta exists)
      const hasSimDelta = timelineData.some(t => t.hasSimulationDelta);
      if (hasSimDelta && chartModel.pathSimCumulative) {
        const pathSim = this.doc.createElementNS(svgNS, 'path');
        pathSim.setAttribute('d', chartModel.pathSimCumulative);
        pathSim.setAttribute('fill', 'none');
        pathSim.setAttribute('stroke', '#F9B200');
        pathSim.setAttribute('stroke-width', '2.5');
        pathSim.setAttribute('stroke-dasharray', '4 2');
        svg.appendChild(pathSim);
      }

      // Points and Semester Labels
      chartModel.origCumulativePoints.forEach(pt => {
        const circle = this.doc.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', pt.x.toString());
        circle.setAttribute('cy', pt.y.toString());
        circle.setAttribute('r', '4');
        circle.setAttribute('fill', '#153898');
        circle.classList.add('iuh-gpa-timeline-point');
        if (pt.data && pt.data.isLatest) {
          circle.classList.add('is-latest');
        }
        svg.appendChild(circle);

        // Value text
        const vTxt = this.doc.createElementNS(svgNS, 'text');
        vTxt.setAttribute('x', pt.x.toString());
        vTxt.setAttribute('y', (pt.y - 7).toString());
        vTxt.setAttribute('text-anchor', 'middle');
        vTxt.setAttribute('font-size', '10');
        vTxt.setAttribute('font-weight', '700');
        vTxt.setAttribute('fill', '#153898');
        vTxt.textContent = pt.val.toFixed(2);
        svg.appendChild(vTxt);

        // Semester Label (X Axis)
        const xTxt = this.doc.createElementNS(svgNS, 'text');
        xTxt.setAttribute('x', pt.x.toString());
        xTxt.setAttribute('y', (chartModel.height - 12).toString());
        xTxt.setAttribute('text-anchor', 'middle');
        xTxt.setAttribute('font-size', '10');
        xTxt.setAttribute('fill', '#64748B');
        xTxt.textContent = pt.data.compactLabel || pt.data.semesterName;
        svg.appendChild(xTxt);
      });

      chartWrapper.appendChild(svg);
    }

    // Accessible Table Fallback
    tbody.textContent = '';
    timelineData.forEach(item => {
      const tr = this.doc.createElement('tr');
      const tdName = this.doc.createElement('td');
      tdName.textContent = item.semesterName;

      const tdSemGpa = this.doc.createElement('td');
      tdSemGpa.textContent = item.semesterOrigGPADisplay !== null ? item.semesterOrigGPADisplay.toFixed(2) : '--';

      const tdCumOrig = this.doc.createElement('td');
      tdCumOrig.style.fontWeight = '600';
      tdCumOrig.textContent = item.cumulativeOrigGPADisplay !== null ? item.cumulativeOrigGPADisplay.toFixed(2) : '--';

      const tdCumSim = this.doc.createElement('td');
      tdCumSim.textContent = item.cumulativeSimGPADisplay !== null ? item.cumulativeSimGPADisplay.toFixed(2) : '--';

      const tdCredits = this.doc.createElement('td');
      tdCredits.textContent = item.cumulativeCredits.toString();

      tr.appendChild(tdName);
      tr.appendChild(tdSemGpa);
      tr.appendChild(tdCumOrig);
      tr.appendChild(tdCumSim);
      tr.appendChild(tdCredits);
      tbody.appendChild(tr);
    });
  }

  /* ================== TARGET CALCULATION ================== */
  _updateTargetCalculation() {
    if (!this.container || !this._latestDerivedData) return;
    const derived = this._latestDerivedData;
    const effective = derived.hasSimulations ? derived.overallSimulated : derived.overallOriginal;
    if (!effective) return;

    // Dùng raw grade points sum
    const currentGradePoints = effective.sumWeighted4 ?? (effective.gpa4Raw ? effective.gpa4Raw * effective.gradedCredits : 0);
    const currentCredits = effective.gradedCredits || 0;

    const res = GPATargetEngine.calculateRequiredFutureGPA({
      currentGradePoints,
      currentCredits,
      targetGPA: this.targetGPA,
      remainingCredits: this.remainingCredits,
    });

    const valEl = this.container.querySelector('#iuh-gpa-target-res-value');
    const badgeEl = this.container.querySelector('#iuh-gpa-target-res-badge');
    const noticeEl = this.container.querySelector('#iuh-gpa-target-res-notice');

    if (!valEl || !badgeEl || !noticeEl) return;

    if (res.status === TARGET_STATUS.ACHIEVABLE) {
      valEl.textContent = `${res.requiredFutureAverageDisplay.toFixed(2)} / 4.00`;
      valEl.className = 'iuh-gpa-result-main text-success';
      badgeEl.textContent = res.difficulty?.label || 'Khả thi';
      badgeEl.className = 'iuh-gpa-difficulty-badge badge-achievable';
      noticeEl.textContent = `Tổng tín chỉ sau khi hoàn thành: ${res.totalCredits} TC.`;
    } else if (res.status === TARGET_STATUS.ALREADY_MET) {
      valEl.textContent = '0.00 / 4.00';
      valEl.className = 'iuh-gpa-result-main text-success';
      badgeEl.textContent = 'Đã đạt mục tiêu';
      badgeEl.className = 'iuh-gpa-difficulty-badge badge-met';
      noticeEl.textContent = res.reason || 'Điểm hiện tại đã vượt mục tiêu bạn chọn.';
    } else if (res.status === TARGET_STATUS.IMPOSSIBLE) {
      valEl.textContent = res.requiredFutureAverageDisplay !== null ? `${res.requiredFutureAverageDisplay.toFixed(2)} / 4.00` : '> 4.00';
      valEl.className = 'iuh-gpa-result-main text-danger';
      badgeEl.textContent = 'Không thể đạt';
      badgeEl.className = 'iuh-gpa-difficulty-badge badge-impossible';
      noticeEl.textContent = res.reason || 'Vượt quá mức điểm tối đa trong thang điểm 4.0.';
    } else if (res.status === TARGET_STATUS.NO_REMAINING_CREDITS) {
      valEl.textContent = '--';
      valEl.className = 'iuh-gpa-result-main';
      badgeEl.textContent = 'Chưa nhập tín chỉ còn lại';
      badgeEl.className = 'iuh-gpa-difficulty-badge';
      noticeEl.textContent = 'Vui lòng nhập số tín chỉ còn lại dự kiến lớn hơn 0.';
    } else {
      valEl.textContent = '--';
      valEl.className = 'iuh-gpa-result-main';
      badgeEl.textContent = 'Dữ liệu chưa hợp lệ';
      badgeEl.className = 'iuh-gpa-difficulty-badge';
      noticeEl.textContent = res.reason || '';
    }
  }

  /* ================== FORECAST CALCULATION ================== */
  _updateForecastCalculation() {
    if (!this.container || !this._latestDerivedData) return;
    const derived = this._latestDerivedData;
    const effective = derived.hasSimulations ? derived.overallSimulated : derived.overallOriginal;
    if (!effective) return;

    const currentGradePoints = effective.sumWeighted4 ?? (effective.gpa4Raw ? effective.gpa4Raw * effective.gradedCredits : 0);
    const currentCredits = effective.gradedCredits || 0;

    // Single point forecast
    const point = ForecastEngine.calculateProjectedGPA({
      currentGradePoints,
      currentCredits,
      futureAverage: this.forecastFutureAverage,
      remainingCredits: this.remainingCredits,
    });

    const valEl = this.container.querySelector('#iuh-gpa-forecast-proj-val');
    const rankEl = this.container.querySelector('#iuh-gpa-forecast-proj-rank');

    if (valEl && rankEl) {
      if (point.status === 'OK') {
        valEl.textContent = `${point.projectedGPADisplay.toFixed(2)} / 4.00`;
        rankEl.textContent = `Xếp loại dự kiến: ${point.classification}`;
      } else {
        valEl.textContent = '--';
        rankEl.textContent = point.reason || '';
      }
    }

    // Scenarios Table
    const tbody = this.container.querySelector('#iuh-gpa-forecast-table-body');
    if (!tbody) return;
    tbody.textContent = ''; // safe clear

    const tableRows = ForecastEngine.generateForecastTable({
      currentGradePoints,
      currentCredits,
      remainingCredits: this.remainingCredits,
      scenarios: DEFAULT_FORECAST_SCENARIOS,
    });

    tableRows.forEach(row => {
      const tr = this.doc.createElement('tr');
      const tdAvg = this.doc.createElement('td');
      tdAvg.textContent = row.futureAverage.toFixed(2);

      const tdProj = this.doc.createElement('td');
      tdProj.style.fontWeight = '600';
      tdProj.textContent = row.projectedGPADisplay !== null ? row.projectedGPADisplay.toFixed(2) : '--';

      const tdRank = this.doc.createElement('td');
      tdRank.textContent = row.classification || '--';

      tr.appendChild(tdAvg);
      tr.appendChild(tdProj);
      tr.appendChild(tdRank);
      tbody.appendChild(tr);
    });
  }

  /* ================== RESCUE CALCULATION ================== */
  _updateRescueCalculation() {
    if (!this.container || !this._latestDerivedData) return;
    const derived = this._latestDerivedData;
    const effective = derived.hasSimulations ? derived.overallSimulated : derived.overallOriginal;
    if (!effective) return;

    const currentTotalGradePoints = effective.sumWeighted4 ?? (effective.gpa4Raw ? effective.gpa4Raw * effective.gradedCredits : 0);
    const eligibleCredits = effective.gradedCredits || 0;

    // Sử dụng danh sách môn hiện tại (bao gồm cả các môn đang mô phỏng nếu có)
    const courses = derived.allSimulatedCourses || [];

    const analysis = GPARescueEngine.analyzeRescuePriorities({
      courses,
      currentTotalGradePoints,
      eligibleCredits,
      defaultTargetLetter: this.rescueTargetLetter,
    });

    const listEl = this.container.querySelector('#iuh-gpa-rescue-course-list');
    const exclEl = this.container.querySelector('#iuh-gpa-rescue-excl-notice');
    if (!listEl || !exclEl) return;

    listEl.textContent = ''; // safe clear

    if (analysis.rankedCourses.length === 0) {
      const empty = this.doc.createElement('div');
      empty.className = 'iuh-gpa-empty-notice';
      empty.textContent = 'Không có môn học nào đủ điều kiện hoặc cần cải thiện điểm.';
      listEl.appendChild(empty);
    } else {
      analysis.rankedCourses.forEach((c, idx) => {
        const item = this.doc.createElement('div');
        item.className = 'iuh-gpa-rescue-item';

        const rankPill = this.doc.createElement('span');
        rankPill.className = 'iuh-gpa-rescue-rank';
        rankPill.textContent = `#${idx + 1}`;

        const info = this.doc.createElement('div');
        info.className = 'iuh-gpa-rescue-info';

        const name = this.doc.createElement('div');
        name.className = 'iuh-gpa-rescue-name';
        name.textContent = `${c.courseName} (${c.credits} TC)`;

        const detail = this.doc.createElement('div');
        detail.className = 'iuh-gpa-rescue-detail';
        detail.textContent = `Hiện tại: ${c.currentLetter} (${c.currentGradePoint.toFixed(1)})`;

        info.appendChild(name);
        info.appendChild(detail);

        const delta = this.doc.createElement('div');
        delta.className = 'iuh-gpa-rescue-delta';

        const deltaPill = this.doc.createElement('span');
        deltaPill.className = 'iuh-gpa-delta-pill iuh-gpa-delta-up';
        deltaPill.textContent = `+${c.gpaDeltaDisplay.toFixed(3)} GPA`;

        const newGpa = this.doc.createElement('span');
        newGpa.className = 'iuh-gpa-rescue-new-gpa';
        newGpa.textContent = `nếu đạt ${c.selectedTargetLetter} (GPA mới: ${c.newCumulativeGPADisplay.toFixed(2)})`;

        delta.appendChild(deltaPill);
        delta.appendChild(newGpa);
        const courseExists = (derived.semesters || []).some(semester =>
          (semester.courses || []).some(course => course.id === c.courseId)
        );
        const targetOption = c.upgradeOptions.find(option => option.targetLetter === c.selectedTargetLetter);
        if (courseExists && targetOption && typeof targetOption.targetMin10 === 'number') {
          const applyBtn = this.doc.createElement('button');
          applyBtn.type = 'button';
          applyBtn.className = 'iuh-gpa-btn-action iuh-gpa-rescue-apply';
          applyBtn.textContent = `Mô phỏng đạt ${c.selectedTargetLetter}`;
          applyBtn.title = 'Áp dụng điểm tối thiểu của bậc mục tiêu vào mô phỏng hiện tại; không sửa bảng điểm IUH.';
          applyBtn.addEventListener('click', () => {
            if (!this.store || typeof this.store.setCourseOverride !== 'function') {
              this.showToast('Không thể áp dụng mô phỏng cải thiện cho học phần này.', 'error');
              return;
            }
            this.store.setCourseOverride(c.courseId, { score10: targetOption.targetMin10 });
            this.showToast(`Đã áp dụng giả định đạt ${c.selectedTargetLetter} cho ${c.courseName}.`, 'success');
          });
          delta.appendChild(applyBtn);
        }

        item.appendChild(rankPill);
        item.appendChild(info);
        item.appendChild(delta);
        listEl.appendChild(item);
      });
    }

    if (analysis.totalExcluded > 0) {
      exclEl.textContent = `Đã bỏ qua ${analysis.totalExcluded} môn không đủ điều kiện cải thiện:`;
      const excludedList = this.doc.createElement('ul');
      excludedList.style.margin = '6px 0 0';
      excludedList.style.paddingLeft = '20px';
      analysis.excludedCourses.forEach(course => {
        const item = this.doc.createElement('li');
        item.textContent = `${course.courseName || course.courseId || 'Học phần'}: ${course.reason}`;
        excludedList.appendChild(item);
      });
      exclEl.appendChild(excludedList);
    } else {
      exclEl.textContent = '';
    }
  }

  _getExportOptions() {
    const derived = this._latestDerivedData
      || (this.store && typeof this.store.getDerivedData === 'function' ? this.store.getDerivedData() : {});
    const source = this.container?.querySelector('#iuh-gpa-target-source-indicator')?.textContent || '';
    return {
      semesters: derived.semesters || [],
      futurePlan: derived.futurePlan || { semesters: [] },
      overallSummary: {
        original: derived.overallOriginal || {},
        simulated: derived.overallSimulated || {},
      },
      hasSimulations: Boolean(derived.hasSimulations),
      allSimulatedCourses: derived.allSimulatedCourses || [],
      curriculumGaps: derived.curriculumGaps || null,
      curriculumProgress: derived.curriculumProgress || null,
      curriculumStatus: derived.curriculumStatus || 'UNSYNCED',
      scenarioName: derived.activeScenarioName || 'Mặc định',
      analysis: {
        targetGPA: this.targetGPA,
        remainingCredits: this.remainingCredits,
        remainingCreditsSource: source,
        forecastFutureAverage: this.forecastFutureAverage,
        rescueTargetLetter: this.rescueTargetLetter,
      },
    };
  }

  _handleExportXLSX() {
    try {
      const workbook = ExportEngine.generateXLSX(this._getExportOptions());
      const fileName = generateSafeFileName('IUH-GPA-Phu-Luc-Chi-Tiet', 'xlsx');
      const success = ExportEngine.triggerDownload(
        workbook,
        fileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        this.doc
      );
      if (!success) throw new Error('Trình duyệt không thể tải tệp Excel xuống.');
      this.showToast('Đã xuất bảng điểm chi tiết và 4 mục phân tích sang Excel.', 'success');
    } catch (error) {
      console.error('[IUH-GPA] Không thể xuất Excel:', error);
      this.showToast(error.message || 'Không thể xuất tệp Excel. Vui lòng thử lại.', 'error');
    }
  }

  _handleExportCSV() {
    try {
      const options = this._getExportOptions();
      const csv = ExportEngine.generateCSV({
        semesters: options.semesters,
        scenarioName: options.scenarioName,
        overallSummary: options.overallSummary,
        futurePlan: options.futurePlan,
      });
      const fileName = generateSafeFileName('IUH-GPA-Mo-Phong', 'csv');
      const success = ExportEngine.triggerDownload(csv, fileName, 'text/csv;charset=utf-8;', this.doc);
      if (!success) throw new Error('Trình duyệt không thể tải tệp CSV xuống.');
      this.showToast('Đã xuất kết quả mô phỏng sang CSV.', 'success');
    } catch (error) {
      console.error('[IUH-GPA] Không thể xuất CSV:', error);
      this.showToast(error.message || 'Không thể xuất tệp CSV. Vui lòng thử lại.', 'error');
    }
  }


  showToast(message, type = 'info', duration = 3200) {
    const doc = this.doc;
    if (!doc || !doc.body) return;
    let container = doc.getElementById('iuh-gpa-toast-container');
    if (!container) {
      container = doc.createElement('div');
      container.id = 'iuh-gpa-toast-container';
      container.className = 'iuh-gpa-toast-container';
      doc.body.appendChild(container);
    }
    const toast = doc.createElement('div');
    toast.className = `iuh-gpa-toast iuh-gpa-toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('iuh-gpa-toast-fadeout');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  _closeActiveInlineModal() {
    const doc = this.doc;
    if (!doc) return;
    const existing = doc.getElementById('iuh-gpa-active-modal');
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }
  }

  showConfirmModal({ title = 'Xác nhận', message = '', confirmText = 'Đồng ý', cancelText = 'Hủy', onConfirm }) {
    const doc = this.doc;
    if (!doc || !doc.body) return;
    this._closeActiveInlineModal();

    const backdrop = doc.createElement('div');
    backdrop.id = 'iuh-gpa-active-modal';
    backdrop.className = 'iuh-gpa-modal-backdrop iuh-gpa-modal-overlay iuh-gpa-extension';

    const modal = doc.createElement('div');
    modal.className = 'iuh-gpa-modal-dialog iuh-gpa-modal-card';
    modal.style.maxWidth = '420px';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const header = doc.createElement('div');
    header.className = 'iuh-gpa-modal-header';
    const titleEl = doc.createElement('h3');
    titleEl.className = 'iuh-gpa-modal-title';
    titleEl.textContent = title;
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'iuh-gpa-modal-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Đóng hộp thoại');

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const body = doc.createElement('div');
    body.className = 'iuh-gpa-modal-body';
    const msgEl = doc.createElement('p');
    msgEl.style.margin = '0';
    msgEl.style.fontSize = '13.5px';
    msgEl.style.lineHeight = '1.5';
    msgEl.textContent = message;
    body.appendChild(msgEl);
    modal.appendChild(body);

    const footer = doc.createElement('div');
    footer.className = 'iuh-gpa-modal-footer';

    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'iuh-gpa-btn-action';
    cancelBtn.textContent = cancelText;

    const okBtn = doc.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'iuh-gpa-btn-primary';
    okBtn.textContent = confirmText;

    const cleanup = () => {
      if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop);
      doc.body.classList.remove('iuh-gpa-modal-open');
    };

    closeBtn.addEventListener('click', cleanup);
    cancelBtn.addEventListener('click', cleanup);
    okBtn.addEventListener('click', () => {
      cleanup();
      if (typeof onConfirm === 'function') onConfirm();
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    modal.appendChild(footer);
    backdrop.appendChild(modal);

    doc.body.classList.add('iuh-gpa-modal-open');
    doc.body.appendChild(backdrop);
    setTimeout(() => { if (okBtn.focus) okBtn.focus(); }, 50);
  }

  showPromptModal({ title = 'Nhập thông tin', message = '', defaultValue = '', placeholder = '', confirmText = 'Xác nhận', cancelText = 'Hủy', onSubmit }) {
    const doc = this.doc;
    if (!doc || !doc.body) return;
    this._closeActiveInlineModal();

    const backdrop = doc.createElement('div');
    backdrop.id = 'iuh-gpa-active-modal';
    backdrop.className = 'iuh-gpa-modal-backdrop iuh-gpa-modal-overlay iuh-gpa-extension';

    const modal = doc.createElement('div');
    modal.className = 'iuh-gpa-modal-dialog iuh-gpa-modal-card';
    modal.style.maxWidth = '420px';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const header = doc.createElement('div');
    header.className = 'iuh-gpa-modal-header';
    const titleEl = doc.createElement('h3');
    titleEl.className = 'iuh-gpa-modal-title';
    titleEl.textContent = title;
    const closeBtn = doc.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'iuh-gpa-modal-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Đóng');

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const body = doc.createElement('div');
    body.className = 'iuh-gpa-modal-body';
    if (message) {
      const msgEl = doc.createElement('p');
      msgEl.style.margin = '0 0 10px 0';
      msgEl.style.fontSize = '13.5px';
      msgEl.textContent = message;
      body.appendChild(msgEl);
    }
    const input = doc.createElement('input');
    input.type = 'text';
    input.className = 'iuh-gpa-form-control';
    input.value = defaultValue;
    input.placeholder = placeholder;
    body.appendChild(input);
    modal.appendChild(body);

    const footer = doc.createElement('div');
    footer.className = 'iuh-gpa-modal-footer';

    const cancelBtn = doc.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'iuh-gpa-btn-action';
    cancelBtn.textContent = cancelText;

    const okBtn = doc.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'iuh-gpa-btn-primary';
    okBtn.textContent = confirmText;

    const cleanup = () => {
      if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop);
      doc.body.classList.remove('iuh-gpa-modal-open');
    };

    const handleConfirm = () => {
      const val = input.value;
      cleanup();
      if (typeof onSubmit === 'function') onSubmit(val);
    };

    closeBtn.addEventListener('click', cleanup);
    cancelBtn.addEventListener('click', cleanup);
    okBtn.addEventListener('click', handleConfirm);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleConfirm();
      if (e.key === 'Escape') cleanup();
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup();
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    modal.appendChild(footer);
    backdrop.appendChild(modal);

    doc.body.classList.add('iuh-gpa-modal-open');
    doc.body.appendChild(backdrop);
    setTimeout(() => {
      if (input.focus) {
        input.focus();
        if (input.select) input.select();
      }
    }, 50);
  }

  closeFuturePlannerModal() {
    const doc = this.doc;
    if (!doc) return;
    const modal = doc.getElementById('iuh-gpa-future-planner-modal');
    if (modal && modal.parentElement) {
      modal.parentElement.removeChild(modal);
    }
    if (doc.body) {
      const prevOverflow = doc.body.getAttribute('data-iuh-gpa-prev-overflow');
      if (prevOverflow !== null) {
        doc.body.style.overflow = prevOverflow;
        doc.body.removeAttribute('data-iuh-gpa-prev-overflow');
      }
      doc.body.classList.remove('iuh-gpa-modal-open');
    }
    if (this._modalCleanupListeners) {
      try { this._modalCleanupListeners(); } catch (e) {}
      this._modalCleanupListeners = null;
    }
    const triggerBtn = doc.getElementById('iuh-gpa-table-add-semester-btn') || doc.getElementById('iuh-gpa-btn-scroll-to-plan');
    if (triggerBtn && typeof triggerBtn.focus === 'function') {
      try { triggerBtn.focus(); } catch (e) {}
    }
  }

  openFuturePlannerModal(targetSemesterId = null) {
    const doc = this.doc;
    if (!doc) return;
    const showAlert = (msg) => {
      this.showToast(msg, 'warning');
    };

    // Close any previous instance first
    this.closeFuturePlannerModal();

    // STEP 1: Prerequisite validation BEFORE touching DOM / body styles
    const derived = this._latestDerivedData || (this.store ? this.store.getDerivedData() : {});
    const fSemesters = derived.futurePlan?.semesters || [];

    if (!targetSemesterId && fSemesters.length >= 9) {
      showAlert('Đã đạt giới hạn tối đa 9 học kỳ mô phỏng.');
      return;
    }

    const hasCtk = this.store && typeof this.store.hasCurriculumModel === 'function'
      ? this.store.hasCurriculumModel()
      : !!(derived && derived.curriculumModel);

    if (!targetSemesterId && fSemesters.length >= 9) {
      showAlert('Đã đạt giới hạn tối đa 9 học kỳ mô phỏng.');
      return;
    }

    let pool = null;
    try {
      pool = this.store.getCoursePool ? this.store.getCoursePool() : null;
    } catch (err) {
      console.error('[CompanionBar] Error getting course pool:', err);
      showAlert('Không thể tải danh sách học phần từ CTK. Vui lòng thử lại.');
      return;
    }

    // STEP 2: Build complete modal DETACHED
    let backdrop = null;
    let cleanupKeydown = null;

    try {
      backdrop = doc.createElement('div');
      backdrop.id = 'iuh-gpa-future-planner-modal';
      backdrop.className = 'iuh-gpa-modal-backdrop iuh-gpa-modal-overlay iuh-gpa-extension';
      backdrop.setAttribute('data-iuh-gpa-extension', 'true');

      const modal = doc.createElement('div');
      modal.className = 'iuh-gpa-modal-dialog iuh-gpa-modal-card';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'iuh-gpa-modal-title');

      // Header
      const header = doc.createElement('div');
      header.className = 'iuh-gpa-modal-header';

      const title = doc.createElement('h3');
      title.id = 'iuh-gpa-modal-title';
      title.className = 'iuh-gpa-modal-title';
      title.textContent = targetSemesterId ? 'Thêm học phần vào học kỳ mô phỏng' : 'Thêm học kỳ mô phỏng';

      const closeBtn = doc.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'iuh-gpa-modal-close-btn';
      closeBtn.setAttribute('aria-label', 'Đóng cửa sổ');
      closeBtn.innerHTML = '&times;';

      const closeModal = () => this.closeFuturePlannerModal();

      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          closeModal();
        } else if (e.key === 'Tab') {
          const focusable = modal.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)');
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && doc.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && doc.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      doc.addEventListener('keydown', handleKeydown);
      cleanupKeydown = () => doc.removeEventListener('keydown', handleKeydown);
      this._modalCleanupListeners = cleanupKeydown;

      closeBtn.addEventListener('click', closeModal);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });

      header.appendChild(title);
      header.appendChild(closeBtn);
      modal.appendChild(header);

      // Body
      const body = doc.createElement('div');
      body.className = 'iuh-gpa-modal-body';

      // Step 1: Semester Selector
      let selectedSemesterOption = null;
      if (!targetSemesterId) {
        const step1Box = doc.createElement('div');
        step1Box.className = 'iuh-gpa-modal-section';
        step1Box.style.marginBottom = '14px';

        const semLabel = doc.createElement('label');
        semLabel.className = 'iuh-gpa-input-label';
        semLabel.style.fontWeight = '700';
        semLabel.style.marginBottom = '6px';
        semLabel.style.display = 'block';
        semLabel.textContent = '1. Chọn học kỳ mô phỏng:';

        const parsedActual = FutureSemesterEngine.parseLatestActualSemester(derived.semesters || []);
        const latestActual = parsedActual || { term: 1, startYear: 2024, endYear: 2025 };
        const existingLabels = fSemesters.map(s => s.termName || `HK${s.term} (${s.startYear} - ${s.endYear})`);
        const options = FutureSemesterEngine.generateNextSemesterOptions(latestActual, existingLabels, 9);

        if (options.length === 0) {
          showAlert('Không còn học kỳ tiếp theo khả dụng trong giới hạn 9 kỳ.');
          cleanupKeydown();
          return;
        }

        const select = doc.createElement('select');
        select.className = 'iuh-gpa-form-control';
        select.style.width = '100%';
        select.style.padding = '8px 10px';
        select.style.borderRadius = '6px';
        select.style.border = '1px solid #CBD5E1';
        select.style.fontSize = '13px';

        options.forEach(opt => {
          const o = doc.createElement('option');
          o.value = JSON.stringify(opt);
          o.textContent = opt.displayLabel;
          select.appendChild(o);
        });

        selectedSemesterOption = options[0];
        select.addEventListener('change', () => {
          try {
            selectedSemesterOption = JSON.parse(select.value);
          } catch (e) {}
        });

        step1Box.appendChild(semLabel);
        step1Box.appendChild(select);
        body.appendChild(step1Box);
      }

      // Step 2: Course Picker
      const step2Box = doc.createElement('div');
      step2Box.className = 'iuh-gpa-modal-section';

      const pLabel = doc.createElement('div');
      pLabel.className = 'iuh-gpa-input-label';
      pLabel.style.fontWeight = '700';
      pLabel.style.marginBottom = '6px';
      pLabel.textContent = targetSemesterId ? 'Chọn học phần cần thêm từ CTK:' : '2. Chọn học phần đưa vào kế hoạch (tối thiểu 1 môn):';
      step2Box.appendChild(pLabel);

      const typeHelp = doc.createElement('div');
      typeHelp.className = 'iuh-gpa-picker-type-help';
      typeHelp.textContent = 'Chọn loại môn (*) ngay trên từng dòng trước khi thêm. Môn Thực tập/Khóa luận tự chọn Đặc biệt (chỉ tính điểm Cuối kỳ).';
      step2Box.appendChild(typeHelp);

      // Search input
      const searchInp = doc.createElement('input');
      searchInp.type = 'text';
      searchInp.className = 'iuh-gpa-form-control';
      searchInp.placeholder = 'Tìm kiếm theo tên môn học hoặc mã học phần...';
      searchInp.style.width = '100%';
      searchInp.style.padding = '8px 12px';
      searchInp.style.borderRadius = '6px';
      searchInp.style.border = '1px solid #CBD5E1';
      searchInp.style.fontSize = '13px';
      searchInp.style.boxSizing = 'border-box';
      searchInp.style.marginBottom = '10px';
      step2Box.appendChild(searchInp);

      // Category Filter Buttons
      const filterNav = doc.createElement('div');
      filterNav.className = 'iuh-gpa-picker-filter-nav';
      filterNav.style.display = 'flex';
      filterNav.style.gap = '6px';
      filterNav.style.marginBottom = '10px';
      filterNav.style.flexWrap = 'wrap';

      const categories = [
        { id: 'all', label: 'Tất cả' },
        { id: 'mandatory', label: 'Bắt buộc còn lại' },
        { id: 'elective', label: 'Tự chọn còn thiếu' },
        { id: 'unregistered', label: 'Chưa học' },
        { id: 'failed', label: 'Chưa đạt' },
      ];

      let activeCategory = 'all';
      const filterBtns = [];

      categories.forEach(cat => {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = `iuh-gpa-btn-filter ${cat.id === activeCategory ? 'active' : ''}`;
        btn.style.padding = '4px 10px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '4px';
        btn.style.border = '1px solid #CBD5E1';
        btn.style.background = (cat.id === activeCategory) ? '#153898' : '#F8FAFC';
        btn.style.color = (cat.id === activeCategory) ? '#FFFFFF' : '#334155';
        btn.style.cursor = 'pointer';
        btn.textContent = cat.label;

        btn.addEventListener('click', () => {
          activeCategory = cat.id;
          filterBtns.forEach(b => {
            b.style.background = '#F8FAFC';
            b.style.color = '#334155';
            b.classList.remove('active');
          });
          btn.style.background = '#153898';
          btn.style.color = '#FFFFFF';
          btn.classList.add('active');
          applyFilter();
        });
        filterBtns.push(btn);
        filterNav.appendChild(btn);
      });
      step2Box.appendChild(filterNav);

      // Course List Container
      const courseListContainer = doc.createElement('div');
      courseListContainer.className = 'iuh-gpa-picker-course-list iuh-gpa-picker-pool';
      courseListContainer.style.maxHeight = '280px';
      courseListContainer.style.overflowY = 'auto';
      courseListContainer.style.border = '1px solid #E2E8F0';
      courseListContainer.style.borderRadius = '6px';
      courseListContainer.style.padding = '6px';

      const selectedCourseCodes = new Set();
      const selectedCourseTypes = new Map();
      const courseElements = [];

      // Map các môn đã nằm trong kế hoạch
      const plannedMap = new Map();
      fSemesters.forEach(s => {
        (s.courses || []).forEach(c => {
          const cd = c.curriculumCourseCode || c.code;
          if (cd) plannedMap.set(cd, s);
        });
      });

      const addCourseItem = (c, catId, groupSummary = null) => {
        const cCode = c.curriculumCourseCode || c.code || '';
        const cName = c.courseName || c.name || c.rawName || cCode;
        const isPlanned = plannedMap.has(cCode);
        const plannedSem = isPlanned ? plannedMap.get(cCode) : null;
        const item = doc.createElement('div');
        item.className = 'iuh-gpa-picker-course-card iuh-gpa-picker-item';
        item.setAttribute('role', 'group');
        item.setAttribute('data-course-code', cCode.toLowerCase());
        item.setAttribute('data-course-name', cName.toLowerCase());
        item.setAttribute('data-category', catId);
        item.setAttribute('aria-label', `${cName}${isPlanned ? ', đã có trong kế hoạch' : ', nhấn để chọn môn'}`);
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.padding = '8px 10px';
        item.style.borderBottom = '1px solid #F1F5F9';
        item.style.gap = '10px';

        const chk = doc.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'iuh-gpa-picker-chk';
        chk.value = cCode;
        chk.setAttribute('aria-label', `Chọn môn ${cName}`);
        if (isPlanned) {
          chk.disabled = true;
          item.style.opacity = '0.6';
        }

        chk.addEventListener('change', () => {
          if (chk.checked) {
            selectedCourseCodes.add(cCode);
            item.classList.add('selected');
          } else {
            selectedCourseCodes.delete(cCode);
            item.classList.remove('selected');
          }
          updateSelectionSummary();
        });

        item.addEventListener('click', (event) => {
          if (event.target === chk || event.target.closest('select, button, a, label') || chk.disabled) return;
          chk.checked = !chk.checked;
          chk.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
        });
        const info = doc.createElement('div');
        info.style.flex = '1';

        const nameLine = doc.createElement('div');
        nameLine.style.fontWeight = '600';
        nameLine.style.fontSize = '13px';
        nameLine.textContent = cName;

        const metaLine = doc.createElement('div');
        metaLine.style.fontSize = '11px';
        metaLine.style.color = '#64748B';
        const typeLabel = c.inferredCourseType === 'PRACTICE' ? 'Thực hành' : (c.inferredCourseType === 'COMBINED' ? 'LT+TH' : 'Lý thuyết');
        let metaText = `${cCode} · ${c.credits || 0} tín chỉ · ${typeLabel}`;
        if (groupSummary) {
          metaText += ` · ${groupSummary}`;
        }
        if (isPlanned && plannedSem) {
          const semName = plannedSem.termName || (plannedSem.term ? `HK${plannedSem.term}` : 'học kỳ dự kiến');
          metaText += ` · Đã có trong ${semName}`;
        }
        metaLine.textContent = metaText;

        info.appendChild(nameLine);
        info.appendChild(metaLine);

        const credPill = doc.createElement('span');
        credPill.style.padding = '2px 8px';
        credPill.style.borderRadius = '10px';
        credPill.style.fontSize = '11px';
        credPill.style.background = '#E0F2FE';
        credPill.style.color = '#0369A1';
        credPill.style.fontWeight = '700';
        credPill.textContent = `${c.credits || 0} TC`;

        const isAutoSpecial = FutureSemesterEngine.isSpecialCourseName(c);
        const courseTypeSelect = doc.createElement('select');
        courseTypeSelect.className = 'iuh-gpa-picker-course-type';
        courseTypeSelect.required = true;
        courseTypeSelect.disabled = isPlanned;
        courseTypeSelect.setAttribute('aria-label', `Loại môn bắt buộc cho ${cName}`);
        const typeOptions = [
          { value: '', label: 'Chọn loại môn *' },
          { value: 'THEORY', label: 'Lý thuyết' },
          { value: 'COMBINED', label: 'Kết hợp' },
          { value: 'PRACTICE', label: 'Thực hành' },
          { value: 'SPECIAL', label: 'Đặc biệt (chỉ Cuối kỳ)' },
          { value: 'EXCLUDED', label: 'Không tính GPA' },
        ];
        typeOptions.forEach(({ value, label }) => {
          const option = doc.createElement('option');
          option.value = value;
          option.textContent = label;
          courseTypeSelect.appendChild(option);
        });
        if (isAutoSpecial) {
          courseTypeSelect.value = 'SPECIAL';
          selectedCourseTypes.set(cCode, 'SPECIAL');
          courseTypeSelect.title = 'Tự động chọn Đặc biệt: chỉ nhập điểm Cuối kỳ';
        } else {
          courseTypeSelect.title = 'Bắt buộc chọn loại môn trước khi thêm vào kế hoạch';
        }
        courseTypeSelect.addEventListener('change', () => {
          if (courseTypeSelect.value) selectedCourseTypes.set(cCode, courseTypeSelect.value);
          else selectedCourseTypes.delete(cCode);
          updateSelectionSummary();
        });

        item.appendChild(chk);
        item.appendChild(info);
        item.appendChild(courseTypeSelect);
        item.appendChild(credPill);

        courseElements.push(item);
        courseListContainer.appendChild(item);
      };

      const allCoursesMap = new Map();

      if (pool) {
        (pool.mandatoryRemaining || []).forEach(c => {
          const cd = c.curriculumCourseCode || c.code;
          if (cd && !allCoursesMap.has(cd)) {
            allCoursesMap.set(cd, c);
            addCourseItem(c, 'mandatory', 'Bắt buộc còn lại');
          }
        });

        (pool.electiveGroups || []).forEach(g => {
          const rawGName = (g.groupName || g.name || g.label || '').trim();
          const cleanGName = rawGName && !rawGName.includes('undefined')
            ? rawGName
            : (g.groupId ? `Nhóm ${String(g.groupId).replace('elective_', '')}` : 'Nhóm tự chọn');
          const req = Number.isFinite(g.requiredCredits) ? g.requiredCredits : 0;
          const comp = Number.isFinite(g.completedCredits) ? g.completedCredits : 0;
          const rem = Math.max(0, req - comp);
          const summary = `Nhóm: ${cleanGName} (Cần: ${req} TC, Còn thiếu: ${rem} TC)`;
          (g.courses || []).forEach(c => {
            const cd = c.curriculumCourseCode || c.code;
            if (cd && !allCoursesMap.has(cd)) {
              allCoursesMap.set(cd, c);
              addCourseItem(c, 'elective', summary);
            }
          });
        });

        (pool.unregistered || []).forEach(c => {
          const cd = c.curriculumCourseCode || c.code;
          if (cd && !allCoursesMap.has(cd)) {
            allCoursesMap.set(cd, c);
            addCourseItem(c, 'unregistered', 'Chưa học');
          }
        });

        (pool.failedRetake || []).forEach(c => {
          const cd = c.curriculumCourseCode || c.code;
          if (cd && !allCoursesMap.has(cd)) {
            allCoursesMap.set(cd, c);
            addCourseItem(c, 'failed', 'Cần học lại (Chưa đạt)');
          }
        });

        (pool.allAvailable || []).forEach(c => {
          const cd = c.curriculumCourseCode || c.code;
          if (cd && !allCoursesMap.has(cd)) {
            allCoursesMap.set(cd, c);
            addCourseItem(c, 'all', 'Khác');
          }
        });
      }

      if (courseElements.length === 0) {
        const emptyMsg = doc.createElement('div');
        emptyMsg.style.padding = '20px';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = '#64748B';
        if (!hasCtk) {
          emptyMsg.innerHTML = '<p style="margin-bottom:8px;">Đang chờ đồng bộ Chương trình khung để lập kế hoạch.</p>';
          if (this.onCurriculumRefresh) {
            const syncBtn = doc.createElement('button');
            syncBtn.type = 'button';
            syncBtn.className = 'iuh-gpa-btn-action';
            syncBtn.textContent = 'Đồng bộ CTK';
            syncBtn.addEventListener('click', () => {
              this.onCurriculumRefresh();
              closeModal();
            });
            emptyMsg.appendChild(syncBtn);
          }
        } else {
          emptyMsg.textContent = 'Không có học phần nào khả dụng từ Chương trình khung.';
        }
        courseListContainer.appendChild(emptyMsg);
      }

      const applyFilter = () => {
        const q = searchInp.value.trim().toLowerCase();
        courseElements.forEach(el => {
          const cCode = el.getAttribute('data-course-code') || '';
          const cName = el.getAttribute('data-course-name') || '';
          const cCat = el.getAttribute('data-category') || '';

          const matchSearch = !q || cCode.includes(q) || cName.includes(q);
          const matchCat = (activeCategory === 'all') || (cCat === activeCategory);

          el.style.display = (matchSearch && matchCat) ? 'flex' : 'none';
        });
      };

      searchInp.addEventListener('input', applyFilter);
      step2Box.appendChild(courseListContainer);
      body.appendChild(step2Box);
      modal.appendChild(body);

      // Footer
      const footer = doc.createElement('div');
      footer.className = 'iuh-gpa-modal-footer';

      const summaryText = doc.createElement('div');
      summaryText.id = 'iuh-gpa-picker-selection-summary';
      summaryText.style.fontSize = '13px';
      summaryText.style.fontWeight = '600';
      summaryText.style.color = '#153898';
      summaryText.textContent = 'Đã chọn 0 môn · 0 tín chỉ';
      footer.appendChild(summaryText);

      const btnGroup = doc.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '8px';

      const cancelBtn = doc.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'iuh-gpa-btn-cancel iuh-gpa-btn-action';
      cancelBtn.textContent = 'Hủy';
      cancelBtn.addEventListener('click', closeModal);

      const confirmBtn = doc.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'iuh-gpa-btn-confirm iuh-gpa-btn-primary';
      confirmBtn.textContent = targetSemesterId ? 'Thêm vào học kỳ' : 'Thêm học kỳ';
      confirmBtn.disabled = true; // Minimum 1 course required

      const updateSelectionSummary = () => {
        const count = selectedCourseCodes.size;
        let totalCreds = 0;
        let missingTypes = 0;
        selectedCourseCodes.forEach(code => {
          const c = allCoursesMap.get(code);
          if (c) totalCreds += (c.credits || 0);
          if (!selectedCourseTypes.has(code)) missingTypes++;
        });
        summaryText.textContent = `Đã chọn ${count} môn · ${totalCreds} tín chỉ${missingTypes ? ` · Cần chọn loại môn cho ${missingTypes} môn` : ''}`;
        confirmBtn.disabled = (count === 0 || missingTypes > 0);
      };

      confirmBtn.addEventListener('click', () => {
        if (selectedCourseCodes.size === 0) return;

        const coursesToAdd = Array.from(selectedCourseCodes)
          .map(code => allCoursesMap.get(code))
          .filter(Boolean)
          .map(course => ({
            ...course,
            courseTypeOverride: selectedCourseTypes.get(course.curriculumCourseCode || course.code),
          }));

        if (targetSemesterId) {
          coursesToAdd.forEach(c => {
            this.store.addFutureCourse(targetSemesterId, c, {
              courseTypeOverride: c.courseTypeOverride,
            });
          });
        } else if (selectedSemesterOption) {
          this.store.addFutureSemester({
            term: selectedSemesterOption.term,
            startYear: selectedSemesterOption.startYear,
            endYear: selectedSemesterOption.endYear,
            isFuture: true,
            courses: coursesToAdd,
          });
        }

        closeModal();
      });

      btnGroup.appendChild(cancelBtn);
      btnGroup.appendChild(confirmBtn);
      footer.appendChild(btnGroup);

      modal.appendChild(footer);
      backdrop.appendChild(modal);

      // STEP 3: Append detached backdrop to document.body
      doc.body.appendChild(backdrop);

      // STEP 4: Lock body scroll only after successful append
      if (!doc.body.hasAttribute('data-iuh-gpa-prev-overflow')) {
        doc.body.setAttribute('data-iuh-gpa-prev-overflow', doc.body.style.overflow || '');
      }
      doc.body.style.overflow = 'hidden';
      doc.body.classList.add('iuh-gpa-modal-open');

    } catch (buildErr) {
      console.error('[CompanionBar] Error during modal construction:', buildErr);
      if (backdrop && backdrop.parentElement) {
        backdrop.parentElement.removeChild(backdrop);
      }
      if (cleanupKeydown) cleanupKeydown();
      this.closeFuturePlannerModal();
      showAlert('Không thể mở trình lập kế hoạch học tập. Vui lòng thử lại.');
    }
  }

  initStickyScrollWatcher() {
    if (!this.container || !this.doc) return;
    const doc = this.doc;
    const win = doc.defaultView;
    const bar = this.container;

    // Detect school navbar height
    const detectNavbarHeight = () => {
      let navHeight = 0;
      const candidates = ['.navbar-fixed-top', '.main-header', 'header.navbar', '.header-top', 'header', '#navbar', '#header'];
      let targetEl = null;
      for (const sel of candidates) {
        const el = doc.querySelector(sel);
        if (el) {
          const style = (win && typeof win.getComputedStyle === 'function') ? win.getComputedStyle(el) : null;
          if (style && (style.position === 'fixed' || style.position === 'sticky')) {
            const rect = (typeof el.getBoundingClientRect === 'function') ? el.getBoundingClientRect() : null;
            if (rect && rect.height > 0) {
              navHeight = Math.round(rect.height);
              targetEl = el;
              break;
            }
          }
        }
      }
      bar.style.top = `${navHeight}px`;
      if (doc.documentElement && doc.documentElement.style) {
        doc.documentElement.style.setProperty('--iuh-gpa-navbar-height', `${navHeight}px`);
        doc.documentElement.style.setProperty('--iuh-gpa-sticky-top', `${navHeight}px`);
      }
      return { navHeight, targetEl };
    };

    let { navHeight, targetEl } = detectNavbarHeight();

    let resizeObserver = null;
    if (win && typeof win.ResizeObserver === 'function') {
      try {
        resizeObserver = new win.ResizeObserver((entries) => {
          for (const entry of entries) {
            const newHeight = Math.round(entry.contentRect ? entry.contentRect.height : entry.target.getBoundingClientRect().height);
            if (newHeight > 0 && Math.abs(newHeight - navHeight) >= 1) {
              navHeight = newHeight;
              bar.style.top = `${navHeight}px`;
              if (doc.documentElement && doc.documentElement.style) {
                doc.documentElement.style.setProperty('--iuh-gpa-navbar-height', `${navHeight}px`);
                doc.documentElement.style.setProperty('--iuh-gpa-sticky-top', `${navHeight}px`);
              }
            }
          }
        });
        if (targetEl) {
          resizeObserver.observe(targetEl);
        }
      } catch (e) {}
    }

    const onResize = () => {
      const res = detectNavbarHeight();
      navHeight = res.navHeight;
      if (res.targetEl && res.targetEl !== targetEl && resizeObserver) {
        try {
          if (targetEl) resizeObserver.unobserve(targetEl);
          targetEl = res.targetEl;
          resizeObserver.observe(targetEl);
        } catch (e) {}
      }
    };

    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('resize', onResize, { passive: true });
    }

    this._cleanupStickyWatcher = () => {
      if (resizeObserver) {
        try { resizeObserver.disconnect(); } catch (e) {}
      }
      if (win && typeof win.removeEventListener === 'function') {
        win.removeEventListener('resize', onResize);
      }
    };
  }

  destroy() {
    if (this._unsubscribe) this._unsubscribe();
    if (this._cleanupStickyWatcher) this._cleanupStickyWatcher();
    if (this.doc && this.doc.body) {
      this.doc.body.classList.remove('iuh-gpa-companion-mounted');
    }
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CompanionBar, createSvgIcon };
  }
  const targets = [];
  if (typeof globalThis !== 'undefined') targets.push(globalThis);
  if (typeof window !== 'undefined' && !targets.includes(window)) targets.push(window);
  if (typeof global !== 'undefined' && !targets.includes(global)) targets.push(global);
  targets.forEach(t => {
    t.IUHGPA = t.IUHGPA || {};
    t.IUHGPA.ui = t.IUHGPA.ui || {};
    t.IUHGPA.ui.CompanionBar = CompanionBar;
    t._IUHCompanionBar = { CompanionBar, createSvgIcon };
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
