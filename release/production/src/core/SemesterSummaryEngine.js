(function (global) {
  'use strict';

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('./GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

  const GPAEngine = (typeof require !== 'undefined')
    ? require('./GPAEngine.js').GPAEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GPAEngine
        ? global.IUHGPA.core.GPAEngine
        : (global._IUHGPAEngine ? global._IUHGPAEngine.GPAEngine : null));

class SemesterSummaryEngine {
  /**
   * Tính toán báo cáo tổng kết chi tiết cho một danh sách môn học của học kỳ
   *
   * @param {Array<Object>|Object} input - Mảng môn học hoặc Semester object
   * @param {Object} [options]
   * @returns {Object} Semester summary object
   */
  static summarizeSemester(input, options = {}) {
    const courses = Array.isArray(input)
      ? input
      : (input && Array.isArray(input.courses) ? input.courses : []);

    const semesterKey = input?.semesterKey || null;
    const semesterName = input?.semesterName || 'Học kỳ';

    // 1. Khởi tạo phân bố điểm chữ tự động từ DEFAULT_GRADE_BANDS
    const bands = GradingRuleEngine.DEFAULT_GRADE_BANDS || [];
    const gradeDistribution = {};
    for (const b of bands) {
      gradeDistribution[b.letter] = 0;
    }

    let totalCourses = 0;
    let totalCredits = 0;
    let eligibleCredits = 0;
    let earnedCredits = 0;
    let failedCredits = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let unknownRuleCount = 0;

    const validGradedCourses = [];

    for (const c of courses) {
      if (c.included === false) continue;
      totalCourses++;

      let credits = 0;
      if (typeof c.credits === 'number') {
        credits = c.credits;
      } else if (c.credits && c.credits.status === 'ok' && typeof c.credits.value === 'number') {
        credits = c.credits.value;
      }
      totalCredits += credits;

      const isExcluded = Boolean(c.isExcludedFromGpa) || (credits === 0) || (c.countsTowardGPA === false) || (c.includeInGPA === false);

      // Điểm số
      let score10 = null;
      let score4 = null;
      let letter = null;
      let passed = null;

      if (typeof c.simulatedScore4 === 'number') {
        score4 = c.simulatedScore4;
        score10 = typeof c.simulatedScore10 === 'number' ? c.simulatedScore10 : c.score10;
        letter = c.simulatedGradeLetter || c.letter;
        passed = c.simulatedPassed !== undefined ? c.simulatedPassed : c.passed;
      } else if (typeof c.score4 === 'number') {
        score4 = c.score4;
        score10 = typeof c.score10 === 'number' ? c.score10 : null;
        letter = c.letter || null;
        passed = typeof c.passed === 'boolean' ? c.passed : (score10 !== null ? score10 >= 4.0 : null);
      } else if (c.officialResult) {
        if (c.officialResult.score4 && c.officialResult.score4.status === 'ok') {
          score4 = c.officialResult.score4.value;
        }
        if (c.officialResult.total10 && c.officialResult.total10.status === 'ok') {
          score10 = c.officialResult.total10.value;
        }
        letter = c.officialResult.letter || null;
        passed = typeof c.officialResult.passed === 'boolean' ? c.officialResult.passed : (score10 !== null ? score10 >= 4.0 : null);
      }

      // Suy luận letter nếu chưa có mà có score10
      if (!letter && score10 !== null) {
        const conv = GradingRuleEngine.convertScore10(score10);
        if (conv) {
          letter = conv.letter;
          if (score4 === null) score4 = conv.gradePoint;
          if (passed === null) passed = conv.passed;
        }
      }

      // XỬ LÝ QUAN TRỌNG: Phân biệt missing và fail!
      // Nếu không có score10 và không có score4 -> Chưa hoàn thành (missing/in-progress)
      if (score10 === null && score4 === null) {
        inProgressCount++;
        continue;
      }

      completedCount++;

      // Cập nhật phân bố điểm chữ
      if (letter && gradeDistribution[letter] !== undefined) {
        gradeDistribution[letter]++;
      }

      if (passed === true) {
        earnedCredits += credits;
      } else if (passed === false) {
        failedCredits += credits;
      }

      // Môn tham gia tính GPA
      if (!isExcluded && credits > 0 && score4 !== null) {
        eligibleCredits += credits;
        validGradedCourses.push({
          id: c.id || c.courseClassCode,
          courseName: c.courseName,
          credits,
          score10,
          score4,
          letter,
          passed,
        });
      }
    }

    // 2. Tính GPA học kỳ qua GPAEngine
    const gpaResult = GPAEngine.calculateGPA(courses);

    // 3. Tìm môn có grade point cao nhất / thấp nhất trong kỳ
    let highestCourse = null;
    let lowestCourse = null;

    if (validGradedCourses.length > 0) {
      // Sort theo score4
      const sorted = [...validGradedCourses].sort((a, b) => {
        if (b.score4 !== a.score4) return b.score4 - a.score4;
        return (b.score10 || 0) - (a.score10 || 0);
      });

      highestCourse = {
        courseName: sorted[0].courseName,
        credits: sorted[0].credits,
        score4: sorted[0].score4,
        score10: sorted[0].score10,
        letter: sorted[0].letter,
      };

      lowestCourse = {
        courseName: sorted[sorted.length - 1].courseName,
        credits: sorted[sorted.length - 1].credits,
        score4: sorted[sorted.length - 1].score4,
        score10: sorted[sorted.length - 1].score10,
        letter: sorted[sorted.length - 1].letter,
      };
    }

    return {
      semesterKey,
      semesterName,
      totalCourses,
      totalCredits,
      eligibleCredits,
      earnedCredits,
      failedCredits,
      completedCount,
      inProgressCount,
      gpa4Raw: gpaResult.gpa4Raw,
      gpa4Display: gpaResult.gpa4,
      gpa10Raw: gpaResult.gpa10Raw,
      gpa10Display: gpaResult.gpa10,
      classification4: gpaResult.classification4,
      classification10: gpaResult.classification10,
      gradeDistribution,
      highestCourse,
      lowestCourse,
    };
  }

  /**
   * So sánh tổng kết học kỳ giữa Dữ liệu gốc và Mô phỏng
   * @param {Object} originalSummary
   * @param {Object} simulatedSummary
   * @returns {Object}
   */
  static compareSemesterSummaries(originalSummary, simulatedSummary) {
    if (!originalSummary || !simulatedSummary) {
      return { hasDelta: false };
    }

    const gpa4Delta = (simulatedSummary.gpa4Display !== null && originalSummary.gpa4Display !== null)
      ? Math.round((simulatedSummary.gpa4Display - originalSummary.gpa4Display) * 100) / 100
      : 0;

    const gpa10Delta = (simulatedSummary.gpa10Display !== null && originalSummary.gpa10Display !== null)
      ? Math.round((simulatedSummary.gpa10Display - originalSummary.gpa10Display) * 100) / 100
      : 0;

    const earnedCreditsDelta = (simulatedSummary.earnedCredits || 0) - (originalSummary.earnedCredits || 0);

    return {
      hasDelta: gpa4Delta !== 0 || gpa10Delta !== 0 || earnedCreditsDelta !== 0,
      gpa4Delta,
      gpa10Delta,
      earnedCreditsDelta,
      original: originalSummary,
      simulated: simulatedSummary,
    };
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SemesterSummaryEngine,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.SemesterSummaryEngine = SemesterSummaryEngine;
    global._IUHSemesterSummaryEngine = {
      SemesterSummaryEngine,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
