(function (global) {
  'use strict';

  const GPAEngine = (typeof require !== 'undefined')
    ? require('../core/GPAEngine.js').GPAEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GPAEngine
        ? global.IUHGPA.core.GPAEngine
        : (global._IUHGPAEngine ? global._IUHGPAEngine.GPAEngine : null));

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('../core/GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

  const ScenarioEngine = (typeof require !== 'undefined')
    ? require('../core/ScenarioEngine.js').ScenarioEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.ScenarioEngine
        ? global.IUHGPA.core.ScenarioEngine
        : (global._IUHScenarioEngine ? global._IUHScenarioEngine.ScenarioEngine : null));

  const CourseIdentityMatcher = (typeof require !== 'undefined')
    ? require('../core/CourseIdentityMatcher.js').CourseIdentityMatcher
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.CourseIdentityMatcher
        ? global.IUHGPA.core.CourseIdentityMatcher
        : (global._IUHCourseIdentityMatcher ? global._IUHCourseIdentityMatcher.CourseIdentityMatcher : null));

  const FutureSemesterEngine = (typeof require !== 'undefined')
    ? require('../core/FutureSemesterEngine.js').FutureSemesterEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.FutureSemesterEngine
        ? global.IUHGPA.core.FutureSemesterEngine
        : (global._IUHFutureSemesterEngine ? global._IUHFutureSemesterEngine.FutureSemesterEngine : null));

  const resolveProgressEngine = () => {
    if (typeof require !== 'undefined') {
      try {
        const mod = require('../core/CurriculumProgressEngine.js');
        return mod.CurriculumProgressEngine || mod;
      } catch (e) {}
    }
    const fromNs = (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.CurriculumProgressEngine)
      || (typeof window !== 'undefined' && window.IUHGPA && window.IUHGPA.core && window.IUHGPA.core.CurriculumProgressEngine);
    if (fromNs) return fromNs.CurriculumProgressEngine || fromNs;
    const fromGlobal = global._IUHCurriculumProgressEngine || (typeof window !== 'undefined' && window._IUHCurriculumProgressEngine);
    if (fromGlobal) return fromGlobal.CurriculumProgressEngine || fromGlobal;
    return null;
  };
  const CurriculumProgressEngine = resolveProgressEngine();

  const resolvePlanCoverageEngine = () => {
    if (typeof require !== 'undefined') {
      try {
        const mod = require('../core/PlanCoverageEngine.js');
        return mod.PlanCoverageEngine || mod;
      } catch (e) {}
    }
    const fromNs = (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.PlanCoverageEngine)
      || (typeof window !== 'undefined' && window.IUHGPA && window.IUHGPA.core && window.IUHGPA.core.PlanCoverageEngine);
    if (fromNs) return fromNs.PlanCoverageEngine || fromNs;
    const fromGlobal = global._IUHPlanCoverageEngine || (typeof window !== 'undefined' && window._IUHPlanCoverageEngine);
    if (fromGlobal) return fromGlobal.PlanCoverageEngine || fromGlobal;
    return null;
  };
  const PlanCoverageEngine = resolvePlanCoverageEngine();

  const resolveCurriculumGapEngine = () => {
    if (typeof require !== 'undefined') {
      try {
        const mod = require('../core/CurriculumGapEngine.js');
        return mod.CurriculumGapEngine || mod;
      } catch (e) {}
    }
    const fromNs = (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.CurriculumGapEngine)
      || (typeof window !== 'undefined' && window.IUHGPA && window.IUHGPA.core && window.IUHGPA.core.CurriculumGapEngine);
    if (fromNs) return fromNs.CurriculumGapEngine || fromNs;
    const fromGlobal = global._IUHCurriculumGapEngine || (typeof window !== 'undefined' && window._IUHCurriculumGapEngine);
    if (fromGlobal) return fromGlobal.CurriculumGapEngine || fromGlobal;
    return null;
  };
  const CurriculumGapEngine = resolveCurriculumGapEngine();

class SimulationStore {
  /**
   * @param {Object} [initialOriginalData]
   */
  constructor(initialOriginalData = null) {
    this._originalData = initialOriginalData ? Object.freeze(JSON.parse(JSON.stringify(initialOriginalData))) : null;
    /** @type {Map<string, Object>} delta keyed by courseId */
    this._simulationDeltas = new Map();
    this._scenarioEngine = new ScenarioEngine();
    this._subscribers = new Set();
    this._cachedDerivedData = null;
    this._isDirty = true;

    // Curriculum state (Phase 6A.3)
    this._curriculumModel = null;
    /** @type {Map<string, Object>} match keyed by gradeCourseId */
    this._curriculumMatches = new Map();
    this._curriculumSyncStatus = 'UNSYNCED'; // 'UNSYNCED' | 'SYNCED' | 'FAILED'
    this._curriculumSyncError = null;

    // Future Plan state (Phase 6A.4)
    this._futurePlan = { semesters: [] };
    this._whatIfPreviousSnapshot = null;
  }

  /**
   * Đặt dữ liệu gốc (chỉ gọi 1 lần khi parse trang xong hoặc khi người dùng ấn Refresh)
   * @param {Array<Object>} semesters
   */
  setOriginalData(semesters) {
    const list = Array.isArray(semesters)
      ? semesters
      : (semesters && Array.isArray(semesters.semesters) ? semesters.semesters : []);
    this._originalData = Object.freeze(JSON.parse(JSON.stringify(list)));
    this._simulationDeltas.clear();
    this._futurePlan = { semesters: [] };
    this._scenarioEngine = new ScenarioEngine();
    this._updateCurriculumMatches();
    this._isDirty = true;
    this._notify();
  }

  /**
   * Lấy bản copy read-only của originalData
   * @returns {Array<Object>|null}
   */
  getOriginalData() {
    return this._originalData;
  }

  /**
   * Đặt dữ liệu Chương trình khung (CTK) đã parse
   * @param {Object|null} curriculumModel - Model chuẩn hoá từ IUHCurriculumAdapter
   */
  setCurriculumModel(curriculumModel) {
    this._curriculumModel = curriculumModel ? Object.freeze(JSON.parse(JSON.stringify(curriculumModel))) : null;
    this._curriculumSyncStatus = curriculumModel ? 'SYNCED' : 'UNSYNCED';
    this._curriculumSyncError = null;
    this._updateCurriculumMatches();
    this._isDirty = true;
    this._notify();
  }

  /**
   * Đặt trạng thái đồng bộ CTK (SYNCED, UNSYNCED, FAILED)
   * @param {'SYNCED'|'UNSYNCED'|'FAILED'} status
   * @param {string|null} [error]
   */
  setCurriculumSyncStatus(status, error = null) {
    this._curriculumSyncStatus = status;
    this._curriculumSyncError = error;
    this._isDirty = true;
    this._notify();
  }

  /**
   * Lấy CurriculumModel hiện tại
   * @returns {Object|null}
   */
  getCurriculumModel() {
    return this._curriculumModel;
  }

