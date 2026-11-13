(function (global) {
  'use strict';

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('./GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

  const RETAKE_DISCLAIMER =
    'Kết quả học lại/cải thiện chỉ là mô phỏng tác động toán học. ' +
    'Cách IUH ghi nhận điểm học lại hoặc điểm thay thế phụ thuộc quy định đào tạo hiện hành. ' +
    'Công cụ không thay thế quy định học lại/học cải thiện chính thức.';

class GPARescueEngine {
  /**
   * Phân tích và xếp hạng tác động cải thiện điểm cho danh sách môn học
   *
   * @param {Object} params
   * @param {Array<Object>} params.courses - Danh sách môn học (đã chuẩn hóa hoặc từ SimulationStore)
   * @param {number} params.currentTotalGradePoints - Tổng điểm chữ quy đổi tích lũy hiện tại (full precision)
   * @param {number} params.eligibleCredits - Tổng số tín chỉ tính GPA tích lũy
   * @param {string} [params.defaultTargetLetter='B+'] - Bậc điểm mục tiêu mặc định ('B', 'B+', 'A', 'A+')
   * @returns {Object} Rescue analysis result with ranked courses and exclusions
   */
  static analyzeRescuePriorities(params) {
    if (!params || typeof params !== 'object') {
      return {
        status: 'INVALID_INPUT',
        rankedCourses: [],
        excludedCourses: [],
        disclaimer: RETAKE_DISCLAIMER,
      };
    }

    const {
      courses = [],
      currentTotalGradePoints,
      eligibleCredits,
      defaultTargetLetter = 'B+',
    } = params;

    if (
      typeof currentTotalGradePoints !== 'number' || isNaN(currentTotalGradePoints) || currentTotalGradePoints < 0 ||
      typeof eligibleCredits !== 'number' || isNaN(eligibleCredits) || eligibleCredits <= 0
    ) {
      return {
        status: 'INSUFFICIENT_DATA',
        rankedCourses: [],
        excludedCourses: [],
        disclaimer: RETAKE_DISCLAIMER,
        reason: 'Chưa đủ dữ liệu tín chỉ hoặc điểm tích lũy để phân tích cải thiện.',
      };
    }

    const bands = GradingRuleEngine.DEFAULT_GRADE_BANDS || [];
    const validTargetBands = bands.filter(b => b.passed && b.gradePoint > 0);

    // Tìm gradePoint cho defaultTargetLetter
    const defaultTargetBand = validTargetBands.find(b => b.letter === defaultTargetLetter)
      || validTargetBands.find(b => b.letter === 'B+')
      || validTargetBands[0];

    const rankedCourses = [];
    const excludedCourses = [];

    for (const course of courses) {
      const eligibility = this.checkCourseEligibility(course);
      if (!eligibility.eligible) {
        excludedCourses.push({
          courseId: course.id || course.courseCode,
          courseName: course.courseName,
          credits: course.credits?.value ?? course.credits ?? 0,
          reason: eligibility.reason,
        });
        continue;
      }

      const credits = eligibility.credits;
      const currentGradePoint = eligibility.currentGradePoint;
      const currentLetter = eligibility.currentLetter;
      const currentScore10 = eligibility.currentScore10;

      // Danh sách tất cả các bậc có thể nâng lên (gradePoint > currentGradePoint)
      const upgradeOptions = [];

      for (const band of validTargetBands) {
        if (band.gradePoint > currentGradePoint) {
          const deltaGradePoints = (band.gradePoint - currentGradePoint) * credits;
          const gpaDeltaRaw = deltaGradePoints / eligibleCredits;
          const newCumulativeGPARaw = (currentTotalGradePoints + deltaGradePoints) / eligibleCredits;

          upgradeOptions.push({
            targetLetter: band.letter,
            targetGradePoint: band.gradePoint,
            targetMin10: band.min10,
            deltaGradePoints,
            gpaDeltaRaw,
            gpaDeltaDisplay: Math.round(gpaDeltaRaw * 1000) / 1000,
            newCumulativeGPARaw,
            newCumulativeGPADisplay: Math.round(newCumulativeGPARaw * 100) / 100,
          });
        }
      }

      // Nếu không có bậc nào cao hơn (đã đạt A+ cao nhất)
      if (upgradeOptions.length === 0) {
        excludedCourses.push({
          courseId: course.id || course.courseCode,
          courseName: course.courseName,
          credits,
          reason: 'Đã đạt bậc điểm cao nhất (A+).',
        });
        continue;
      }

      // Tính toán cho target mặc định hoặc bậc cao nhất nếu target mặc định <= currentGradePoint
      let selectedOption = upgradeOptions.find(opt => opt.targetLetter === defaultTargetBand.letter);
      if (!selectedOption) {
        // Lấy option cao nhất hiện có
        selectedOption = upgradeOptions[upgradeOptions.length - 1];
      }

      rankedCourses.push({
        courseId: course.id || course.courseCode,
        courseCode: course.courseCode,
        courseName: course.courseName,
        semesterId: course.semesterId || null,
        credits,
        currentLetter,
        currentGradePoint,
        currentScore10,
        selectedTargetLetter: selectedOption.targetLetter,
        selectedTargetGradePoint: selectedOption.targetGradePoint,
        deltaGradePoints: selectedOption.deltaGradePoints,
        gpaDeltaRaw: selectedOption.gpaDeltaRaw,
        gpaDeltaDisplay: selectedOption.gpaDeltaDisplay,
        newCumulativeGPARaw: selectedOption.newCumulativeGPARaw,
        newCumulativeGPADisplay: selectedOption.newCumulativeGPADisplay,
        upgradeOptions,
      });
    }

    // Xếp hạng giảm dần theo gpaDeltaRaw (tác động lớn nhất lên đầu)
    rankedCourses.sort((a, b) => {
      if (Math.abs(b.gpaDeltaRaw - a.gpaDeltaRaw) > 1e-9) {
        return b.gpaDeltaRaw - a.gpaDeltaRaw;
      }
      // Nếu delta bằng nhau, ưu tiên môn nhiều tín chỉ hơn
      return b.credits - a.credits;
    });

    return {
      status: 'OK',
      rankedCourses,
      excludedCourses,
      totalAnalyzed: rankedCourses.length,
      totalExcluded: excludedCourses.length,
      eligibleCredits,
      currentTotalGradePoints,
      currentCumulativeGPA: Math.round((currentTotalGradePoints / eligibleCredits) * 100) / 100,
      defaultTargetLetter: defaultTargetBand.letter,
      disclaimer: RETAKE_DISCLAIMER,
    };
  }

  /**
   * Kiểm tra tính hợp lệ của môn học để đưa vào danh sách Rescue
   * @param {Object} course
   * @returns {{ eligible: boolean, reason?: string, credits?: number, currentGradePoint?: number, currentLetter?: string, currentScore10?: number }}
   */
  static checkCourseEligibility(course) {
    if (!course || typeof course !== 'object') {
      return { eligible: false, reason: 'Dữ liệu môn không hợp lệ.' };
    }

    // 1. Kiểm tra tín chỉ
    let credits = 0;
    if (typeof course.credits === 'number') {
      credits = course.credits;
    } else if (course.credits && course.credits.status === 'ok' && typeof course.credits.value === 'number') {
      credits = course.credits.value;
    }

    if (credits <= 0) {
      return { eligible: false, reason: 'Môn 0 tín chỉ.' };
    }

    // 2. Kiểm tra môn có tính GPA không (ví dụ Giáo dục thể chất, QP-AN)
    const nameLower = (course.courseName || course.name || '').toLowerCase();
    const isNonGpaByName = /giáo dục quốc phòng|quốc phòng và an ninh|giáo dục thể chất|tiếng anh [1-4]|chứng chỉ tiếng anh/i.test(nameLower);

    if (
      course.isExplicitNonGpa === true ||
      course.countsTowardCumulativeGPA === false ||
      course.countsTowardGPA === false ||
      course.includeInGPA === false ||
      course.isExcludedFromGpa === true ||
      course.included === false ||
      course.hasAsterisk === true ||
      (course.curriculumCourse && course.curriculumCourse.countsTowardCumulativeGPA === false) ||
      (course.curriculumCourse && course.curriculumCourse.hasAsterisk === true) ||
      course.courseTypeOverride === 'EXCLUDED' ||
      course.isFallbackNonGpa === true ||
      isNonGpaByName
    ) {
      return { eligible: false, reason: 'Môn không tính vào điểm trung bình tích lũy (GPA).' };
    }

    // 3. Kiểm tra điểm hệ 4 và điểm chữ hiện tại
    let currentGradePoint = null;
    let currentLetter = null;
    let currentScore10 = null;

    if (typeof course.simulatedScore4 === 'number') {
      currentGradePoint = course.simulatedScore4;
      currentLetter = course.simulatedGradeLetter || null;
      currentScore10 = course.simulatedTotal10 ?? null;
    } else if (typeof course.score4 === 'number') {
      currentGradePoint = course.score4;
      currentLetter = course.gradeLetter || null;
      currentScore10 = typeof course.totalScore === 'number' ? course.totalScore : null;
    } else if (course.score4 && course.score4.status === 'ok') {
      currentGradePoint = course.score4.value;
      currentLetter = course.gradeLetter?.value || course.gradeLetter || null;
      currentScore10 = course.totalScore?.value ?? null;
    }

    if (currentGradePoint === null || isNaN(currentGradePoint) || currentGradePoint < 0) {
      return { eligible: false, reason: 'Môn chưa có điểm hệ 4 hoặc điểm không hợp lệ.' };
    }

    // Nếu chưa có letter, suy luận từ score10 hoặc gradePoint
    if (!currentLetter) {
      const band = (GradingRuleEngine.DEFAULT_GRADE_BANDS || []).find(b => Math.abs(b.gradePoint - currentGradePoint) < 1e-4);
      currentLetter = band ? band.letter : 'D';
    }

    return {
      eligible: true,
      credits,
      currentGradePoint,
      currentLetter,
      currentScore10,
    };
  }

  /**
   * Tính lại tác động cho một môn học cụ thể khi người dùng chọn bậc điểm đích khác
   * @param {Object} params
   * @param {number} params.credits
   * @param {number} params.currentGradePoint
   * @param {number} params.targetGradePoint
   * @param {number} params.currentTotalGradePoints
   * @param {number} params.eligibleCredits
   * @returns {Object}
   */
  static calculateSingleCourseImpact(params) {
    const {
      credits,
      currentGradePoint,
      targetGradePoint,
      currentTotalGradePoints,
      eligibleCredits,
    } = params;

    if (
      typeof credits !== 'number' || credits <= 0 ||
      typeof currentGradePoint !== 'number' || currentGradePoint < 0 ||
      typeof targetGradePoint !== 'number' || targetGradePoint < 0 ||
      typeof currentTotalGradePoints !== 'number' ||
      typeof eligibleCredits !== 'number' || eligibleCredits <= 0
    ) {
      return null;
    }

    const deltaGradePoints = (targetGradePoint - currentGradePoint) * credits;
    const gpaDeltaRaw = deltaGradePoints / eligibleCredits;
    const newCumulativeGPARaw = (currentTotalGradePoints + deltaGradePoints) / eligibleCredits;

    return {
      deltaGradePoints,
      gpaDeltaRaw,
      gpaDeltaDisplay: Math.round(gpaDeltaRaw * 1000) / 1000,
      newCumulativeGPARaw,
      newCumulativeGPADisplay: Math.round(newCumulativeGPARaw * 100) / 100,
    };
  }
}

GPARescueEngine.RETAKE_DISCLAIMER = RETAKE_DISCLAIMER;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      GPARescueEngine,
      RETAKE_DISCLAIMER,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.GPARescueEngine = GPARescueEngine;
    root.core.RETAKE_DISCLAIMER = RETAKE_DISCLAIMER;
    global._IUHGPARescueEngine = {
      GPARescueEngine,
      RETAKE_DISCLAIMER,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
