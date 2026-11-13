(function (global) {
  'use strict';

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('./GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

/**
 * Trạng thái kết quả tính điểm cuối kỳ cần đạt
 */
const REQUIRED_SCORE_STATUS = {
  ACHIEVABLE: 'ACHIEVABLE',
  ALREADY_ACHIEVED: 'ALREADY_ACHIEVED',
  IMPOSSIBLE: 'IMPOSSIBLE',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
  UNKNOWN_RULE: 'UNKNOWN_RULE',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  BLOCKED_BY_MINIMUM_CONDITION: 'BLOCKED_BY_MINIMUM_CONDITION',
  INVALID_INPUT: 'INVALID_INPUT',
};

/**
 * Làm tròn lên theo bước nhảy an toàn với sai số dấu phẩy động IEEE-754.
 *
 * @param {number} val
 * @param {number} [step=0.1]
 * @returns {number|null}
 */
function ceilToStep(val, step = 0.1) {
  if (typeof val !== 'number' || isNaN(val)) return null;

  const factor = Math.round(1 / step);
  const scaled = val * factor;
  const rounded = Math.round(scaled);

  if (Math.abs(scaled - rounded) < 1e-11) {
    return rounded / factor;
  }

  return Math.ceil(scaled) / factor;
}

class RequiredScoreEngine {
  /**
   * Tính điểm cuối kỳ cần đạt cho một mục tiêu điểm tổng kết cụ thể
   *
   * @param {Object} params
   * @param {Object} [params.rule] - Quy tắc tính điểm từ GradingRuleEngine
   * @param {Object} params.scores - Điểm thành phần đã chuẩn hóa: { midterm, regularAvg, practiceAvg }
   * @param {number} params.targetScore10 - Điểm tổng kết mục tiêu thang 10 (ví dụ 4.0, 5.5, 7.0, ...)
   * @param {Object} [params.targetMetadata] - Thông tin mục tiêu (label, letter, etc.)
   * @param {number} [params.inputStep=0.1] - Bước nhảy nhập liệu
   * @returns {Object} Result object với status rõ ràng
   */
  static calculateRequiredFinal(params) {
    if (!params || typeof params !== 'object') {
      return {
        status: REQUIRED_SCORE_STATUS.INVALID_INPUT,
        reason: 'Dữ liệu đầu vào không hợp lệ',
      };
    }

    const { rule, scores = {}, targetScore10, targetMetadata = null, inputStep = 0.1 } = params;

    if (typeof targetScore10 !== 'number' || isNaN(targetScore10) || targetScore10 < 0 || targetScore10 > 10) {
      return {
        status: REQUIRED_SCORE_STATUS.INVALID_INPUT,
        target: targetMetadata,
        reason: 'Điểm mục tiêu không hợp lệ (phải trong khoảng [0, 10])',
      };
    }

    if (!rule || typeof rule !== 'object') {
      return {
        status: REQUIRED_SCORE_STATUS.UNKNOWN_RULE,
        target: targetMetadata,
        reason: 'Chưa xác định được cấu trúc tính điểm của môn này.',
      };
    }

    // Nếu môn không có điểm thi kết thúc học phần (ví dụ Thực hành)
    if (rule.hasFinalExam === false || rule.finalExamWeight === 0) {
      return {
        status: REQUIRED_SCORE_STATUS.NOT_APPLICABLE,
        target: targetMetadata,
        reason: 'Không áp dụng điểm cuối kỳ cho cấu trúc điểm hiện tại.',
      };
    }

    // 1. Kiểm tra các điều kiện chặn (Blocking conditions - ví dụ điểm giữa kỳ = 0)
    if (Array.isArray(rule.blockingConditions)) {
      for (const cond of rule.blockingConditions) {
        if (typeof cond.check === 'function' && cond.check(scores)) {
          return {
            status: REQUIRED_SCORE_STATUS.BLOCKED_BY_MINIMUM_CONDITION,
            target: targetMetadata,
            conditionId: cond.id,
            reason: cond.description || 'Bị chặn bởi điều kiện điểm tối thiểu bắt buộc',
          };
        }
      }
    }

    // 2. Kiểm tra dữ liệu thành phần bắt buộc
    const { midterm, regularAvg, practiceAvg } = scores;

    if (rule.ruleId === 'THEORY_30_20_50') {
      if (typeof midterm !== 'number' || typeof regularAvg !== 'number') {
        return {
          status: REQUIRED_SCORE_STATUS.INSUFFICIENT_DATA,
          target: targetMetadata,
          reason: 'Chưa đủ dữ liệu điểm quá trình (giữa kỳ / thường xuyên) để tính.',
        };
      }
    } else if (rule.ruleId === 'COMBINED_THEORY_PRACTICE') {
      if (typeof midterm !== 'number' || typeof regularAvg !== 'number' || typeof practiceAvg !== 'number') {
        return {
          status: REQUIRED_SCORE_STATUS.INSUFFICIENT_DATA,
          target: targetMetadata,
          reason: 'Chưa đủ dữ liệu điểm quá trình hoặc thực hành để tính.',
        };
      }
    }

    // 3. Giải toán đại số chính xác (Exact algebraic solver)
    let requiredScoreRaw = 0;

    if (rule.ruleId === 'THEORY_30_20_50') {
      const knownContribution = midterm * 0.3 + regularAvg * 0.2;
      requiredScoreRaw = (targetScore10 - knownContribution) / 0.5;
    } else if (rule.ruleId === 'COMBINED_THEORY_PRACTICE') {
      const knownTheory = midterm * 0.3 + regularAvg * 0.2;
      requiredScoreRaw = 3 * targetScore10 - practiceAvg - 2 * knownTheory;
    } else if (rule.ruleId === 'SPECIAL_FINAL_ONLY') {
      requiredScoreRaw = targetScore10;
    } else {
      if (rule.weights && typeof rule.finalExamWeight === 'number' && rule.finalExamWeight > 0) {
        const known = (midterm || 0) * (rule.weights.midterm || 0) + (regularAvg || 0) * (rule.weights.regularAvg || 0);
        requiredScoreRaw = (targetScore10 - known) / rule.finalExamWeight;
      } else {
        return {
          status: REQUIRED_SCORE_STATUS.UNKNOWN_RULE,
          target: targetMetadata,
          reason: 'Không thể giải công thức điểm cho quy tắc này.',
        };
      }
    }

    // 4. Xử lý điều kiện điểm liệt tối thiểu cuối kỳ (minFinalExam)
    const minFinal = typeof rule.minFinalExam === 'number' ? rule.minFinalExam : 0;
    let adjustedByMinFinal = false;
    let effectiveRequiredRaw = requiredScoreRaw;

    if (effectiveRequiredRaw < minFinal) {
      effectiveRequiredRaw = minFinal;
      adjustedByMinFinal = true;
    }

    // 5. Xác định status và tính minimumSelectableScore
    if (requiredScoreRaw <= 0 && minFinal <= 0) {
      return {
        status: REQUIRED_SCORE_STATUS.ALREADY_ACHIEVED,
        requiredScoreRaw: 0,
        requiredScoreDisplay: 0,
        minimumSelectableScore: 0,
        target: targetMetadata,
        targetScore10,
        reason: 'Đã đạt ngưỡng mục tiêu này với điểm thành phần hiện tại.',
      };
    }

    if (effectiveRequiredRaw > 10.0 + 1e-9) {
      return {
        status: REQUIRED_SCORE_STATUS.IMPOSSIBLE,
        requiredScoreRaw: effectiveRequiredRaw,
        target: targetMetadata,
        targetScore10,
        reason: 'Không còn khả thi trong thang điểm 0–10.',
      };
    }

    const minSelectable = ceilToStep(effectiveRequiredRaw, inputStep);
    if (minSelectable > 10.0) {
      return {
        status: REQUIRED_SCORE_STATUS.IMPOSSIBLE,
        requiredScoreRaw: effectiveRequiredRaw,
        target: targetMetadata,
        targetScore10,
        reason: 'Không còn khả thi trong thang điểm 0–10 sau khi làm tròn bước nhập.',
      };
    }

    return {
      status: REQUIRED_SCORE_STATUS.ACHIEVABLE,
      requiredScoreRaw: effectiveRequiredRaw,
      requiredScoreDisplay: Math.round(effectiveRequiredRaw * 100) / 100,
      minimumSelectableScore: minSelectable,
      adjustedByMinFinal,
      target: targetMetadata,
      targetScore10,
      reason: adjustedByMinFinal
        ? `Được điều chỉnh lên tối thiểu ${minFinal.toFixed(1)} do điều kiện điểm liệt cuối kỳ.`
        : null,
    };
  }

  /**
   * Tính điểm cuối kỳ cho tất cả các ngưỡng Grade Targets
   * @param {Object} course - Normalized course object
   * @param {Object} [ruleOverride] - Optional rule override
   * @returns {Array<Object>} List of calculation results per target
   */
  static calculateAllTargets(course, ruleOverride = null) {
    if (!course) return [];

    const rule = ruleOverride || GradingRuleEngine.detectRule(course);
    const targets = GradingRuleEngine.getTargetThresholds();

    const assessments = course.assessments || {};
    const midterm = (assessments.midterm && assessments.midterm.status === 'ok')
      ? assessments.midterm.value
      : null;

    const regularAvg = GradingRuleEngine.calculateAverage(assessments.regular || []);
    const practiceAvg = GradingRuleEngine.calculateAverage(assessments.practice || []);

    const scores = { midterm, regularAvg, practiceAvg };

    return targets.map(target => {
      const res = this.calculateRequiredFinal({
        rule,
        scores,
        targetScore10: target.min10,
        targetMetadata: target,
      });
      return {
        ...target,
        ...res,
      };
    });
  }
}

/**
 * GradeBoundaryAssistant — Pure analysis utility cho khoảng cách điểm đến bậc kế tiếp
 */
class GradeBoundaryAssistant {
  /**
   * Phân tích bậc điểm hiện tại và khoảng cách đến bậc kế tiếp
   *
   * @param {Object} params
   * @param {number|null} params.currentTotal10 - Raw simulated/observed total10
   * @param {Object} [params.course] - Course object
   * @param {Object} [params.rule] - Rule object
   * @returns {Object|null}
   */
  static analyzeBoundary(params) {
    const { currentTotal10, course, rule: ruleInput } = params || {};
    if (typeof currentTotal10 !== 'number' || isNaN(currentTotal10)) return null;

    const currentConversion = GradingRuleEngine.convertScore10(currentTotal10);
    const bands = GradingRuleEngine.DEFAULT_GRADE_BANDS;

    const currentBandIndex = bands.findIndex(b => b.letter === currentConversion.letter);
    const nextBand = currentBandIndex > 0 ? bands[currentBandIndex - 1] : null;

    let deficit10 = 0;
    let nextLetter = null;
    let nextMin10 = null;
    let nextClassification = null;
    let requiredFinalForNext = null;

    if (nextBand) {
      nextLetter = nextBand.letter;
      nextMin10 = nextBand.min10;
      nextClassification = nextBand.classification;
      deficit10 = Math.max(0, Math.round((nextBand.min10 - currentTotal10) * 100) / 100);

      if (course) {
        const rule = ruleInput || GradingRuleEngine.detectRule(course);
        const assessments = course.assessments || {};
        const scores = {
          midterm: assessments.midterm?.status === 'ok' ? assessments.midterm.value : null,
          regularAvg: GradingRuleEngine.calculateAverage(assessments.regular || []),
          practiceAvg: GradingRuleEngine.calculateAverage(assessments.practice || []),
        };

        requiredFinalForNext = RequiredScoreEngine.calculateRequiredFinal({
          rule,
          scores,
          targetScore10: nextBand.min10,
          targetMetadata: { letter: nextBand.letter, label: `Bậc ${nextBand.letter}` },
        });
      }
    }

    return {
      currentScore10: currentTotal10,
      currentLetter: currentConversion.letter,
      currentGradePoint: currentConversion.gradePoint,
      currentClassification: currentConversion.classification,
      isTopBand: currentBandIndex === 0,
      nextLetter,
      nextMin10,
      nextClassification,
      deficit10,
      requiredFinalForNext,
    };
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      RequiredScoreEngine,
      GradeBoundaryAssistant,
      REQUIRED_SCORE_STATUS,
      ceilToStep,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.RequiredScoreEngine = RequiredScoreEngine;
    root.core.GradeBoundaryAssistant = GradeBoundaryAssistant;
    root.core.REQUIRED_SCORE_STATUS = REQUIRED_SCORE_STATUS;
    root.core.ceilToStep = ceilToStep;
    global._IUHRequiredScoreEngine = {
      RequiredScoreEngine,
      GradeBoundaryAssistant,
      REQUIRED_SCORE_STATUS,
      ceilToStep,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