  /**
   * Kiểm tra có CurriculumModel hợp lệ hay chưa
   * @returns {boolean}
   */
  hasCurriculumModel() {
    return this._curriculumModel !== null && typeof this._curriculumModel === 'object';
  }

  /**
   * Lấy trạng thái phân tích tiến độ CTK (Phase 6A.5.2)
   * @returns {'IDLE'|'READY'|'ENGINE_ERROR'|'INSUFFICIENT_DATA'}
   */
  getCurriculumAnalyticsStatus() {
    return this._curriculumAnalyticsStatus || 'IDLE';
  }

  /**
   * Lấy trạng thái đồng bộ CTK
   * @returns {{ status: string, error: string|null }}
   */
  getCurriculumSyncStatus() {
    return {
      status: this._curriculumSyncStatus,
      error: this._curriculumSyncError,
    };
  }

  /**
   * Lấy kết quả match CTK của 1 môn học
   * @param {string} courseId
   * @returns {Object|null}
   */
  getCurriculumMatch(courseId) {
    return this._curriculumMatches.get(courseId) || null;
  }

  /**
   * Cập nhật bản đồ khớp danh tính môn học giữa Bảng điểm và CTK
   * @private
   */
  _updateCurriculumMatches() {
    this._curriculumMatches.clear();
    if (!this._curriculumModel || !this._originalData || !CourseIdentityMatcher) return;

    const gradeCourses = [];
    for (const sem of this._originalData) {
      for (const c of (sem.courses || [])) {
        gradeCourses.push({
          id: c.id,
          courseClassCode: c.courseClassCode,
          courseName: c.courseName,
          credits: (c.credits && c.credits.status === 'ok') ? c.credits.value : 0,
        });
      }
    }

    const ctkCourses = this._curriculumModel.courses || [];
    const matchReport = CourseIdentityMatcher.matchAll(gradeCourses, ctkCourses);
    if (matchReport && Array.isArray(matchReport.results)) {
      for (const res of matchReport.results) {
        if (res.status !== 'UNMATCHED') {
          this._curriculumMatches.set(res.gradeCourseId, res);
        }
      }
    }
  }

  /**
   * Cập nhật delta mô phỏng cho 1 môn học
   * @param {string} courseId
   * @param {Object} delta - { finalExam?: number, midterm?: number, scores?: Object, score10?: number, score4?: number, included?: boolean, isExcludedFromGpa?: boolean, courseTypeOverride?: string, gradingRuleId?: string }
   */
  setCourseOverride(courseId, delta) {
    if (!courseId) return;

    const existing = this._simulationDeltas.get(courseId) || {};
    const existingScores = existing.scores || {};
    const incomingScores = delta.scores || {};
    const mergedScores = { ...existingScores, ...incomingScores };

    if (delta.finalExam !== undefined) mergedScores.finalExam = delta.finalExam;
    if (delta.midterm !== undefined) mergedScores.midterm = delta.midterm;

    const updated = {
      ...existing,
      ...delta,
      scores: mergedScores,
    };

    this._simulationDeltas.set(courseId, updated);
    this._scenarioEngine.setOverride(courseId, updated);
    this._isDirty = true;
    this._notify();
  }

  /**
   * Cập nhật trạng thái đưa vào tính GPA mô phỏng (Chọn)
   * @param {string} courseId
   * @param {boolean} included
   */
  setCourseInclusion(courseId, included) {
    this.setCourseOverride(courseId, { included: Boolean(included) });
  }

  /**
   * Cập nhật loại môn mô phỏng (Loại môn)
   * @param {string} courseId
   * @param {string} courseTypeOverride
   */
  setCourseTypeOverride(courseId, courseTypeOverride) {
    this.setCourseOverride(courseId, { courseTypeOverride });
  }

  /**
   * Khôi phục 1 trường cụ thể của môn học (midterm, regular.X, practice.X, finalExam, courseTypeOverride, included)
   * @param {string} courseId
   * @param {string} fieldKey
   */
  resetCourseField(courseId, fieldKey) {
    if (!courseId || !this._simulationDeltas.has(courseId)) return;
    const current = this._simulationDeltas.get(courseId);
    if (!current) return;

    if (fieldKey.startsWith('regular.') || fieldKey.startsWith('practice.')) {
      const [type, slotStr] = fieldKey.split('.');
      const slot = parseInt(slotStr, 10);
      if (current.scores && current.scores[type]) {
        delete current.scores[type][slot];
        if (Object.keys(current.scores[type]).length === 0) {
          delete current.scores[type];
        }
      }
    } else if (fieldKey === 'midterm' || fieldKey === 'finalExam') {
      if (current.scores) delete current.scores[fieldKey];
      delete current[fieldKey];
    } else if (fieldKey === 'courseTypeOverride' || fieldKey === 'courseType') {
      delete current.courseTypeOverride;
    } else if (fieldKey === 'included') {
      delete current.included;
    } else if (fieldKey === 'score10' || fieldKey === 'score4') {
      delete current[fieldKey];
    }

    const remainingScoreKeys = current.scores ? Object.keys(current.scores) : [];
    const hasRemainingScores = remainingScoreKeys.length > 0;
    const remainingOtherKeys = Object.keys(current).filter(k => k !== 'scores');

    if (!hasRemainingScores && remainingOtherKeys.length === 0) {
      this.resetCourse(courseId);
    } else {
      this._isDirty = true;
      this._scenarioEngine.setOverride(courseId, current);
      this._notify();
    }
  }

  /**
   * Khôi phục cài đặt môn học (Chọn & Loại môn) về mặc định theo Chương trình khung
   * Giữ nguyên các điểm mô phỏng nếu người dùng có nhập
   * @param {string} courseId
   */
  restoreCourseToCurriculum(courseId) {
    if (!courseId || !this._simulationDeltas.has(courseId)) return;
    const current = this._simulationDeltas.get(courseId);
    if (!current) return;

    delete current.included;
    delete current.courseTypeOverride;

    const remainingScoreKeys = current.scores ? Object.keys(current.scores) : [];
    const hasRemainingScores = remainingScoreKeys.length > 0;
    const remainingOtherKeys = Object.keys(current).filter(k => k !== 'scores');

    if (!hasRemainingScores && remainingOtherKeys.length === 0) {
      this.resetCourse(courseId);
    } else {
      this._isDirty = true;
      this._scenarioEngine.setOverride(courseId, current);
      this._notify();
    }
  }

  /**
   * Xóa delta của một môn học cụ thể
   * @param {string} courseId
   */
  resetCourse(courseId) {
    if (this._simulationDeltas.has(courseId)) {
      this._simulationDeltas.delete(courseId);
      this._scenarioEngine.setOverride(courseId, null);
      this._isDirty = true;
      this._notify();
    }
  }

