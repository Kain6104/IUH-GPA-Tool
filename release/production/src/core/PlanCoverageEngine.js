(function (global) {
  'use strict';

  const numParserMod = (typeof require !== 'undefined')
    ? require('../parsers/NumberParser.js')
    : (global.IUHGPA && global.IUHGPA.parsers ? global.IUHGPA.parsers.NumberParser : (global._IUHNumberParser || {}));
  const formatAverage4 = numParserMod.formatAverage4 || ((val) => (val !== null && val !== undefined && !isNaN(val)) ? Number(val).toFixed(4).replace('.', ',') : '');

  const FutureSemesterEngine = (typeof require !== 'undefined')
    ? require('./FutureSemesterEngine.js').FutureSemesterEngine
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core.FutureSemesterEngine : null);

  const PLANNER_DISCLAIMER = 'Học phần trong kế hoạch không đồng nghĩa Nhà trường sẽ mở lớp trong học kỳ đã chọn.';

  class PlanCoverageEngine {
    /**
     * Phân tích độ bao phủ của Kế hoạch tương lai đối với Chương trình khung và Mục tiêu GPA
     *
     * @param {Object} options
     * @param {Object} options.progressSummary - Kết quả từ CurriculumProgressEngine.calculateProgress
     * @param {Object} options.futurePlan - Kế hoạch học tập tương lai { semesters: [...] }
     * @param {Object|Array} [options.actualSemestersOrSummary] - Dữ liệu thực tế để tính GPA tích lũy
     * @param {number|null} [options.targetGpa=null] - Mục tiêu GPA hệ 4 người dùng đặt
     * @returns {Object} PlanCoverageReport
     */
    static analyzePlanCoverage({ progressSummary, futurePlan, actualSemestersOrSummary = null, targetGpa = null }) {
      const semesters = (futurePlan && Array.isArray(futurePlan.semesters)) ? futurePlan.semesters : [];
      const futureSemesterCount = semesters.length;

      let plannedCourseCount = 0;
      let plannedCurriculumCredits = 0;
      let plannedGpaCredits = 0;

      semesters.forEach(s => {
        if (Array.isArray(s.courses)) {
          plannedCourseCount += s.courses.length;
          s.courses.forEach(fc => {
            const cr = fc.credits || 0;
            plannedCurriculumCredits += cr;
            if (fc.included !== false && fc.countsTowardCumulativeGPA !== false && cr > 0) {
              plannedGpaCredits += cr;
            }
          });
        }
      });

      // Lấy số liệu từ progressSummary nếu có
      const prog = progressSummary || {};
      const mand = prog.mandatory || { requiredCredits: 0, completedCredits: 0, plannedCredits: 0, remainingCredits: 0, remainingAfterPlan: 0 };
      const elec = prog.electives || { totalRequired: 0, totalCompleted: 0, totalPlanned: 0, groups: [] };

      const mandatoryCoverage = {
        required: mand.requiredCredits,
        completed: mand.completedCredits,
        planned: mand.plannedCredits,
        coveredWithPlan: Math.min(mand.requiredCredits, mand.completedCredits + mand.plannedCredits),
        remainingAfterPlan: mand.remainingAfterPlan
      };

      const electiveGroupsCoverage = (elec.groups || []).map(g => ({
        groupId: g.groupId,
        label: g.label,
        required: g.requiredCredits,
        completed: g.completedCredits,
        planned: g.plannedCredits,
        coverage: g.coverage,
        remainingAfterPlan: g.remainingCredits,
        status: g.status,
        isSatisfied: g.isSatisfied
      }));

      const electiveCoverage = {
        totalRequired: elec.totalRequired,
        totalCompleted: elec.totalCompleted,
        totalPlanned: elec.totalPlanned,
        remainingAfterPlan: electiveGroupsCoverage.reduce((sum, g) => sum + g.remainingAfterPlan, 0),
        groups: electiveGroupsCoverage
      };

      const remainingRequirementsAfterPlan = prog.curriculumRemainingAfterPlan ?? (mandatoryCoverage.remainingAfterPlan + electiveCoverage.remainingAfterPlan);
      const isPlanCoveringRemaining = remainingRequirementsAfterPlan === 0;

      // Tính toán Projected Cumulative GPA
      let projectedGPA = null;
      if (FutureSemesterEngine && actualSemestersOrSummary) {
        projectedGPA = FutureSemesterEngine.calculateProjectedCumulativeGPA(actualSemestersOrSummary, semesters);
      }

      // Smart GPA Target Insights (Requirement 33, 34, 35, 36)
      let targetInsight = null;
      if (typeof targetGpa === 'number' && !isNaN(targetGpa) && targetGpa > 0) {
        const projGpa4Raw = projectedGPA?.projectedCumulativeGPA4Raw ?? null;
        let diffToTargetRaw = null;
        let diffToTargetStr = null;

        if (projGpa4Raw !== null) {
          diffToTargetRaw = projGpa4Raw - targetGpa;
          const sign = diffToTargetRaw >= 0 ? '+' : '';
          diffToTargetStr = sign + formatAverage4(diffToTargetRaw);
        }

        let insightMessage = '';
        let achievableStatus = 'UNKNOWN';

        if (!isPlanCoveringRemaining) {
          // Requirement 34: KHÔNG NÓI "KHÔNG THỂ ĐẠT" NẾU PLAN CHƯA ĐỦ MÔN
          insightMessage = 'Kế hoạch hiện tại chưa đủ dữ liệu để kết luận toàn bộ giai đoạn còn lại.';
          achievableStatus = 'INSUFFICIENT_PLAN_COVERAGE';
        } else {
          if (diffToTargetRaw !== null) {
            if (diffToTargetRaw >= 0) {
              insightMessage = `Mục tiêu: ${formatAverage4(targetGpa)} | Dự kiến: ${formatAverage4(projGpa4Raw)} | Vượt mục tiêu: ${diffToTargetStr}`;
              achievableStatus = 'ACHIEVABLE_SURPASSED';
            } else {
              insightMessage = `Mục tiêu: ${formatAverage4(targetGpa)} | Dự kiến: ${formatAverage4(projGpa4Raw)} | Chênh lệch: ${diffToTargetStr}`;
              achievableStatus = 'ACHIEVABLE_GAP';
            }
          }
        }

        // Tính required average cho các tín chỉ GPA còn thiếu (chỉ khi có căn cứ rõ ràng)
        // Tuyệt đối KHÔNG dùng total curriculum credits (e.g. 144) làm GPA credits! (Requirement 36)
        let requiredAverageForUnplanned = null;
        if (!isPlanCoveringRemaining && prog.gpaEligibleCompletedCredits && projectedGPA) {
          // Chỉ ước lượng nếu xác định được số tín chỉ GPA còn thiếu
        }

        targetInsight = {
          targetGpa,
          targetGpaFormatted: formatAverage4(targetGpa),
          projectedGpaRaw: projGpa4Raw,
          projectedGpaFormatted: projGpa4Raw !== null ? formatAverage4(projGpa4Raw) : '--',
          differenceToTargetRaw: diffToTargetRaw,
          differenceToTargetFormatted: diffToTargetStr,
          isPlanCoveringRemaining,
          achievableStatus,
          message: insightMessage,
          requiredAverageForUnplanned
        };
      }

      return {
        futureSemesterCount,
        plannedCourseCount,
        plannedCurriculumCredits,
        plannedGpaCredits,
        mandatoryCoverage,
        electiveCoverage,
        remainingRequirementsAfterPlan,
        isPlanCoveringRemaining,
        projectedGPA,
        targetInsight,
        disclaimer: PLANNER_DISCLAIMER
      };
    }
  }

  PlanCoverageEngine.PLANNER_DISCLAIMER = PLANNER_DISCLAIMER;
  PlanCoverageEngine.analyzePlanCoverage = PlanCoverageEngine.analyzePlanCoverage;
  PlanCoverageEngine.PlanCoverageEngine = PlanCoverageEngine;

  const api = {
    PlanCoverageEngine,
    PLANNER_DISCLAIMER,
    analyzePlanCoverage: PlanCoverageEngine.analyzePlanCoverage
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  const targets = [];
  if (typeof globalThis !== 'undefined') targets.push(globalThis);
  if (typeof window !== 'undefined' && !targets.includes(window)) targets.push(window);
  if (typeof global !== 'undefined' && !targets.includes(global)) targets.push(global);
  targets.forEach(t => {
    t.IUHGPA = t.IUHGPA || {};
    t.IUHGPA.core = t.IUHGPA.core || {};
    t.IUHGPA.core.PlanCoverageEngine = PlanCoverageEngine;
    t.IUHGPA.core.PLANNER_DISCLAIMER = PLANNER_DISCLAIMER;
    t._IUHPlanCoverageEngine = api;
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
