(function (global) {
  'use strict';

const TARGET_STATUS = {
  ACHIEVABLE: 'ACHIEVABLE',
  ALREADY_MET: 'ALREADY_MET',
  IMPOSSIBLE: 'IMPOSSIBLE',
  NO_REMAINING_CREDITS: 'NO_REMAINING_CREDITS',
  INVALID_INPUT: 'INVALID_INPUT',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
};

/**
 * Các ngưỡng nhãn độ khó khách quan (UX helpers)
 */
const DIFFICULTY_LEVELS = [
  { max: 2.50, label: 'Yêu cầu trung bình thấp', code: 'LOW' },
  { max: 3.20, label: 'Yêu cầu trung bình vừa', code: 'MODERATE' },
  { max: 3.60, label: 'Yêu cầu trung bình cao', code: 'HIGH' },
  { max: 4.00, label: 'Yêu cầu gần mức tối đa', code: 'VERY_HIGH' },
];

/**
 * Các preset mục tiêu phổ biến (chỉ là phím tắt nhập liệu, không phải danh hiệu chính thức)
 */
const TARGET_PRESETS = [
  { value: 2.50, label: '2.50 (Khá)' },
  { value: 3.00, label: '3.00' },
  { value: 3.20, label: '3.20 (Giỏi)' },
  { value: 3.40, label: '3.40' },
  { value: 3.60, label: '3.60 (Xuất sắc)' },
  { value: 3.80, label: '3.80' },
];

class GPATargetEngine {
  /**
   * Tính toán GPA trung bình cần đạt cho phần tín chỉ còn lại
   *
   * @param {Object} params
   * @param {number} params.currentGradePoints - Tổng điểm chữ quy đổi (sum of gradePoint * credits, full precision)
   * @param {number} params.currentCredits - Tổng tín chỉ tính GPA hiện tại
   * @param {number} params.targetGPA - GPA mục tiêu hệ 4 (0 <= target <= scaleMax)
   * @param {number} params.remainingCredits - Tín chỉ còn lại dự kiến do người dùng nhập
   * @param {number} [params.scaleMax=4.0] - Thang điểm tối đa (mặc định 4.0)
   * @returns {Object} Target planning result
   */
  static calculateRequiredFutureGPA(params) {
    if (!params || typeof params !== 'object') {
      return {
        status: TARGET_STATUS.INVALID_INPUT,
        reason: 'Dữ liệu đầu vào không hợp lệ.',
      };
    }

    const {
      currentGradePoints,
      currentCredits,
      targetGPA,
      remainingCredits,
      scaleMax = 4.0,
    } = params;

    // Validate targetGPA
    if (typeof targetGPA !== 'number' || isNaN(targetGPA) || !isFinite(targetGPA) || targetGPA < 0 || targetGPA > scaleMax) {
      return {
        status: TARGET_STATUS.INVALID_INPUT,
        reason: `GPA mục tiêu không hợp lệ (phải từ 0 đến ${scaleMax.toFixed(2)}).`,
      };
    }

    // Validate remainingCredits
    if (typeof remainingCredits !== 'number' || isNaN(remainingCredits) || !isFinite(remainingCredits) || remainingCredits < 0) {
      return {
        status: TARGET_STATUS.INVALID_INPUT,
        reason: 'Số tín chỉ còn lại phải là số không âm hợp lệ.',
      };
    }

    // Sanity upper bound check for credits
    if (remainingCredits > 500) {
      return {
        status: TARGET_STATUS.INVALID_INPUT,
        reason: 'Số tín chỉ còn lại vượt quá giới hạn hợp lý (> 500 tín chỉ).',
      };
    }

    // Validate currentCredits and currentGradePoints
    if (typeof currentCredits !== 'number' || isNaN(currentCredits) || !isFinite(currentCredits) || currentCredits < 0) {
      return {
        status: TARGET_STATUS.INVALID_INPUT,
        reason: 'Số tín chỉ hiện tại không hợp lệ.',
      };
    }

    if (typeof currentGradePoints !== 'number' || isNaN(currentGradePoints) || !isFinite(currentGradePoints) || currentGradePoints < 0) {
      return {
        status: TARGET_STATUS.INVALID_INPUT,
        reason: 'Tổng điểm quy đổi hiện tại không hợp lệ.',
      };
    }

    // Case: remainingCredits === 0
    if (remainingCredits === 0) {
      if (currentCredits === 0) {
        return {
          status: TARGET_STATUS.NO_REMAINING_CREDITS,
          targetGPA,
          remainingCredits: 0,
          currentCredits: 0,
          requiredFutureAverageRaw: null,
          requiredFutureAverageDisplay: null,
          difficulty: null,
          reason: 'Chưa có tín chỉ hiện tại và không có tín chỉ còn lại.',
        };
      }

      const currentGPARaw = currentGradePoints / currentCredits;
      const isMet = currentGPARaw >= targetGPA - 1e-9;
      return {
        status: isMet ? TARGET_STATUS.ALREADY_MET : TARGET_STATUS.IMPOSSIBLE,
        targetGPA,
        remainingCredits: 0,
        currentCredits,
        currentGPARaw,
        currentGPADisplay: Math.round(currentGPARaw * 100) / 100,
        requiredFutureAverageRaw: null,
        requiredFutureAverageDisplay: null,
        difficulty: isMet ? { label: 'Đã đạt mục tiêu', code: 'MET' } : { label: 'Không thể đạt', code: 'IMPOSSIBLE' },
        reason: isMet
          ? 'Không còn tín chỉ, GPA hiện tại đã đạt hoặc vượt mục tiêu.'
          : 'Không còn tín chỉ để cải thiện GPA đạt mục tiêu.',
      };
    }

    // Normal calculation:
    // requiredFutureAverage = (targetGPA * (currentCredits + remainingCredits) - currentGradePoints) / remainingCredits
    const totalCredits = currentCredits + remainingCredits;
    const requiredGradePointsTotal = targetGPA * totalCredits;
    const neededFutureGradePoints = requiredGradePointsTotal - currentGradePoints;
    const requiredFutureAverageRaw = neededFutureGradePoints / remainingCredits;

    // Tolerance check for floating point
    const EPS = 1e-9;

    // Case: target already met (required average <= 0)
    if (requiredFutureAverageRaw <= EPS) {
      return {
        status: TARGET_STATUS.ALREADY_MET,
        targetGPA,
        remainingCredits,
        currentCredits,
        totalCredits,
        requiredFutureAverageRaw: Math.max(0, requiredFutureAverageRaw),
        requiredFutureAverageDisplay: 0.0,
        difficulty: { label: 'Đã đạt mục tiêu', code: 'MET' },
        reason: 'Với số điểm hiện tại, bạn đã đạt mục tiêu ngay cả khi phần còn lại là 0.0.',
      };
    }

    // Case: impossible (required average > scaleMax)
    if (requiredFutureAverageRaw > scaleMax + EPS) {
      return {
        status: TARGET_STATUS.IMPOSSIBLE,
        targetGPA,
        remainingCredits,
        currentCredits,
        totalCredits,
        requiredFutureAverageRaw,
        requiredFutureAverageDisplay: Math.round(requiredFutureAverageRaw * 100) / 100,
        difficulty: { label: 'Vượt quá thang điểm tối đa (4.0)', code: 'EXCEEDED' },
        reason: `Cần GPA trung bình ${requiredFutureAverageRaw.toFixed(2)}, vượt quá mức tối đa ${scaleMax.toFixed(2)}.`,
      };
    }

    // Case: achievable (0 < requiredFutureAverage <= scaleMax)
    const difficulty = this.getDifficultyLabel(requiredFutureAverageRaw);

    return {
      status: TARGET_STATUS.ACHIEVABLE,
      targetGPA,
      remainingCredits,
      currentCredits,
      totalCredits,
      requiredFutureAverageRaw,
      requiredFutureAverageDisplay: Math.round(requiredFutureAverageRaw * 100) / 100,
      difficulty,
      reason: null,
    };
  }

  /**
   * Xác định nhãn độ khó khách quan dựa trên GPA yêu cầu
   * @param {number} requiredGPA
   * @returns {{ label: string, code: string }}
   */
  static getDifficultyLabel(requiredGPA) {
    if (requiredGPA <= 0) {
      return { label: 'Đã đạt mục tiêu', code: 'MET' };
    }
    for (const level of DIFFICULTY_LEVELS) {
      if (requiredGPA <= level.max + 1e-9) {
        return level;
      }
    }
    return { label: 'Vượt quá thang điểm tối đa (4.0)', code: 'EXCEEDED' };
  }

  /**
   * Danh sách preset
   */
  static getPresets() {
    return TARGET_PRESETS;
  }
}

GPATargetEngine.TARGET_STATUS = TARGET_STATUS;
GPATargetEngine.DIFFICULTY_LEVELS = DIFFICULTY_LEVELS;
GPATargetEngine.TARGET_PRESETS = TARGET_PRESETS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      GPATargetEngine,
      TARGET_STATUS,
      DIFFICULTY_LEVELS,
      TARGET_PRESETS,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.GPATargetEngine = GPATargetEngine;
    root.core.TARGET_STATUS = TARGET_STATUS;
    root.core.DIFFICULTY_LEVELS = DIFFICULTY_LEVELS;
    root.core.TARGET_PRESETS = TARGET_PRESETS;
    global._IUHGPATargetEngine = {
      GPATargetEngine,
      TARGET_STATUS,
      DIFFICULTY_LEVELS,
      TARGET_PRESETS,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