  /**
   * Xóa toàn bộ delta của các môn thuộc một học kỳ
   * @param {string} semesterKey
   */
  resetSemester(semesterKey) {
    if (!this._originalData || !semesterKey) return;
    const sem = this._originalData.find(s => s.semesterKey === semesterKey);
    if (sem && sem.courses) {
      let changed = false;
      for (const c of sem.courses) {
        if (this._simulationDeltas.has(c.id)) {
          this._simulationDeltas.delete(c.id);
          this._scenarioEngine.setOverride(c.id, null);
          changed = true;
        }
      }
      if (changed) {
        this._isDirty = true;
        this._notify();
      }
    }
  }

  /**
   * Reset toàn bộ mô phỏng (xóa mọi delta)
   */
  resetAllSimulations() {
    if (this._simulationDeltas.size > 0) {
      this._simulationDeltas.clear();
      this._scenarioEngine.resetScenario();
      this._isDirty = true;
      this._notify();
    }
  }

  /**
   * Lấy ScenarioEngine instance
   * @returns {ScenarioEngine}
   */
  getScenarioEngine() {
    return this._scenarioEngine;
  }

  /**
   * Kích hoạt kịch bản và nạp delta vào store
   * @param {string} scenarioId
   * @returns {boolean}
   */
  activateScenario(scenarioId) {
    const ok = this._scenarioEngine.activateScenario(scenarioId);
    if (!ok) return false;

    // Đồng bộ lại _simulationDeltas và _futurePlan từ kịch bản vừa kích hoạt
    const active = this._scenarioEngine.getActiveScenario();
    this._simulationDeltas.clear();
    if (active && active.courseOverrides) {
      for (const [courseId, delta] of Object.entries(active.courseOverrides)) {
        this._simulationDeltas.set(courseId, delta);
      }
    }
    this._futurePlan = (active && active.futurePlan) ? JSON.parse(JSON.stringify(active.futurePlan)) : { semesters: [] };

    this._isDirty = true;
    this._notify();
    return true;
  }

  /**
   * Tạo kịch bản mới
   * @param {string} name
   * @param {Object} [initialOverrides]
   * @returns {Object}
   */
  createScenario(name, initialOverrides) {
    const sc = this._scenarioEngine.createScenario(name, initialOverrides, this._futurePlan);
    this._notify();
    return sc;
  }

  /**
   * Lưu trạng thái mô phỏng hiện tại thành một kịch bản mới
   * @param {string} name
   * @param {string} [description]
   * @returns {Object}
   */
  saveScenario(name, description) {
    const currentOverrides = Object.fromEntries(this._simulationDeltas);
    const sc = this._scenarioEngine.createScenario(name, currentOverrides, this._futurePlan);
    if (description) sc.description = description;
    this._notify();
    return sc;
  }

  /**
   * Nhân bản kịch bản
   * @param {string} sourceId
   * @param {string} [cloneName]
   * @returns {Object|null}
   */
  cloneScenario(sourceId, cloneName) {
    const sc = this._scenarioEngine.cloneScenario(sourceId, cloneName);
    this._notify();
    return sc;
  }

  /**
   * Đổi tên kịch bản
   * @param {string} id
   * @param {string} newName
   * @returns {boolean}
   */
  renameScenario(id, newName) {
    const ok = this._scenarioEngine.renameScenario(id, newName);
    if (ok) this._notify();
    return ok;
  }

  /**
   * Xóa kịch bản
   * @param {string} id
   * @returns {{ success: boolean, reason?: string }}
   */
  deleteScenario(id) {
    const res = this._scenarioEngine.deleteScenario(id);
    if (res.success) {
      // Nạp lại delta từ active scenario hiện tại
      const active = this._scenarioEngine.getActiveScenario();
      this._simulationDeltas.clear();
      if (active && active.courseOverrides) {
        for (const [cId, delta] of Object.entries(active.courseOverrides)) {
          this._simulationDeltas.set(cId, delta);
        }
      }
      this._futurePlan = (active && active.futurePlan) ? JSON.parse(JSON.stringify(active.futurePlan)) : { semesters: [] };
      this._isDirty = true;
      this._notify();
    }
    return res;
  }

  /**
   * Kiểm tra xem hiện tại có delta mô phỏng nào không
   * @returns {boolean}
   */
  hasActiveSimulations() {
    return this._simulationDeltas.size > 0 || (this._futurePlan && this._futurePlan.semesters.length > 0);
  }

  /**
   * Đếm số môn đang có mô phỏng
   * @returns {number}
   */
  getActiveSimulationsCount() {
    let count = this._simulationDeltas.size;
    if (this._futurePlan && Array.isArray(this._futurePlan.semesters)) {
      this._futurePlan.semesters.forEach(s => {
        count += (s.courses ? s.courses.length : 0);
      });
    }
    return count;
  }

  // ==========================================
  // FUTURE PLAN MANAGEMENT (Phase 6A.4)
  // ==========================================

  /**
   * Lấy kế hoạch học kỳ tương lai hiện tại
   * @returns {Object}
   */
  getFuturePlan() {
    return this._futurePlan || { semesters: [] };
  }

  /**
   * Thêm học kỳ tương lai (tối đa 9 học kỳ, kiểm tra trùng lặp)
   * @param {number} term - 1, 2 hoặc 3
   * @param {number} startYear
   * @param {number} endYear
   * @returns {{ ok: boolean, semester?: Object, error?: string }}
   */
  addFutureSemester(termOrObj, startYear, endYear, options = {}) {
    if (!this._futurePlan) {
      this._futurePlan = { semesters: [] };
    }
    if (this._futurePlan.semesters.length >= FutureSemesterEngine.MAX_FUTURE_SEMESTERS) {
      return { ok: false, error: 'MAX_FUTURE_SEMESTERS_REACHED' };
    }
    let term = termOrObj;
    let coursesToAdd = [];
    if (typeof termOrObj === 'object' && termOrObj !== null) {
      term = termOrObj.term;
      startYear = termOrObj.startYear;
      endYear = termOrObj.endYear;
      coursesToAdd = termOrObj.courses || [];
    } else if (options && options.courses) {
      coursesToAdd = options.courses;
    }
    const label = `HK${term} (${startYear} - ${endYear})`;
    if (this._futurePlan.semesters.some(s => s.label === label)) {
      return { ok: false, error: 'SEMESTER_ALREADY_EXISTS' };
    }
    const newSem = FutureSemesterEngine.createFutureSemester(term, startYear, endYear);
    if (coursesToAdd && coursesToAdd.length > 0) {
      coursesToAdd.forEach(c => {
        FutureSemesterEngine.addCourseToSemester(
          { semesters: [newSem] },
          newSem.id,
          c,
          { courseTypeOverride: c.courseTypeOverride }
        );
      });
    }
    this._futurePlan.semesters.push(newSem);
    this._scenarioEngine.setFuturePlan(this._futurePlan);
    this._isDirty = true;
    this._notify();
    return { ok: true, semester: newSem };
  }

