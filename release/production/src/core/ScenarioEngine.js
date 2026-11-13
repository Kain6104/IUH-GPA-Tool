(function (global) {
  'use strict';

  const GPAEngine = (typeof require !== 'undefined')
    ? require('./GPAEngine.js').GPAEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GPAEngine
        ? global.IUHGPA.core.GPAEngine
        : (global._IUHGPAEngine ? global._IUHGPAEngine.GPAEngine : null));

/**
 * Deep clone an object using standard JSON serialization
 * @param {Object} obj
 * @returns {Object}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return JSON.parse(JSON.stringify(obj));
}

class ScenarioEngine {
  /**
   * Tạo Scenario Manager quản lý danh sách các kịch bản
   * @param {Object} [options]
   * @param {string} [options.defaultScenarioName='Kịch bản mặc định']
   */
  constructor(options = {}) {
    const defaultName = options.defaultScenarioName || 'Kịch bản mặc định';
    const initialId = 'scenario_default';

    /** @type {Map<string, Object>} */
    this._scenarios = new Map();

    const defaultScenario = {
      id: initialId,
      name: defaultName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      courseOverrides: {}, // Keyed by courseId: { finalExam: number, ... }
      futurePlan: { semesters: [] },
    };

    this._scenarios.set(initialId, defaultScenario);
    this._activeScenarioId = initialId;
  }

  /**
   * Lấy ID kịch bản đang kích hoạt
   * @returns {string}
   */
  getActiveScenarioId() {
    return this._activeScenarioId;
  }

  /**
   * Lấy kịch bản đang kích hoạt (bản copy)
   * @returns {Object}
   */
  getActiveScenario() {
    const sc = this._scenarios.get(this._activeScenarioId);
    return sc ? deepClone(sc) : null;
  }

  /**
   * Lấy danh sách tất cả các kịch bản hiện có
   * @returns {Array<Object>}
   */
  getAllScenarios() {
    const list = [];
    for (const sc of this._scenarios.values()) {
      list.push(deepClone(sc));
    }
    return list;
  }

  /**
   * Lấy một kịch bản theo ID
   * @param {string} id
   * @returns {Object|null}
   */
  getScenario(id) {
    const sc = this._scenarios.get(id);
    return sc ? deepClone(sc) : null;
  }

  /**
   * Tạo một kịch bản mới
   * @param {string} name
   * @param {Object} [initialOverrides={}]
   * @returns {Object} Created scenario
   */
  createScenario(name, initialOverrides = {}, initialFuturePlan = null) {
    const trimmedName = typeof name === 'string' && name.trim().length > 0
      ? name.trim()
      : `Kịch bản ${this._scenarios.size + 1}`;

    const id = `scenario_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSc = {
      id,
      name: trimmedName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      courseOverrides: deepClone(initialOverrides) || {},
      futurePlan: deepClone(initialFuturePlan) || { semesters: [] },
    };

    this._scenarios.set(id, newSc);
    return deepClone(newSc);
  }

  /**
   * Đổi tên kịch bản
   * @param {string} id
   * @param {string} newName
   * @returns {boolean}
   */
  renameScenario(id, newName) {
    if (!id || typeof newName !== 'string' || newName.trim().length === 0) {
      return false;
    }
    const sc = this._scenarios.get(id);
    if (!sc) return false;

    sc.name = newName.trim();
    sc.updatedAt = Date.now();
    return true;
  }

  /**
   * Nhân bản một kịch bản (Clone)
   * ĐẢM BẢO: Deep copy toàn bộ deltas & futurePlan; không chia sẻ mutable reference!
   * @param {string} sourceId
   * @param {string} [cloneName]
   * @returns {Object|null}
   */
  cloneScenario(sourceId, cloneName) {
    const source = this._scenarios.get(sourceId);
    if (!source) return null;

    const name = cloneName && cloneName.trim().length > 0
      ? cloneName.trim()
      : `${source.name} (Bản sao)`;

    return this.createScenario(name, source.courseOverrides, source.futurePlan);
  }

  /**
   * Lấy futurePlan của kịch bản
   * @param {string} [scenarioId]
   * @returns {Object}
   */
  getFuturePlan(scenarioId = null) {
    const targetId = scenarioId || this._activeScenarioId;
    const sc = this._scenarios.get(targetId);
    if (!sc || !sc.futurePlan) return { semesters: [] };
    return deepClone(sc.futurePlan);
  }

  /**
   * Cập nhật futurePlan của kịch bản
   * @param {Object} futurePlan
   * @param {string} [scenarioId]
   * @returns {boolean}
   */
  setFuturePlan(futurePlan, scenarioId = null) {
    const targetId = scenarioId || this._activeScenarioId;
    const sc = this._scenarios.get(targetId);
    if (!sc) return false;
    sc.futurePlan = deepClone(futurePlan) || { semesters: [] };
    sc.updatedAt = Date.now();
    return true;
  }

  /**
   * Kích hoạt một kịch bản
   * @param {string} id
   * @returns {boolean}
   */
  activateScenario(id) {
    if (!this._scenarios.has(id)) return false;
    this._activeScenarioId = id;
    return true;
  }

  /**
   * Xóa một kịch bản
   * ĐẢM BẢO: Không cho phép xóa kịch bản cuối cùng (luôn phải còn ít nhất 1 kịch bản)
   * Nếu xóa kịch bản đang active, tự động switch sang kịch bản còn lại đầu tiên
   * @param {string} id
   * @returns {{ success: boolean, reason?: string }}
   */
  deleteScenario(id) {
    if (this._scenarios.size <= 1) {
      return { success: false, reason: 'Không thể xóa kịch bản duy nhất còn lại.' };
    }
    if (!this._scenarios.has(id)) {
      return { success: false, reason: 'Kịch bản không tồn tại.' };
    }

    this._scenarios.delete(id);

    // Nếu vừa xóa active scenario, chuyển sang kịch bản đầu tiên có sẵn
    if (this._activeScenarioId === id) {
      const firstAvailableId = this._scenarios.keys().next().value;
      this._activeScenarioId = firstAvailableId;
    }

    return { success: true };
  }

  /**
   * Cập nhật delta điểm cho một môn trong kịch bản active
   * @param {string} courseId
   * @param {Object} delta - e.g. { finalExam: 8.5 }
   * @param {string} [scenarioId] - Mặc định là active scenario
   * @returns {boolean}
   */
  setOverride(courseId, delta, scenarioId = null) {
    const targetId = scenarioId || this._activeScenarioId;
    const sc = this._scenarios.get(targetId);
    if (!sc || !courseId) return false;

    if (!sc.courseOverrides) {
      sc.courseOverrides = {};
    }

    if (delta === null) {
      delete sc.courseOverrides[courseId];
    } else {
      sc.courseOverrides[courseId] = {
        ...(sc.courseOverrides[courseId] || {}),
        ...deepClone(delta),
      };
    }

    sc.updatedAt = Date.now();
    return true;
  }

  /**
   * Xóa toàn bộ delta của một kịch bản (về rỗng)
   * @param {string} [scenarioId]
   * @returns {boolean}
   */
  resetScenario(scenarioId = null) {
    const targetId = scenarioId || this._activeScenarioId;
    const sc = this._scenarios.get(targetId);
    if (!sc) return false;

    sc.courseOverrides = {};
    sc.updatedAt = Date.now();
    return true;
  }

  /**
   * So sánh tối đa 2-3 kịch bản cùng lúc với Baseline
   *
   * @param {Object} params
   * @param {Array<string>} params.scenarioIds - Danh sách ID các kịch bản cần so sánh (tối đa 3)
   * @param {Array<Object>} params.allOriginalCourses - Danh sách toàn bộ môn gốc chuẩn hóa
   * @param {Object} [params.baselineSummary] - GPA tích lũy gốc { gpa4, gpa10, totalCredits, earnedCredits }
   * @param {import('./GradingRuleEngine.js').GradingRuleEngine} [params.gradingRuleEngine]
   * @returns {Object} Comparison report
   */
  static compareScenarios(params) {
    const {
      scenarioEngine,
      scenarioIds = [],
      allOriginalCourses = [],
      baselineSummary = null,
      gradingRuleEngine,
    } = params;

    if (!scenarioEngine || !Array.isArray(scenarioIds)) {
      return { status: 'INVALID_INPUT', items: [] };
    }

    // Giới hạn hợp lý tối đa 3 kịch bản để tránh giao diện quá tải
    const selectedIds = scenarioIds.slice(0, 3);
    const results = [];

    // Tính baseline GPA nếu chưa truyền
    const baseCalc = baselineSummary || GPAEngine.calculateCumulativeGPA(allOriginalCourses, { retakePolicy: 'all' });
    const baseGpa4 = baseCalc?.gpa4 ?? 0;
    const baseGpa10 = baseCalc?.gpa10 ?? 0;

    for (const scId of selectedIds) {
      const sc = scenarioEngine.getScenario(scId);
      if (!sc) continue;

      const overrides = sc.courseOverrides || {};
      const overrideCount = Object.keys(overrides).length;

      // Áp dụng delta vào danh sách môn để tính GPA cho kịch bản này
      const simulatedCourses = allOriginalCourses.map(origCourse => {
        const delta = overrides[origCourse.id];
        if (!delta) return { ...origCourse };

        let score10 = origCourse.score10;
        let score4 = origCourse.score4;
        let passed = origCourse.passed;
        let included = origCourse.included !== undefined ? origCourse.included : true;
        let isExcludedFromGpa = origCourse.isExcludedFromGpa;

        if (delta.included !== undefined) included = delta.included;
        if (delta.courseTypeOverride === 'EXCLUDED') isExcludedFromGpa = true;
        if (delta.isExcludedFromGpa !== undefined) isExcludedFromGpa = delta.isExcludedFromGpa;

        let rule = origCourse.rule;
        if (delta.courseTypeOverride && delta.courseTypeOverride !== 'AUTO' && delta.courseTypeOverride !== 'EXCLUDED') {
          if (gradingRuleEngine) rule = gradingRuleEngine.getRule(delta.courseTypeOverride);
        }
        if (!rule && gradingRuleEngine) {
          rule = gradingRuleEngine.detectRule(origCourse);
        }

        const scoresDelta = delta.scores || {};
        const assessments = origCourse.assessments || {};

        let simFinalExam = typeof scoresDelta.finalExam === 'number' ? scoresDelta.finalExam : delta.finalExam;
        let simMidterm = typeof scoresDelta.midterm === 'number' ? scoresDelta.midterm : delta.midterm;
        const effectiveMidterm = simMidterm !== undefined ? simMidterm : (assessments.midterm?.status === 'ok' ? assessments.midterm.value : null);

        const regularItems = (assessments.regular || []).map((r, idx) => {
          const slot = r.slot !== undefined ? r.slot : (idx + 1);
          if (scoresDelta.regular && typeof scoresDelta.regular[slot] === 'number') {
            return scoresDelta.regular[slot];
          }
          return r;
        });

        const practiceItems = (assessments.practice || []).map((p, idx) => {
          const slot = p.slot !== undefined ? p.slot : (idx + 1);
          if (scoresDelta.practice && typeof scoresDelta.practice[slot] === 'number') {
            return scoresDelta.practice[slot];
          }
          return p;
        });

        const regularAvg = gradingRuleEngine ? gradingRuleEngine.calculateAverage(regularItems) : null;
        const practiceAvg = gradingRuleEngine ? gradingRuleEngine.calculateAverage(practiceItems) : null;

        const effectiveFinal = typeof simFinalExam === 'number' ? simFinalExam : (assessments.finalExam?.status === 'ok' ? assessments.finalExam.value : null);

        if (typeof simFinalExam === 'number' || typeof simMidterm === 'number' || scoresDelta.regular || scoresDelta.practice || (delta.courseTypeOverride && delta.courseTypeOverride !== 'AUTO')) {
          if (rule && typeof rule.calculateTotal === 'function') {
            const calculatedTotal = rule.calculateTotal({
              midterm: effectiveMidterm,
              regularAvg,
              practiceAvg,
              finalExam: effectiveFinal,
            });
            if (typeof calculatedTotal === 'number') {
              score10 = Math.round(calculatedTotal * 100) / 100;
            }
          }
        } else if (typeof delta.score10 === 'number') {
          score10 = delta.score10;
        }

        // Quy đổi sang thang 4 và kiểm tra điểm liệt
        const isFinalFailed = (typeof effectiveFinal === 'number' && rule && typeof rule.minFinalExam === 'number')
          ? effectiveFinal < rule.minFinalExam
          : false;

        if (isFinalFailed) {
          score4 = 0.0;
          passed = false;
        } else if (score10 !== null && gradingRuleEngine) {
          const conv = gradingRuleEngine.convertScore10(score10);
          if (conv) {
            score4 = conv.gradePoint;
            passed = conv.passed;
          }
        }

        return {
          ...origCourse,
          score10,
          score4,
          passed,
          included,
          isExcludedFromGpa,
          isSimulated: true,
        };
      });

      const scGpa = GPAEngine.calculateCumulativeGPA(simulatedCourses, { retakePolicy: 'highest' });
      const deltaGpa4 = scGpa.gpa4 !== null ? Math.round((scGpa.gpa4 - baseGpa4) * 100) / 100 : 0;
      const deltaGpa10 = scGpa.gpa10 !== null ? Math.round((scGpa.gpa10 - baseGpa10) * 100) / 100 : 0;

      results.push({
        scenarioId: sc.id,
        scenarioName: sc.name,
        modifiedCoursesCount: overrideCount,
        gpa4Raw: scGpa.gpa4Raw,
        gpa4Display: scGpa.gpa4,
        gpa10Display: scGpa.gpa10,
        deltaGpa4,
        deltaGpa10,
        earnedCredits: scGpa.earnedCredits,
        totalCredits: scGpa.totalCredits,
        classification4: scGpa.classification4,
      });
    }

    return {
      status: 'OK',
      baseline: {
        label: 'Dữ liệu gốc đọc từ bảng điểm',
        gpa4: baseGpa4,
        gpa10: baseGpa10,
        earnedCredits: baseCalc?.earnedCredits ?? 0,
        totalCredits: baseCalc?.totalCredits ?? 0,
        classification4: baseCalc?.classification4 ?? 'Chưa xếp loại',
      },
      scenarios: results,
    };
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ScenarioEngine,
      deepClone,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.ScenarioEngine = ScenarioEngine;
    root.core.deepClone = deepClone;
    global._IUHScenarioEngine = {
      ScenarioEngine,
      deepClone,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
