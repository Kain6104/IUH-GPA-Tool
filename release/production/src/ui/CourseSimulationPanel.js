(function (global) {
  'use strict';

  const reqScoreMod = (typeof require !== 'undefined')
    ? require('../core/RequiredScoreEngine.js')
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core : (global._IUHRequiredScoreEngine || {}));
  const RequiredScoreEngine = reqScoreMod.RequiredScoreEngine;
  const GradeBoundaryAssistant = reqScoreMod.GradeBoundaryAssistant;
  const REQUIRED_SCORE_STATUS = reqScoreMod.REQUIRED_SCORE_STATUS;

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('../core/GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

  const RiskEngine = (typeof require !== 'undefined')
    ? require('../core/RiskEngine.js').RiskEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.RiskEngine
        ? global.IUHGPA.core.RiskEngine
        : (global._IUHRiskEngine ? global._IUHRiskEngine.RiskEngine : null));

  const numParserMod = (typeof require !== 'undefined')
    ? require('../parsers/NumberParser.js')
    : (global.IUHGPA && global.IUHGPA.parsers && global.IUHGPA.parsers.NumberParser ? global.IUHGPA.parsers.NumberParser : (global.IUHGPA && global.IUHGPA.parsers ? global.IUHGPA.parsers : (global._IUHNumberParser || {})));
  const parseScore = numParserMod.parseScore;

class CourseSimulationPanel {
  /**
   * @param {Object} options
   * @param {Object} options.course - Course object từ derivedData
   * @param {HTMLTableRowElement} options.targetRow - Hàng môn học trong table IUH
   * @param {import('../state/SimulationStore.js').SimulationStore} options.store
   * @param {Function} [options.onClose]
   */
  constructor({ course, targetRow, store, onClose }) {
    this.course = course;
    this.targetRow = targetRow;
    this.doc = (targetRow && targetRow.ownerDocument) ? targetRow.ownerDocument : (typeof document !== 'undefined' ? document : null);
    this.store = store;
    this.onClose = onClose;
    this.panelRow = null;

    this.render();
  }

  render() {
    const doc = this.doc;
    if (!doc) return;

    // 1. Tạo hàng tr mới cho bảng, có thuộc tính để IUHPageAdapter bỏ qua
    const panelRow = doc.createElement('tr');
    panelRow.className = 'iuh-gpa-extension iuh-gpa-course-panel-row';
    panelRow.setAttribute('data-iuh-gpa-extension', 'true');

    const panelCell = doc.createElement('td');
    panelCell.className = 'iuh-gpa-course-panel-cell';
    panelCell.colSpan = 27; // Trải dài toàn bộ 27 cột gốc chuẩn IUH

    const panel = doc.createElement('div');
    panel.className = 'iuh-gpa-panel';

    // A. Title Bar
    const titleBar = doc.createElement('div');
    titleBar.className = 'iuh-gpa-panel-title-bar';

    const info = doc.createElement('div');
    info.className = 'iuh-gpa-panel-course-info';

    const courseTitle = doc.createElement('div');
    courseTitle.className = 'iuh-gpa-panel-course-name';
    courseTitle.textContent = `MÔ PHỎNG: ${this.course.courseName || 'Môn học'} (${this.course.courseClassCode || ''}) · ${this.course.credits} Tín chỉ`;

    const rule = GradingRuleEngine.detectRule(this.course);
    const ruleTag = doc.createElement('div');
    ruleTag.className = 'iuh-gpa-panel-rule-tag';

    const ruleLbl = doc.createElement('span');
    ruleLbl.textContent = 'Quy tắc: ';
    const ruleBadge = doc.createElement('span');
    ruleBadge.className = 'iuh-gpa-panel-rule-badge';
    ruleBadge.textContent = rule.name;
    const ruleLocalTag = doc.createElement('span');
    ruleLocalTag.style.color = '#C2410C';
    ruleLocalTag.style.fontWeight = '600';
    ruleLocalTag.textContent = ' [Mô phỏng cục bộ]';

    ruleTag.appendChild(ruleLbl);
    ruleTag.appendChild(ruleBadge);
    ruleTag.appendChild(ruleLocalTag);

    info.appendChild(courseTitle);
    info.appendChild(ruleTag);

    const closeBtnTop = doc.createElement('button');
    closeBtnTop.type = 'button';
    closeBtnTop.className = 'iuh-gpa-btn-close';
    closeBtnTop.textContent = 'Đóng';
    closeBtnTop.addEventListener('click', () => this.destroy());

    titleBar.appendChild(info);
    titleBar.appendChild(closeBtnTop);
    panel.appendChild(titleBar);

    // B. Risk / Attention Banner (Cảnh báo học phần)
    const risk = RiskEngine.assessCourseRisk(this.course);
    const riskBanner = doc.createElement('div');
    riskBanner.className = `iuh-gpa-risk-banner risk-${risk.status.toLowerCase()}`;

    const riskHeader = doc.createElement('div');
    riskHeader.className = 'iuh-gpa-risk-header';

    const riskBadge = doc.createElement('span');
    riskBadge.className = `iuh-gpa-risk-badge badge-${risk.status.toLowerCase()}`;
    riskBadge.textContent = `Mức chú ý: ${risk.label}`;

    const riskReason = doc.createElement('span');
    riskReason.className = 'iuh-gpa-risk-reason';
    riskReason.textContent = risk.reason;

    riskHeader.appendChild(riskBadge);
    riskHeader.appendChild(riskReason);
    riskBanner.appendChild(riskHeader);

    const riskDisclaimer = doc.createElement('div');
    riskDisclaimer.className = 'iuh-gpa-disclaimer-note';
    riskDisclaimer.textContent = 'Phân tích hỗ trợ của tiện ích, không phải đánh giá chính thức của IUH.';
    riskBanner.appendChild(riskDisclaimer);

    panel.appendChild(riskBanner);

    // C. Simulator Controls (Slider + Number Input + Stats Box)
    const controls = doc.createElement('div');
    controls.className = 'iuh-gpa-sim-controls';

    // Cột trái: Điều khiển điểm cuối kỳ
    const leftControl = doc.createElement('div');
    leftControl.className = 'iuh-gpa-control-section';

    const sectionLabel = doc.createElement('div');
    sectionLabel.className = 'iuh-gpa-section-label';
    const origFinalText = this.course.originalFinal !== null ? this.course.originalFinal.toFixed(1) : 'Chưa có';
    sectionLabel.innerHTML = `<span>ĐIỂM THI CUỐI KỲ MÔ PHỎNG</span> <span class="iuh-gpa-orig-tag">Gốc: ${origFinalText}</span>`;

    const sliderGroup = doc.createElement('div');
    sliderGroup.className = 'iuh-gpa-slider-group';

    const currentFinal = typeof this.course.simulatedFinal === 'number'
      ? this.course.simulatedFinal
      : (this.course.originalFinal !== null ? this.course.originalFinal : 5.0);

    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.className = 'iuh-gpa-range-slider';
    slider.min = '0';
    slider.max = '10';
    slider.step = '0.1';
    slider.value = String(currentFinal);
    slider.setAttribute('aria-label', `Điểm cuối kỳ mô phỏng môn ${this.course.courseName}`);

    const numInput = doc.createElement('input');
    numInput.type = 'text';
    numInput.className = 'iuh-gpa-number-input';
    numInput.value = currentFinal.toFixed(1);
    numInput.setAttribute('aria-label', 'Nhập điểm cuối kỳ');

    // Đồng bộ Slider -> Input & State
    slider.addEventListener('input', () => {
      const val = parseFloat(slider.value);
      numInput.value = val.toFixed(1);
      this._applyFinalScore(val);
    });

    // Đồng bộ Input -> Slider & State
    numInput.addEventListener('change', () => {
      const parsed = parseScore(numInput.value);
      if (parsed.status === 'ok' && parsed.value >= 0 && parsed.value <= 10) {
        slider.value = String(parsed.value);
        numInput.value = parsed.value.toFixed(1);
        this._applyFinalScore(parsed.value);
      } else {
        numInput.value = slider.value;
      }
    });

    sliderGroup.appendChild(slider);
    sliderGroup.appendChild(numInput);
    leftControl.appendChild(sectionLabel);
    leftControl.appendChild(sliderGroup);

    // Cột phải: Outcome Stats realtime
    const outcomeBox = doc.createElement('div');
    outcomeBox.className = 'iuh-gpa-outcome-box';
    outcomeBox.id = `iuh-gpa-outcome-${this.course.id}`;

    outcomeBox.innerHTML = `
      <div class="iuh-gpa-stat-item">
        <span class="iuh-gpa-stat-label">Tổng kết</span>
        <span class="iuh-gpa-stat-val simulated" id="stat-total">${this.course.score10 !== null ? this.course.score10.toFixed(1) : '--'}</span>
      </div>
      <div class="iuh-gpa-stat-item">
        <span class="iuh-gpa-stat-label">Thang 4</span>
        <span class="iuh-gpa-stat-val" id="stat-s4">${this.course.score4 !== null ? this.course.score4.toFixed(1) : '--'}</span>
      </div>
      <div class="iuh-gpa-stat-item">
        <span class="iuh-gpa-stat-label">Điểm chữ</span>
        <span class="iuh-gpa-stat-val" id="stat-letter">${this.course.letter || '--'}</span>
      </div>
      <div class="iuh-gpa-stat-item">
        <span class="iuh-gpa-stat-label">Trạng thái</span>
        <span class="iuh-gpa-stat-val" id="stat-pass" style="color:${this.course.passed ? '#059669' : '#DC2626'}">${this.course.passed ? 'ĐẠT' : 'RỚT'}</span>
      </div>
    `;

    controls.appendChild(leftControl);
    controls.appendChild(outcomeBox);
    panel.appendChild(controls);

    // C. Grade Boundary Assistant Banner
    const boundaryBanner = doc.createElement('div');
    boundaryBanner.className = 'iuh-gpa-boundary-banner';
    boundaryBanner.id = `iuh-gpa-boundary-${this.course.id}`;
    panel.appendChild(boundaryBanner);

    // D. Required Score Table
    const targetsSection = doc.createElement('div');
    targetsSection.className = 'iuh-gpa-targets-container';

    const targetsHeading = doc.createElement('div');
    targetsHeading.style.fontSize = '12px';
    targetsHeading.style.fontWeight = '600';
    targetsHeading.style.color = 'var(--iuh-text)';
    targetsHeading.textContent = 'MỤC TIÊU ĐIỂM CUỐI KỲ CẦN ĐẠT:';
    targetsSection.appendChild(targetsHeading);

    const table = doc.createElement('table');
    table.className = 'iuh-gpa-targets-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Mục tiêu</th>
          <th>Điểm tổng kết cần</th>
          <th>Điểm cuối kỳ yêu cầu (CK)</th>
          <th>Trạng thái</th>
        </tr>
      </thead>
      <tbody id="iuh-gpa-targets-tbody-${this.course.id}"></tbody>
    `;
    targetsSection.appendChild(table);
    panel.appendChild(targetsSection);

    // E. Panel Actions
    const actions = doc.createElement('div');
    actions.className = 'iuh-gpa-panel-actions';

    const revertBtn = doc.createElement('button');
    revertBtn.type = 'button';
    revertBtn.className = 'iuh-gpa-btn-revert';
    revertBtn.textContent = 'Khôi phục môn này';
    revertBtn.addEventListener('click', () => {
      this.store.resetCourse(this.course.id);
      this.destroy();
    });

    const closeBtnBottom = doc.createElement('button');
    closeBtnBottom.type = 'button';
    closeBtnBottom.className = 'iuh-gpa-btn-close';
    closeBtnBottom.textContent = 'Đóng';
    closeBtnBottom.addEventListener('click', () => this.destroy());

    actions.appendChild(revertBtn);
    actions.appendChild(closeBtnBottom);
    panel.appendChild(actions);

    panelCell.appendChild(panel);
    panelRow.appendChild(panelCell);

    // Chèn panel ngay sau hàng môn học
    this.targetRow.insertAdjacentElement('afterend', panelRow);
    this.panelRow = panelRow;

    // Cập nhật nội dung bảng targets và boundary assistant
    this._refreshCalculations();
  }

  _applyFinalScore(finalScore) {
    this.store.setCourseOverride(this.course.id, {
      finalExam: finalScore,
    });

    const derived = this.store.getDerivedData();
    const updated = derived.semesters
      ?.flatMap(s => s.courses)
      ?.find(c => c.id === this.course.id);

    if (updated) {
      this.course = updated;
      this._refreshCalculations();
    }
  }

  _refreshCalculations() {
    if (!this.panelRow || !this.doc) return;
    const doc = this.doc;

    // 1. Cập nhật Outcome stats
    const totalEl = this.panelRow.querySelector('#stat-total');
    const s4El = this.panelRow.querySelector('#stat-s4');
    const letterEl = this.panelRow.querySelector('#stat-letter');
    const passEl = this.panelRow.querySelector('#stat-pass');

    if (totalEl) totalEl.textContent = this.course.score10 !== null ? this.course.score10.toFixed(1) : '--';
    if (s4El) s4El.textContent = this.course.score4 !== null ? this.course.score4.toFixed(1) : '--';
    if (letterEl) letterEl.textContent = this.course.letter || '--';
    if (passEl) {
      passEl.textContent = this.course.passed ? 'ĐẠT' : 'RỚT';
      passEl.style.color = this.course.passed ? '#059669' : '#DC2626';
    }

    // 2. Cập nhật Grade Boundary Assistant
    const boundaryBanner = this.panelRow.querySelector(`#iuh-gpa-boundary-${this.course.id}`);
    if (boundaryBanner && this.course.score10 !== null) {
      const analysis = GradeBoundaryAssistant.analyzeBoundary({
        currentTotal10: this.course.score10,
        course: this.course,
      });

      if (analysis && !analysis.isTopBand && analysis.nextLetter) {
        let reqText = '';
        if (analysis.requiredFinalForNext && analysis.requiredFinalForNext.status === REQUIRED_SCORE_STATUS.ACHIEVABLE) {
          reqText = ` (CK tối thiểu cần ≥ ${analysis.requiredFinalForNext.minimumSelectableScore.toFixed(1)})`;
        } else if (analysis.requiredFinalForNext && analysis.requiredFinalForNext.status === REQUIRED_SCORE_STATUS.IMPOSSIBLE) {
          reqText = ' (Không còn khả thi trong thang điểm 10)';
        }

        boundaryBanner.innerHTML = `
          <span>Hiện tại: <strong>${analysis.currentLetter}</strong> (${analysis.currentClassification}) · Còn thiếu <strong>${analysis.deficit10.toFixed(2)}</strong> điểm tổng kết để lên bậc <strong>${analysis.nextLetter}</strong>${reqText}</span>
          <span style="font-size:11px; color:var(--iuh-text-muted);">Ngưỡng: ≥ ${analysis.nextMin10.toFixed(1)}</span>
        `;
        boundaryBanner.style.display = 'flex';
      } else if (analysis && analysis.isTopBand) {
        boundaryBanner.innerHTML = '<span>Chúc mừng! Điểm hiện tại đã đạt bậc cao nhất <strong>A+ (Xuất sắc)</strong>.</span>';
        boundaryBanner.style.display = 'flex';
      } else {
        boundaryBanner.style.display = 'none';
      }
    }

    // 3. Cập nhật Required Score Table
    const tbody = this.panelRow.querySelector(`#iuh-gpa-targets-tbody-${this.course.id}`);
    if (tbody) {
      tbody.innerHTML = '';
      const targets = RequiredScoreEngine.calculateAllTargets(this.course);

      targets.forEach(t => {
        const tr = doc.createElement('tr');

        let statusBadge = '';
        let reqScoreText = '--';

        if (t.status === REQUIRED_SCORE_STATUS.ACHIEVABLE) {
          reqScoreText = `≥ ${t.minimumSelectableScore.toFixed(1)}`;
          if (t.adjustedByMinFinal) {
            statusBadge = '<span class="iuh-gpa-badge-target iuh-gpa-badge-min-final">Điểm liệt (≥ 3.0)</span>';
          } else {
            statusBadge = '<span class="iuh-gpa-badge-target iuh-gpa-badge-need">Khả thi</span>';
          }
        } else if (t.status === REQUIRED_SCORE_STATUS.ALREADY_ACHIEVED) {
          reqScoreText = '0.0';
          statusBadge = '<span class="iuh-gpa-badge-target iuh-gpa-badge-achieved">Đã đạt</span>';
        } else if (t.status === REQUIRED_SCORE_STATUS.IMPOSSIBLE) {
          reqScoreText = t.requiredScoreRaw ? `> 10 (${t.requiredScoreRaw.toFixed(1)})` : '> 10';
          statusBadge = '<span class="iuh-gpa-badge-target iuh-gpa-badge-impossible">Không khả thi</span>';
        } else if (t.status === REQUIRED_SCORE_STATUS.BLOCKED_BY_MINIMUM_CONDITION) {
          reqScoreText = 'Bị chặn';
          statusBadge = `<span class="iuh-gpa-badge-target iuh-gpa-badge-impossible">${t.reason}</span>`;
        } else if (t.status === REQUIRED_SCORE_STATUS.INSUFFICIENT_DATA) {
          reqScoreText = 'Thiếu điểm QT';
          statusBadge = '<span class="iuh-gpa-badge-target iuh-gpa-badge-min-final">Chưa đủ dữ liệu</span>';
        } else if (t.status === REQUIRED_SCORE_STATUS.NOT_APPLICABLE) {
          reqScoreText = 'Không áp dụng';
          statusBadge = '<span class="iuh-gpa-badge-target">Môn không thi CK</span>';
        } else {
          reqScoreText = '--';
          statusBadge = `<span class="iuh-gpa-badge-target">${t.reason || 'Chưa rõ'}</span>`;
        }

        tr.innerHTML = `
          <td><strong>${t.label}</strong></td>
          <td>≥ ${t.min10.toFixed(1)}</td>
          <td style="font-weight:700; color:var(--iuh-primary);">${reqScoreText}</td>
          <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  destroy() {
    if (this.panelRow && this.panelRow.parentElement) {
      this.panelRow.parentElement.removeChild(this.panelRow);
      this.panelRow = null;
    }
    if (typeof this.onClose === 'function') {
      this.onClose();
    }
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CourseSimulationPanel };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.ui = root.ui || Object.create(null);
    root.ui.CourseSimulationPanel = CourseSimulationPanel;
    global._IUHCourseSimulationPanel = { CourseSimulationPanel };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