  /**
   * Xóa một học kỳ tương lai và giải phóng các môn bên trong
   * @param {string} semesterId
   * @returns {{ ok: boolean, error?: string }}
   */
  removeFutureSemester(semesterId) {
    if (!this._futurePlan) return { ok: false, error: 'PLAN_INVALID' };
    const res = FutureSemesterEngine.removeSemester(this._futurePlan, semesterId);
    if (res.ok) {
      this._scenarioEngine.setFuturePlan(this._futurePlan);
      this._isDirty = true;
      this._notify();
    }
    return res;
  }

  /**
   * Thêm một môn học vào học kỳ tương lai
   * @param {string} semesterId
   * @param {Object} curriculumCourse
   * @param {Object} [options]
   * @returns {{ ok: boolean, course?: Object, error?: string }}
   */
  addFutureCourse(semesterId, curriculumCourse, options = {}) {
    if (!this._futurePlan) {
      this._futurePlan = { semesters: [] };
    }
    const res = FutureSemesterEngine.addCourseToSemester(this._futurePlan, semesterId, curriculumCourse, options);
    if (res.ok && res.course) {
      FutureSemesterEngine.recalculateFutureCourse(res.course);
      this._scenarioEngine.setFuturePlan(this._futurePlan);
      this._isDirty = true;
      this._notify();
    }
    return res;
  }

  /**
   * Xóa một môn học khỏi kế hoạch tương lai
   * @param {string} courseCode
   * @returns {{ ok: boolean, error?: string }}
   */
  removeFutureCourse(courseCode) {
    if (!this._futurePlan) return { ok: false, error: 'PLAN_INVALID' };
    const res = FutureSemesterEngine.removeCourse(this._futurePlan, courseCode);
    if (res.ok) {
      this._scenarioEngine.setFuturePlan(this._futurePlan);
      this._isDirty = true;
      this._notify();
    }
    return res;
  }

  /**
   * Di chuyển môn học giữa các học kỳ tương lai
   * @param {string} courseCode
   * @param {string} targetSemesterId
   * @returns {{ ok: boolean, error?: string }}
   */
  moveFutureCourse(courseCode, targetSemesterId) {
    if (!this._futurePlan) return { ok: false, error: 'PLAN_INVALID' };
    const res = FutureSemesterEngine.moveCourse(this._futurePlan, courseCode, targetSemesterId);
    if (res.ok) {
      this._scenarioEngine.setFuturePlan(this._futurePlan);
      this._isDirty = true;
      this._notify();
    }
    return res;
  }

  /**
   * Cập nhật điểm thành phần mô phỏng của học phần tương lai
   * @param {string} courseCode
   * @param {'midterm'|'final'|'regular'|'practice'} componentKey
   * @param {number} index - Index cho regular (0-8) hoặc practice (0-4)
   * @param {number|null} value
   * @returns {boolean}
   */
  updateFutureCourseScore(courseCode, componentKey, index, value) {
    if (!this._futurePlan || !Array.isArray(this._futurePlan.semesters)) return false;
    let found = null;
    for (const sem of this._futurePlan.semesters) {
      const c = sem.courses.find(item => item.curriculumCourseCode === courseCode);
      if (c) {
        found = c;
        break;
      }
    }
    if (!found) return false;
    if (!found.scores) {
      found.scores = {
        midterm: null,
        regular: [null, null, null, null, null, null, null, null, null],
        practice: [null, null, null, null, null],
        final: null
      };
    }
    if (componentKey === 'midterm') {
      found.scores.midterm = value;
    } else if (componentKey === 'final') {
      found.scores.final = value;
    } else if (componentKey === 'regular') {
      if (!Array.isArray(found.scores.regular)) {
        found.scores.regular = [null, null, null, null, null, null, null, null, null];
      }
      found.scores.regular[index] = value;
    } else if (componentKey === 'practice') {
      if (!Array.isArray(found.scores.practice)) {
        found.scores.practice = [null, null, null, null, null];
      }
      found.scores.practice[index] = value;
    }
    FutureSemesterEngine.recalculateFutureCourse(found);
    this._scenarioEngine.setFuturePlan(this._futurePlan);
    this._isDirty = true;
    this._notify();
    return true;
  }

  /**
   * Đặt loại môn tùy chỉnh cho học phần tương lai
   * @param {string} courseCode
   * @param {'THEORY'|'PRACTICE'|'COMBINED'|null} courseType
   * @returns {boolean}
   */
  setFutureCourseType(courseCode, courseType) {
    if (!this._futurePlan || !Array.isArray(this._futurePlan.semesters)) return false;
    let found = null;
    for (const sem of this._futurePlan.semesters) {
      const c = sem.courses.find(item => item.curriculumCourseCode === courseCode);
      if (c) {
        found = c;
        break;
      }
    }
    if (!found) return false;
    const finalType = (courseType === 'AUTO' || !courseType) ? null : courseType;
    found.courseTypeOverride = finalType;
    found.isTypeOverridden = Boolean(finalType);
    FutureSemesterEngine.recalculateFutureCourse(found);
    this._scenarioEngine.setFuturePlan(this._futurePlan);
    this._isDirty = true;
    this._notify();
    return true;
  }

  /**
   * Bật/tắt tính GPA cho môn học tương lai
   * @param {string} courseCode
   * @param {boolean} included
   * @returns {boolean}
   */
  toggleFutureCourseInclusion(courseCode, included) {
    if (!this._futurePlan || !Array.isArray(this._futurePlan.semesters)) return false;
    let found = null;
    for (const sem of this._futurePlan.semesters) {
      const c = sem.courses.find(item => item.curriculumCourseCode === courseCode);
      if (c) {
        found = c;
        break;
      }
    }
    if (!found) return false;
    found.included = included;
    found.isSelectionOverridden = true;
    this._scenarioEngine.setFuturePlan(this._futurePlan);
    this._isDirty = true;
    this._notify();
    return true;
  }

  /**
   * Áp dụng What-if Preset cho future plan (Requirement 26-32)
   * @param {string} targetGradeLetter - 'A', 'B+', 'B'
   * @returns {{ ok: boolean, modifiedCount?: number, error?: string }}
   */
  applyWhatIfPreset(targetGradeLetter) {
    if (!this._futurePlan) return { ok: false, error: 'PLAN_INVALID' };
    const res = FutureSemesterEngine.applyWhatIfPreset(this._futurePlan, targetGradeLetter);
    if (res.ok) {
      this._whatIfPreviousSnapshot = res.previousSnapshot;
      this._scenarioEngine.setFuturePlan(this._futurePlan);
      this._isDirty = true;
      this._notify();
    }
    return res;
  }

  /**
   * Hoàn tác What-if Preset gần nhất (Requirement 32)
   * @returns {{ ok: boolean, error?: string }}
   */
  restoreWhatIfPreset() {
    if (!this._futurePlan || !this._whatIfPreviousSnapshot) {
      return { ok: false, error: 'NO_PREVIOUS_SNAPSHOT' };
    }
    const res = FutureSemesterEngine.restoreWhatIfPreset(this._futurePlan, this._whatIfPreviousSnapshot);
    if (res.ok) {
      this._whatIfPreviousSnapshot = null;
      this._scenarioEngine.setFuturePlan(this._futurePlan);
      this._isDirty = true;
      this._notify();
    }
    return res;
  }

