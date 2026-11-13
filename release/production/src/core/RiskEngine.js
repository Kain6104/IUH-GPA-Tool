(function (global) {
  'use strict';

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('./GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

  const RequiredScoreEngineModule = (typeof require !== 'undefined')
    ? require('./RequiredScoreEngine.js')
    : (global.IUHGPA && global.IUHGPA.core
        ? global.IUHGPA.core
        : (global._IUHRequiredScoreEngine ? global._IUHRequiredScoreEngine : {}));
  const RequiredScoreEngine = RequiredScoreEngineModule.RequiredScoreEngine;
  const REQUIRED_SCORE_STATUS = RequiredScoreEngineModule.REQUIRED_SCORE_STATUS;

/**
 * Cấu hình ngưỡng phân loại mức cần chú ý (Centralized UX Heuristic)
 */
const RISK_CONFIG = {
  // Điểm cuối kỳ tối thiểu cần đạt để qua môn (min10 = 4.0)
  PASS_TARGET_SCORE10: 4.0,

  THRESHOLDS: {
    SAFE_MAX: 5.0,    // requiredFinal <= 5.0 -> An toàn
    WATCH_MAX: 7.0,   // 5.0 < requiredFinal <= 7.0 -> Cần chú ý
    RISK_MAX: 9.0,    // 7.0 < requiredFinal <= 9.0 -> Rủi ro cao
    // requiredFinal > 9.0 hoặc Impossible -> Rất khó đạt (CRITICAL)
  },

  STATUSES: {
    SAFE: { code: 'SAFE', label: 'An toàn', level: 1 },
    WATCH: { code: 'WATCH', label: 'Cần chú ý', level: 2 },
    RISK: { code: 'RISK', label: 'Rủi ro cao', level: 3 },
    CRITICAL: { code: 'CRITICAL', label: 'Rất khó đạt', level: 4 },
    UNKNOWN: { code: 'UNKNOWN', label: 'Chưa đủ dữ liệu', level: 0 },
    COMPLETED: { code: 'COMPLETED', label: 'Đã có kết quả', level: 0 },
    NOT_APPLICABLE: { code: 'NOT_APPLICABLE', label: 'Không áp dụng', level: 0 },
  }
};

class RiskEngine {
  /**
   * Đánh giá mức độ cần chú ý cho một học phần cụ thể
   *
   * @param {Object} course - Normalized course object
   * @param {Object} [options]
   * @param {number} [options.targetScore10=4.0] - Ngưỡng điểm tổng kết cần đạt (mặc định 4.0 để qua môn)
   * @param {Object} [options.ruleOverride] - Optional rule override
   * @returns {Object} Risk assessment result
   */
  static assessCourseRisk(course, options = {}) {
    if (!course || typeof course !== 'object') {
      return {
        status: RISK_CONFIG.STATUSES.UNKNOWN.code,
        label: RISK_CONFIG.STATUSES.UNKNOWN.label,
        reason: 'Dữ liệu học phần không hợp lệ.',
        requiredScore: null,
      };
    }

    // 1. Kiểm tra nếu môn không tính GPA hoặc môn 0 tín chỉ
    const credits = typeof course.credits === 'number'
      ? course.credits
      : (course.credits?.status === 'ok' ? course.credits.value : 0);

    if (credits === 0 || course.countsTowardGPA === false || course.includeInGPA === false) {
      return {
        status: RISK_CONFIG.STATUSES.NOT_APPLICABLE.code,
        label: RISK_CONFIG.STATUSES.NOT_APPLICABLE.label,
        reason: 'Môn 0 tín chỉ hoặc không tính vào GPA tích lũy.',
        requiredScore: null,
      };
    }

    // 2. Kiểm tra nếu môn đã có kết quả hoàn tất chính thức
    const assessments = course.assessments || {};
    const hasFinalExamOfficial = assessments.finalExam && assessments.finalExam.status === 'ok';
    const hasOfficialTotal = (course.officialResult?.total10?.status === 'ok') || (typeof course.score10 === 'number' && !course.isSimulated);

    if (hasFinalExamOfficial && hasOfficialTotal) {
      const finalVal = assessments.finalExam.value;
      const totalVal = course.officialResult?.total10?.value ?? course.score10;
      const passed = course.officialResult?.passed ?? (totalVal >= 4.0);

      return {
        status: RISK_CONFIG.STATUSES.COMPLETED.code,
        label: RISK_CONFIG.STATUSES.COMPLETED.label,
        reason: `Đã hoàn tất học phần (${passed ? 'Đạt' : 'Chưa đạt'}, TK: ${totalVal.toFixed(1)}, Cuối kỳ: ${finalVal.toFixed(1)}).`,
        requiredScore: null,
        isCompleted: true,
      };
    }

    // 3. Nhận diện rule và tính điểm cuối kỳ cần đạt
    const rule = options.ruleOverride || course.rule || GradingRuleEngine.detectRule(course);
    if (!rule) {
      return {
        status: RISK_CONFIG.STATUSES.UNKNOWN.code,
        label: RISK_CONFIG.STATUSES.UNKNOWN.label,
        reason: 'Chưa xác định được quy tắc tính điểm của môn này.',
        requiredScore: null,
      };
    }

    // Môn không có thi cuối kỳ (ví dụ thực hành hoàn toàn)
    if (rule.hasFinalExam === false) {
      return {
        status: RISK_CONFIG.STATUSES.NOT_APPLICABLE.code,
        label: RISK_CONFIG.STATUSES.NOT_APPLICABLE.label,
        reason: 'Môn không có điểm thi kết thúc học phần (tính theo quá trình / thực hành).',
        requiredScore: null,
      };
    }

    const targetScore10 = typeof options.targetScore10 === 'number'
      ? options.targetScore10
      : RISK_CONFIG.PASS_TARGET_SCORE10;

    const midterm = assessments.midterm?.status === 'ok' ? assessments.midterm.value : null;
    const regularAvg = GradingRuleEngine.calculateAverage(assessments.regular || []);
    const practiceAvg = GradingRuleEngine.calculateAverage(assessments.practice || []);

    const calcResult = RequiredScoreEngine.calculateRequiredFinal({
      rule,
      scores: { midterm, regularAvg, practiceAvg },
      targetScore10,
    });

    // 4. Phân tích kết quả RequiredScoreEngine thành Risk status
    switch (calcResult.status) {
      case REQUIRED_SCORE_STATUS.BLOCKED_BY_MINIMUM_CONDITION:
        return {
          status: RISK_CONFIG.STATUSES.CRITICAL.code,
          label: RISK_CONFIG.STATUSES.CRITICAL.label,
          level: RISK_CONFIG.STATUSES.CRITICAL.level,
          reason: calcResult.reason || 'Bị chặn bởi điều kiện điểm tối thiểu bắt buộc (điểm giữa kỳ = 0).',
          requiredScore: null,
          conditionId: calcResult.conditionId,
        };

      case REQUIRED_SCORE_STATUS.IMPOSSIBLE:
        return {
          status: RISK_CONFIG.STATUSES.CRITICAL.code,
          label: RISK_CONFIG.STATUSES.CRITICAL.label,
          level: RISK_CONFIG.STATUSES.CRITICAL.level,
          reason: 'Điểm cuối kỳ yêu cầu vượt quá 10.0 theo công thức tính điểm mô phỏng.',
          requiredScore: calcResult.requiredScoreRaw,
        };

      case REQUIRED_SCORE_STATUS.INSUFFICIENT_DATA:
      case REQUIRED_SCORE_STATUS.UNKNOWN_RULE:
        return {
          status: RISK_CONFIG.STATUSES.UNKNOWN.code,
          label: RISK_CONFIG.STATUSES.UNKNOWN.label,
          level: RISK_CONFIG.STATUSES.UNKNOWN.level,
          reason: calcResult.reason || 'Chưa đủ dữ liệu điểm thành phần để đánh giá.',
          requiredScore: null,
        };

      case REQUIRED_SCORE_STATUS.ALREADY_ACHIEVED:
        return {
          status: RISK_CONFIG.STATUSES.SAFE.code,
          label: RISK_CONFIG.STATUSES.SAFE.label,
          level: RISK_CONFIG.STATUSES.SAFE.level,
          reason: 'Điểm quá trình hiện tại đã đủ đạt ngưỡng qua môn.',
          requiredScore: 0,
        };

      case REQUIRED_SCORE_STATUS.ACHIEVABLE: {
        const req = calcResult.minimumSelectableScore ?? calcResult.requiredScoreRaw;
        const thresholds = RISK_CONFIG.THRESHOLDS;
        let statusObj = RISK_CONFIG.STATUSES.SAFE;
        let desc = 'An toàn';

        if (req <= thresholds.SAFE_MAX) {
          statusObj = RISK_CONFIG.STATUSES.SAFE;
          desc = 'An toàn';
        } else if (req <= thresholds.WATCH_MAX) {
          statusObj = RISK_CONFIG.STATUSES.WATCH;
          desc = 'Cần chú ý';
        } else if (req <= thresholds.RISK_MAX) {
          statusObj = RISK_CONFIG.STATUSES.RISK;
          desc = 'Rủi ro cao';
        } else {
          statusObj = RISK_CONFIG.STATUSES.CRITICAL;
          desc = 'Rất khó đạt';
        }

        const detail = calcResult.reason ? ` (${calcResult.reason})` : '';
        return {
          status: statusObj.code,
          label: statusObj.label,
          level: statusObj.level,
          reason: `Cần điểm cuối kỳ tối thiểu ${req.toFixed(1)} để đạt mục tiêu (${desc}).${detail}`,
          requiredScore: req,
          adjustedByMinFinal: calcResult.adjustedByMinFinal,
        };
      }

      default:
        return {
          status: RISK_CONFIG.STATUSES.UNKNOWN.code,
          label: RISK_CONFIG.STATUSES.UNKNOWN.label,
          level: RISK_CONFIG.STATUSES.UNKNOWN.level,
          reason: 'Không thể xác định trạng thái rủi ro cho học phần này.',
          requiredScore: null,
        };
    }
  }

  /**
   * Đánh giá rủi ro cho toàn bộ danh sách môn học
   * @param {Array<Object>} courses
   * @param {Object} [options]
   * @returns {Array<Object>}
   */
  static assessAllCourses(courses, options = {}) {
    if (!Array.isArray(courses)) return [];
    return courses.map(course => ({
      courseId: course.id || course.courseCode,
      courseName: course.courseName,
      credits: course.credits?.value ?? course.credits ?? 0,
      assessment: this.assessCourseRisk(course, options),
    }));
  }

  /**
   * Cung cấp truy cập cấu hình heuristic
   */
  static getConfig() {
    return RISK_CONFIG;
  }
}

RiskEngine.RISK_CONFIG = RISK_CONFIG;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      RiskEngine,
      RISK_CONFIG,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.RiskEngine = RiskEngine;
    root.core.RISK_CONFIG = RISK_CONFIG;
    global._IUHRiskEngine = {
      RiskEngine,
      RISK_CONFIG,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
