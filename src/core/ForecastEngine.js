(function (global) {
  'use strict';

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('./GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

  /**
   * Các mức kịch bản GPA tương lai mặc định
   */
  const DEFAULT_FORECAST_SCENARIOS = [2.0, 2.5, 3.0, 3.2, 3.5, 3.7, 4.0];

class ForecastEngine {
  /**
   * Tính GPA dự kiến cho một mức GPA tương lai cụ thể
   *
   * @param {Object} params
   * @param {number} params.currentGradePoints - Tổng điểm chữ quy đổi hiện tại (sumWeighted4 raw)
   * @param {number} params.currentCredits - Tổng tín chỉ tính GPA hiện tại
   * @param {number} params.futureAverage - GPA trung bình giả định cho phần còn lại (0.0 - 4.0)
   * @param {number} params.remainingCredits - Tín chỉ còn lại dự kiến
   * @returns {Object} Forecast single point result
   */
  static calculateProjectedGPA(params) {
    if (!params || typeof params !== 'object') {
      return {
        status: 'INVALID_INPUT',
        reason: 'Dữ liệu đầu vào không hợp lệ.',
      };
    }

    const {
      currentGradePoints,
      currentCredits,
      futureAverage,
      remainingCredits,
    } = params;

    if (
      typeof currentCredits !== 'number' || isNaN(currentCredits) || currentCredits < 0 ||
      typeof remainingCredits !== 'number' || isNaN(remainingCredits) || remainingCredits < 0 ||
      typeof currentGradePoints !== 'number' || isNaN(currentGradePoints) || currentGradePoints < 0 ||
      typeof futureAverage !== 'number' || isNaN(futureAverage) || futureAverage < 0 || futureAverage > 4.0
    ) {
      return {
        status: 'INVALID_INPUT',
        reason: 'Các tham số tính toán phải là số không âm hợp lệ trong phạm vi cho phép.',
      };
    }

    const totalCredits = currentCredits + remainingCredits;

    // Zero credits total case
    if (totalCredits === 0) {
      return {
        status: 'NO_CREDITS',
        projectedGPARaw: 0,
        projectedGPADisplay: 0.0,
        currentCredits: 0,
        remainingCredits: 0,
        totalCredits: 0,
        futureAverage,
        classification: 'Chưa xếp loại',
        reason: 'Chưa có tín chỉ để dự báo.',
      };
    }

    // projected = (currentGradePoints + futureAverage * remainingCredits) / (currentCredits + remainingCredits)
    const futureGradePoints = futureAverage * remainingCredits;
    const projectedTotalGradePoints = currentGradePoints + futureGradePoints;
    const projectedGPARaw = projectedTotalGradePoints / totalCredits;
    const projectedGPADisplay = Math.round(projectedGPARaw * 100) / 100;
    const classification = GradingRuleEngine.getClassification4(projectedGPADisplay);

    return {
      status: 'OK',
      projectedGPARaw,
      projectedGPADisplay,
      currentCredits,
      remainingCredits,
      totalCredits,
      futureAverage,
      classification,
      disclaimer: 'GPA dự kiến theo thông số bạn nhập, không bao gồm các điều kiện tốt nghiệp khác.',
    };
  }

  /**
   * Tạo bảng dự báo cho danh sách các mức kịch bản GPA tương lai
   *
   * @param {Object} params
   * @param {number} params.currentGradePoints - Tổng điểm chữ quy đổi hiện tại
   * @param {number} params.currentCredits - Tín chỉ hiện tại
   * @param {number} params.remainingCredits - Tín chỉ còn lại dự kiến
   * @param {Array<number>} [params.scenarios=DEFAULT_FORECAST_SCENARIOS] - Danh sách GPA tương lai
   * @returns {Array<Object>} Danh sách các dòng dự báo
   */
  static generateForecastTable(params) {
    const scenarios = params?.scenarios || DEFAULT_FORECAST_SCENARIOS;
    const { currentGradePoints = 0, currentCredits = 0, remainingCredits = 0 } = params || {};

    return scenarios.map(futureAvg => {
      const res = this.calculateProjectedGPA({
        currentGradePoints,
        currentCredits,
        futureAverage: futureAvg,
        remainingCredits,
      });

      return {
        futureAverage: futureAvg,
        projectedGPARaw: res.projectedGPARaw,
        projectedGPADisplay: res.projectedGPADisplay,
        classification: res.classification,
        status: res.status,
      };
    });
  }
}

ForecastEngine.DEFAULT_FORECAST_SCENARIOS = DEFAULT_FORECAST_SCENARIOS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ForecastEngine,
      DEFAULT_FORECAST_SCENARIOS,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.ForecastEngine = ForecastEngine;
    root.core.DEFAULT_FORECAST_SCENARIOS = DEFAULT_FORECAST_SCENARIOS;
    global._IUHForecastEngine = {
      ForecastEngine,
      DEFAULT_FORECAST_SCENARIOS,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