  /**
   * Kiểm tra xem có snapshot để hoàn tác preset không
   * @returns {boolean}
   */
  canRestoreWhatIfPreset() {
    return Boolean(this._whatIfPreviousSnapshot);
  }

  /**
   * Lấy danh mục các môn học khả dụng từ CTK để chọn vào kế hoạch tương lai
   * @returns {Object} CoursePool
   */
  getCoursePool() {
    const derived = this.getDerivedData();
    const allCourses = derived.allSimulatedCourses || [];
    return FutureSemesterEngine.getCoursePool(this._curriculumModel, allCourses, this._futurePlan);
  }

  /**
   * Lấy delta hiện tại của 1 môn
   * @param {string} courseId
   * @returns {Object|null}
   */
  getCourseDelta(courseId) {
    return this._simulationDeltas.get(courseId) || null;
  }

  /**
   * Tính toán và trả về DerivedData hiện tại (kết hợp original + delta)
   * Có caching để tối ưu hiệu năng
   */
  getDerivedData() {
    if (!this._originalData) {
      let curriculumProgress = null;
      let planCoverage = null;
      let curriculumGaps = null;
      let curriculumAnalyticsStatus = 'IDLE';

      if (this._curriculumModel) {
        curriculumAnalyticsStatus = 'READY';
        const progressEngine = (typeof globalThis !== 'undefined' && globalThis.IUHGPA && globalThis.IUHGPA.core && globalThis.IUHGPA.core.CurriculumProgressEngine)
          || (typeof window !== 'undefined' && window.IUHGPA && window.IUHGPA.core && window.IUHGPA.core.CurriculumProgressEngine)
          || (typeof global !== 'undefined' && global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.CurriculumProgressEngine)
          || CurriculumProgressEngine;

        if (progressEngine && typeof progressEngine.calculateProgress === 'function') {
          try {
            curriculumProgress = progressEngine.calculateProgress(
              this._curriculumModel,
              [],
              this._futurePlan || { semesters: [] }
            );
          } catch (err) {
            console.error('[SimulationStore] CurriculumProgressEngine error:', err);
            curriculumAnalyticsStatus = 'ENGINE_ERROR';
          }
        }
      }

      return {
        semesters: [],
        overallOriginal: null,
        overallSimulated: null,
        hasSimulations: false,
        activeSimulationsCount: 0,
        curriculumModel: this._curriculumModel,
        curriculumStatus: this._curriculumSyncStatus,
        curriculumError: this._curriculumSyncError,
        curriculumAnalyticsStatus,
        curriculumProgress,
        planCoverage,
        curriculumGaps,
        futurePlan: this._futurePlan || { semesters: [] },
        projectedCumulative: null,
        canRestoreWhatIfPreset: false
      };
    }

    if (!this._isDirty && this._cachedDerivedData) {
      return this._cachedDerivedData;
    }

    const allOriginalCourses = [];
    const allSimulatedCourses = [];

    let cumOrigWeighted4 = 0;
    let cumOrigWeighted10 = 0;
    let cumOrigCredits = 0;
    let cumSimWeighted4 = 0;
    let cumSimWeighted10 = 0;
    let cumSimCredits = 0;

    const computedSemesters = this._originalData.map(sem => {
      const origCourses = sem.courses || [];
      const simCourses = origCourses.map(c => {
        const delta = this._simulationDeltas.get(c.id);
        const originalScore10 = (c.officialResult && c.officialResult.total10 && c.officialResult.total10.status === 'ok')
          ? c.officialResult.total10.value
          : null;

        const originalScore4 = (c.officialResult && c.officialResult.score4 && c.officialResult.score4.status === 'ok')
          ? c.officialResult.score4.value
          : null;

        const originalFinal = (c.assessments && c.assessments.finalExam && c.assessments.finalExam.status === 'ok')
          ? c.assessments.finalExam.value
          : null;

        const creditsVal = (c.credits && c.credits.status === 'ok') ? c.credits.value : (typeof c.credits === 'number' ? c.credits : 0);
        const isZeroCredit = creditsVal === 0;

        // CTK Match & Resolution (Phase 6A.3)
        const ctkMatch = this._curriculumMatches.get(c.id) || null;
        const isCtkMatched = ctkMatch && (ctkMatch.status === 'EXACT' || ctkMatch.status === 'DERIVED_CODE' || ctkMatch.status === 'CODE_AND_NAME');
        const ctkCourse = isCtkMatched ? ctkMatch.curriculumCourse : null;

        // 1. Loại môn (Course Type) Resolution
        // Priority: 1. USER_OVERRIDE (in delta), 2. CTK LT/TH, 3. GradingRuleEngine, 4. UNKNOWN
        let defaultCourseType = 'THEORY';
        let defaultRule = GradingRuleEngine.COMPONENT_RULES.THEORY;
        let courseTypeProvenance = 'LEGACY_FALLBACK';

        if (ctkCourse && ctkCourse.inferredCourseType && ctkCourse.inferredCourseType !== 'UNKNOWN') {
          defaultCourseType = ctkCourse.inferredCourseType;
          if (defaultCourseType === 'COMBINED') {
            defaultRule = GradingRuleEngine.COMPONENT_RULES.COMBINED;
          } else if (defaultCourseType === 'PRACTICE') {
            defaultRule = GradingRuleEngine.COMPONENT_RULES.PRACTICE;
          } else {
            defaultRule = GradingRuleEngine.COMPONENT_RULES.THEORY;
          }
          courseTypeProvenance = 'CURRICULUM_LT_TH';
        } else {
          const inferred = GradingRuleEngine.inferCourseType(c);
          if (inferred && inferred.type) {
            defaultCourseType = inferred.type;
            defaultRule = inferred.rule || GradingRuleEngine.COMPONENT_RULES.THEORY;
            courseTypeProvenance = 'rule_engine_inferred';
          }
        }

        // 2. Trạng thái Chọn (Inclusion / Excluded From GPA) Resolution
        // Priority:
        // 1. USER_OVERRIDE (in delta)
        // 2. Explicit CTK non-GPA marker (*)
        // 3. credits === 0
        // 4. Validated fallback exclusion rule (GDTC, GDQP, Tiếng Anh 1-2, Chứng chỉ Tiếng Anh)
        // 5. CTK eligible metadata
        // 6. Default included
        let defaultIncluded = true;
        let defaultExcluded = isZeroCredit;
        let isFallbackNonGpa = false;
        let inclusionProvenance = 'DEFAULT';

        const fallbackNonGpa = GradingRuleEngine.isNonGpaCourseFallback
          ? GradingRuleEngine.isNonGpaCourseFallback(c.courseName)
          : { isNonGpa: false };

        if (ctkCourse && ctkCourse.countsTowardCumulativeGPA === false) {
          defaultIncluded = false;
          defaultExcluded = true;
          inclusionProvenance = 'CURRICULUM_EXPLICIT_NON_GPA';
        } else if (isZeroCredit) {
          defaultIncluded = false;
          defaultExcluded = true;
          inclusionProvenance = 'ZERO_CREDIT';
        } else if (fallbackNonGpa.isNonGpa) {
          defaultIncluded = false;
          defaultExcluded = true;
          isFallbackNonGpa = true;
          inclusionProvenance = fallbackNonGpa.provenance || 'FALLBACK_NON_GPA_RULE';
        } else if (ctkCourse && ctkCourse.countsTowardCumulativeGPA === true) {
          defaultIncluded = true;
          defaultExcluded = false;
          inclusionProvenance = 'CURRICULUM_ELIGIBLE';
        }

        // Base course object
        const base = {
          id: c.id,
          ordinal: c.ordinal ?? null,
          semesterKey: sem.semesterKey,
          courseClassCode: c.courseClassCode,
          courseName: c.courseName,
          credits: creditsVal,
          assessments: c.assessments,
          originalFinal,
          simulatedFinal: originalFinal,
          originalScore10,
          score10: originalScore10,
          score10Raw: originalScore10,
          originalScore4,
          score4: originalScore4,
          score4Raw: originalScore4,
          letter: c.officialResult?.letter || null,
          classification: c.officialResult?.classification || null,
          passed: c.officialResult ? c.officialResult.passed : false,
          included: defaultIncluded,
          isExcludedFromGpa: defaultExcluded,
          isFallbackNonGpa,
          courseTypeOverride: null,
          courseType: defaultCourseType,
          effectiveRule: defaultRule,
          isSimulated: false,
          isTypeOverridden: false,
          isSelectionOverridden: false,
          provenance: 'official-observed',
          courseTypeProvenance,
          inclusionProvenance,
          // CTK metadata
          curriculumMatch: ctkMatch || null,
          curriculumCourse: ctkCourse || null,
          isExplicitNonGpa: ctkCourse ? (ctkCourse.countsTowardCumulativeGPA === false) : false,
        };

        if (!delta) {
          return base;
        }

        // Apply delta
        const scoresDelta = delta.scores || {};

        let simMidterm = (c.assessments && c.assessments.midterm && c.assessments.midterm.status === 'ok')
          ? c.assessments.midterm.value
          : null;
        if (typeof scoresDelta.midterm === 'number') {
          simMidterm = scoresDelta.midterm;
        } else if (typeof delta.midterm === 'number') {
          simMidterm = delta.midterm;
        }

        const simRegular = (c.assessments?.regular || []).map((r, idx) => {
          const slot = r.slot !== undefined ? r.slot : (idx + 1);
          let origVal = null;
          if (typeof r === 'number') origVal = r;
          else if (r && typeof r === 'object') {
            if (r.value && r.value.status === 'ok') origVal = r.value.value;
            else if (typeof r.value === 'number') origVal = r.value;
          }
          let val = origVal;
          if (scoresDelta.regular && typeof scoresDelta.regular[slot] === 'number') {
            val = scoresDelta.regular[slot];
          } else if (Array.isArray(scoresDelta.regular) && typeof scoresDelta.regular[slot - 1] === 'number') {
            val = scoresDelta.regular[slot - 1];
          }
          return { slot, sourceField: r.sourceField, value: val, isSimulated: val !== origVal, origVal };
        });

        const simPractice = (c.assessments?.practice || []).map((p, idx) => {
          const slot = p.slot !== undefined ? p.slot : (idx + 1);
          let origVal = null;
          if (typeof p === 'number') origVal = p;
          else if (p && typeof p === 'object') {
            if (p.value && p.value.status === 'ok') origVal = p.value.value;
            else if (typeof p.value === 'number') origVal = p.value;
          }
          let val = origVal;
          if (scoresDelta.practice && typeof scoresDelta.practice[slot] === 'number') {
            val = scoresDelta.practice[slot];
          } else if (Array.isArray(scoresDelta.practice) && typeof scoresDelta.practice[slot - 1] === 'number') {
            val = scoresDelta.practice[slot - 1];
          }
          return { slot, sourceField: p.sourceField, value: val, isSimulated: val !== origVal, origVal };
        });

        let simFinalExam = base.originalFinal;
        if (typeof scoresDelta.finalExam === 'number') {
          simFinalExam = scoresDelta.finalExam;
        } else if (typeof delta.finalExam === 'number') {
          simFinalExam = delta.finalExam;
        }

        // Rule and exclusion determination
        let rule = null;
        let simExcluded = base.isExcludedFromGpa;

        if (delta.courseTypeOverride && delta.courseTypeOverride !== 'AUTO') {
          if (delta.courseTypeOverride === 'EXCLUDED') {
            simExcluded = true;
            rule = GradingRuleEngine.detectRule(c);
          } else {
            rule = GradingRuleEngine.getRule(delta.courseTypeOverride);
          }
        } else if (delta.gradingRuleId) {
          rule = GradingRuleEngine.getRule(delta.gradingRuleId);
        }

        if (!rule) {
          rule = GradingRuleEngine.detectRule(c);
        }

        if (delta.isExcludedFromGpa !== undefined) {
          simExcluded = delta.isExcludedFromGpa;
        }

        const regularAvg = GradingRuleEngine.calculateAverage(simRegular.map(r => r.value));
        const practiceAvg = GradingRuleEngine.calculateAverage(simPractice.map(p => p.value));

        // Process Average (TBQT)
        let simProcessAverage = null;
        if (rule.ruleId === 'THEORY_30_20_50' || rule === GradingRuleEngine.COMPONENT_RULES.THEORY) {
          if (typeof simMidterm === 'number' && typeof regularAvg === 'number') {
            simProcessAverage = Math.round(((simMidterm * 0.3 + regularAvg * 0.2) / 0.5) * 100) / 100;
          }
        } else if (rule.ruleId === 'COMBINED_THEORY_PRACTICE' || rule === GradingRuleEngine.COMPONENT_RULES.COMBINED) {
          if (typeof simMidterm === 'number' && typeof regularAvg === 'number') {
            const ltProcess = (simMidterm * 0.3 + regularAvg * 0.2) / 0.5;
            if (typeof practiceAvg === 'number') {
              simProcessAverage = Math.round(((ltProcess * 2 + practiceAvg) / 3) * 100) / 100;
            } else {
              simProcessAverage = Math.round(ltProcess * 100) / 100;
            }
          }
        } else if (rule.ruleId === 'PRACTICE_ONLY' || rule === GradingRuleEngine.COMPONENT_RULES.PRACTICE) {
          simProcessAverage = practiceAvg !== null ? Math.round(practiceAvg * 100) / 100 : null;
        }

        const hasMidtermChanged = simMidterm !== (base.assessments?.midterm?.status === 'ok' ? base.assessments.midterm.value : null);
        const hasRegularChanged = simRegular.some(r => r.isSimulated);
        const hasPracticeChanged = simPractice.some(p => p.isSimulated);
        const hasFinalChanged = simFinalExam !== base.originalFinal;
        const hasRuleChanged = Boolean(delta.courseTypeOverride && delta.courseTypeOverride !== 'AUTO');

        let simScore10 = base.originalScore10;
        let simScore10Raw = base.score10Raw;
        if (hasMidtermChanged || hasRegularChanged || hasPracticeChanged || hasFinalChanged || hasRuleChanged) {
          if (typeof delta.score10 === 'number') {
            simScore10 = delta.score10;
            simScore10Raw = delta.score10;
          } else if (rule && typeof rule.calculateTotal === 'function') {
            const calculatedTotal = rule.calculateTotal({
              midterm: simMidterm,
              regularAvg,
              practiceAvg,
              finalExam: simFinalExam,
            });
            if (typeof calculatedTotal === 'number') {
              simScore10Raw = calculatedTotal;
              simScore10 = Math.round(calculatedTotal * 100) / 100;
            }
          }
        } else if (typeof delta.score10 === 'number') {
          simScore10 = delta.score10;
          simScore10Raw = delta.score10;
        }

        // Final exam fail
        const isFinalFailed = (simFinalExam !== null && rule && typeof rule.minFinalExam === 'number')
          ? GradingRuleEngine.isFinalExamFailed(simFinalExam, rule.minFinalExam)
          : false;

        let simScore4 = base.originalScore4;
        let simLetter = base.letter;
        let simClassification = base.classification;
        let simPassed = base.passed;

        if (typeof delta.score4 === 'number') {
          simScore4 = delta.score4;
        } else if (simScore10 !== null) {
          if (isFinalFailed) {
            simScore4 = 0.0;
            simLetter = 'F';
            simClassification = 'Kém';
            simPassed = false;
          } else {
            const conv = GradingRuleEngine.convertScore10(simScore10);
            if (conv) {
              simScore4 = conv.gradePoint;
              simLetter = conv.letter;
              simClassification = conv.classification;
              simPassed = conv.passed;
            }
          }
        }

        const isTypeOverridden = Boolean(delta.courseTypeOverride && delta.courseTypeOverride !== 'AUTO');
        const isSelectionOverridden = Boolean(delta.included !== undefined);
        const simIncluded = isSelectionOverridden ? delta.included : base.included;
        if (isSelectionOverridden) {
          simExcluded = !delta.included;
        }

        const isSimulated = hasMidtermChanged || hasRegularChanged || hasPracticeChanged || hasFinalChanged ||
          isTypeOverridden || isSelectionOverridden || typeof delta.score10 === 'number' || typeof delta.score4 === 'number';

        return {
          ...base,
          simulatedMidterm: simMidterm,
          simulatedRegular: simRegular,
          simulatedPractice: simPractice,
          simulatedFinal: simFinalExam,
          processAverage: simProcessAverage,
          score10: simScore10,
          score10Raw: simScore10Raw,
          score4: simScore4,
          score4Raw: simScore4,
          letter: simLetter,
          classification: simClassification,
          passed: simPassed,
          included: simIncluded,
          isExcludedFromGpa: simExcluded,
          courseTypeOverride: isTypeOverridden ? delta.courseTypeOverride : null,
          courseType: isTypeOverridden ? delta.courseTypeOverride : base.courseType,
          effectiveRule: rule,
          isSimulated,
          isTypeOverridden,
          isSelectionOverridden,
          provenance: isSimulated ? 'simulated' : 'official-observed',
          courseTypeProvenance: isTypeOverridden ? 'USER_OVERRIDE' : base.courseTypeProvenance,
          inclusionProvenance: isSelectionOverridden ? 'USER_OVERRIDE' : base.inclusionProvenance,
        };
      });

      // Original inputs for this semester
      const origInputs = origCourses.map(c => {
        const ctkMatch = this._curriculumMatches.get(c.id) || null;
        const isCtkMatched = ctkMatch && (ctkMatch.status === 'EXACT' || ctkMatch.status === 'DERIVED_CODE' || ctkMatch.status === 'CODE_AND_NAME');
        const ctkCourse = isCtkMatched ? ctkMatch.curriculumCourse : null;
        const creditsVal = (c.credits && c.credits.status === 'ok') ? c.credits.value : (typeof c.credits === 'number' ? c.credits : 0);
        const fallback = GradingRuleEngine.isNonGpaCourseFallback
          ? GradingRuleEngine.isNonGpaCourseFallback(c.courseName)
          : { isNonGpa: false };
        let isExcluded = creditsVal === 0;
        let isExplicitNonGpa = false;
        let isFallbackNonGpa = false;
        if (ctkCourse && ctkCourse.countsTowardCumulativeGPA === false) {
          isExcluded = true;
          isExplicitNonGpa = true;
        } else if (isExcluded) {
          // zero credit
        } else if (fallback.isNonGpa) {
          isExcluded = true;
          isFallbackNonGpa = true;
        }

        const origScore10 = (c.officialResult && c.officialResult.total10 && c.officialResult.total10.status === 'ok') ? c.officialResult.total10.value : null;
        const origScore4 = (c.officialResult && c.officialResult.score4 && c.officialResult.score4.status === 'ok') ? c.officialResult.score4.value : null;

        return {
          id: c.id,
          ordinal: c.ordinal ?? null,
          courseClassCode: c.courseClassCode,
          courseName: c.courseName,
          credits: creditsVal,
          score10: origScore10,
          score10Raw: origScore10,
          score4: origScore4,
          score4Raw: origScore4,
          passed: c.officialResult ? c.officialResult.passed : false,
          included: !isExcluded,
          isExcludedFromGpa: isExcluded,
          isExplicitNonGpa,
          isFallbackNonGpa,
        };
      });

      origInputs.forEach(item => allOriginalCourses.push(item));
      simCourses.forEach(item => allSimulatedCourses.push(item));

      // Semester GPAs
      const semesterOriginalGPA = GPAEngine.calculateGPA(origInputs);
      const semesterSimulatedGPA = GPAEngine.calculateGPA(simCourses);

      if (semesterOriginalGPA && semesterOriginalGPA.gradedCredits > 0) {
        cumOrigWeighted4 += semesterOriginalGPA.sumWeighted4;
        cumOrigWeighted10 += semesterOriginalGPA.sumWeighted10;
        cumOrigCredits += semesterOriginalGPA.gradedCredits;
      }
      if (semesterSimulatedGPA && semesterSimulatedGPA.gradedCredits > 0) {
        cumSimWeighted4 += semesterSimulatedGPA.sumWeighted4;
        cumSimWeighted10 += semesterSimulatedGPA.sumWeighted10;
        cumSimCredits += semesterSimulatedGPA.gradedCredits;
      }

      const cumulativeOriginalGPA = {
        gpa4Raw: cumOrigCredits > 0 ? (cumOrigWeighted4 / cumOrigCredits) : null,
        gpa10Raw: cumOrigCredits > 0 ? (cumOrigWeighted10 / cumOrigCredits) : null,
        gradedCredits: cumOrigCredits,
      };
      const cumulativeSimulatedGPA = {
        gpa4Raw: cumSimCredits > 0 ? (cumSimWeighted4 / cumSimCredits) : null,
        gpa10Raw: cumSimCredits > 0 ? (cumSimWeighted10 / cumSimCredits) : null,
        gradedCredits: cumSimCredits,
      };

      return {
        semesterKey: sem.semesterKey,
        semesterName: sem.semesterName,
        courses: simCourses,
        officialSummary: sem.summary,
        calculatedOriginalGPA: semesterOriginalGPA,
        calculatedSimulatedGPA: semesterSimulatedGPA,
        cumulativeOriginalGPA,
        cumulativeSimulatedGPA,
      };
    });

    // Baseline official cumulative GPA không tự suy diễn học lại ('all')
    const overallOriginal = GPAEngine.calculateCumulativeGPA(allOriginalCourses, { retakePolicy: 'all' });
    // Cumulative GPA mô phỏng áp dụng policy 'highest' rõ ràng
    const overallSimulated = GPAEngine.calculateCumulativeGPA(allSimulatedCourses, { retakePolicy: 'highest' });

    // Tính toán các học kỳ tương lai (Phase 6A.4)
    let computedFutureSemesters = [];
    if (this._futurePlan && Array.isArray(this._futurePlan.semesters)) {
      computedFutureSemesters = this._futurePlan.semesters.map(fSem => {
        const recalculatedCourses = (fSem.courses || []).map(fc => {
          return FutureSemesterEngine.recalculateFutureCourse(fc);
        });
        const futureSemCopy = {
          ...fSem,
          courses: recalculatedCourses,
        };
        const summary = FutureSemesterEngine.calculateFutureSemesterGPA(futureSemCopy);
        futureSemCopy.summary = summary;
        futureSemCopy.calculatedSimulatedGPA = summary;
        return futureSemCopy;
      });

      // Progressive cumulative GPA for each future semester
      computedFutureSemesters.forEach((fSem, fIdx) => {
        const progressiveCum = FutureSemesterEngine.calculateProjectedCumulativeGPA(
          computedSemesters,
          computedFutureSemesters.slice(0, fIdx + 1)
        );
        fSem.cumulativeSimulatedGPA = progressiveCum;
        fSem.cumulativeSummary = progressiveCum;
      });
    }

    const projectedCumulative = FutureSemesterEngine.calculateProjectedCumulativeGPA(
      computedSemesters,
      computedFutureSemesters
    );

    // Curriculum Intelligence (Phase 6A.5 & 6A.5.2)
    let curriculumProgress = null;
    let planCoverage = null;
    let curriculumGaps = null;
    let curriculumAnalyticsStatus = 'IDLE';

    if (this._curriculumModel) {
      curriculumAnalyticsStatus = 'READY';
      const progressEngine = (typeof globalThis !== 'undefined' && globalThis.IUHGPA && globalThis.IUHGPA.core && globalThis.IUHGPA.core.CurriculumProgressEngine)
        || (typeof window !== 'undefined' && window.IUHGPA && window.IUHGPA.core && window.IUHGPA.core.CurriculumProgressEngine)
        || (typeof global !== 'undefined' && global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.CurriculumProgressEngine)
        || CurriculumProgressEngine;

      if (progressEngine && typeof progressEngine.calculateProgress === 'function') {
        try {
          let officialCumulativeCredits = null;
          for (let i = computedSemesters.length - 1; i >= 0; i--) {
            const sem = computedSemesters[i];
            if (sem && sem.officialSummary && sem.officialSummary.cumulativeCredits != null) {
              officialCumulativeCredits = sem.officialSummary.cumulativeCredits;
              break;
            }
          }

          curriculumProgress = progressEngine.calculateProgress(
            this._curriculumModel,
            computedSemesters,
            { semesters: computedFutureSemesters },
            { officialCumulativeCredits }
          );
        } catch (err) {
          console.error('[SimulationStore] CurriculumProgressEngine error:', err);
          curriculumAnalyticsStatus = 'ENGINE_ERROR';
          curriculumProgress = null;
        }
      } else if (progressEngine) {
        console.warn('[SimulationStore] MISSING_ENGINE_METHOD: CurriculumProgressEngine.calculateProgress');
        curriculumAnalyticsStatus = 'ENGINE_ERROR';
      }

      if (PlanCoverageEngine && typeof PlanCoverageEngine.analyzePlanCoverage === 'function' && curriculumProgress) {
        try {
          planCoverage = PlanCoverageEngine.analyzePlanCoverage({
            progressSummary: curriculumProgress,
            futurePlan: { semesters: computedFutureSemesters },
            actualSemestersOrSummary: computedSemesters
          });
        } catch (err) {
          console.error('[SimulationStore] PlanCoverageEngine error:', err);
          planCoverage = null;
        }
      }

      if (CurriculumGapEngine && typeof CurriculumGapEngine.detectGaps === 'function') {
        try {
          curriculumGaps = CurriculumGapEngine.detectGaps({
            curriculumModel: this._curriculumModel,
            gradeSemestersOrCourses: computedSemesters
          });
        } catch (err) {
          console.error('[SimulationStore] CurriculumGapEngine error:', err);
          curriculumGaps = null;
        }
      }
    }
    this._curriculumAnalyticsStatus = curriculumAnalyticsStatus;

    this._cachedDerivedData = {
      semesters: computedSemesters,
      overallOriginal,
      overallSimulated,
      allSimulatedCourses,
      allOriginalCourses,
      hasSimulations: this._simulationDeltas.size > 0 || computedFutureSemesters.length > 0,
      activeSimulationsCount: this.getActiveSimulationsCount(),
      curriculumModel: this._curriculumModel,
      curriculumStatus: this._curriculumSyncStatus,
      curriculumError: this._curriculumSyncError,
      curriculumAnalyticsStatus: this._curriculumAnalyticsStatus,
      futurePlan: {
        semesters: computedFutureSemesters
      },
      projectedCumulative,
      curriculumProgress,
      planCoverage,
      curriculumGaps,
      canRestoreWhatIfPreset: this.canRestoreWhatIfPreset()
    };
    this._isDirty = false;

    return this._cachedDerivedData;
  }

  /**
   * Đăng ký lắng nghe thay đổi state
   * @param {Function} listener
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this._subscribers.add(listener);
      return () => this._subscribers.delete(listener);
    }
    return () => {};
  }

  _notify() {
    const data = this.getDerivedData();
    for (const listener of this._subscribers) {
      try {
        listener(data);
      } catch (err) {
        console.error('[SimulationStore] Error in listener:', err);
      }
    }
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SimulationStore,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.state = root.state || Object.create(null);
    root.state.SimulationStore = SimulationStore;
    global._IUHSimulationStore = {
      SimulationStore,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
