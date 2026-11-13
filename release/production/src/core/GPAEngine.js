(function (global) {
  'use strict';

  const GradingRuleEngine = (typeof require !== 'undefined')
    ? require('./GradingRuleEngine.js').GradingRuleEngine
    : (global.IUHGPA && global.IUHGPA.core && global.IUHGPA.core.GradingRuleEngine
        ? global.IUHGPA.core.GradingRuleEngine
        : (global._IUHGradingRuleEngine ? global._IUHGradingRuleEngine.GradingRuleEngine : null));

/**
 * @typedef {Object} CourseCalcInput
 * @property {string} id
 * @property {string} [courseClassCode]
 * @property {number} credits
 * @property {number|null} score10
 * @property {number|null} [score4]
 * @property {boolean} [passed]
 * @property {boolean} [included]
 * @property {boolean} [isExcludedFromGpa]
 */

/**
 * @typedef {Object} GPACalculationResult
 * @property {number|null} gpa10          - Điểm TB thang 10 (làm tròn 2 chữ số cho hiển thị)
 * @property {number|null} gpa4           - Điểm TB thang 4 (làm tròn 2 chữ số cho hiển thị)
 * @property {number|null} gpa10Raw       - Điểm TB thang 10 giữ nguyên độ chính xác thực (full precision float)
 * @property {number|null} gpa4Raw        - Điểm TB thang 4 giữ nguyên độ chính xác thực (full precision float)
 * @property {number} totalCredits        - Tổng số tín chỉ đăng ký
 * @property {number} gradedCredits       - Số tín chỉ đã có điểm và tham gia tính GPA
 * @property {number} earnedCredits       - Số tín chỉ tích lũy (đạt)
 * @property {number} failedCredits       - Số tín chỉ không đạt (F)
 * @property {string} classification4     - Xếp loại theo thang 4
 * @property {string} classification10    - Xếp loại theo thang 10
 */

class GPAEngine {
  /**
   * Làm tròn số thực tới N chữ số thập phân cho mục đích hiển thị
   * @param {number} value
   * @param {number} [decimals=2]
   * @returns {number}
   */
  static round(value, decimals = 2) {
    if (typeof value !== 'number' || isNaN(value)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  /**
   * Tính GPA cho một tập hợp môn học (1 học kỳ hoặc toàn khóa)
   *
   * @param {Array<CourseCalcInput>} courses
   * @param {Object} [options]
   * @param {boolean} [options.filterExcluded=true]
   * @returns {GPACalculationResult}
   */
  static calculateGPA(courses, options = {}) {
    if (!Array.isArray(courses) || courses.length === 0) {
      return {
        gpa10: null,
        gpa4: null,
        gpa10Raw: null,
        gpa4Raw: null,
        totalCredits: 0,
        gradedCredits: 0,
        earnedCredits: 0,
        failedCredits: 0,
        classification4: 'Chưa xếp loại',
        classification10: 'Chưa xếp loại',
      };
    }

    let sumWeighted10 = 0;
    let sumWeighted4 = 0;
    let gradedCredits = 0;
    let totalCredits = 0;
    let earnedCredits = 0;
    let failedCredits = 0;

    for (const c of courses) {
      // Nếu môn bị người dùng bỏ chọn trong simulation
      if (c.included === false) continue;

      const credits = (typeof c.credits === 'number' && !isNaN(c.credits) && c.credits > 0) ? c.credits : 0;
      totalCredits += credits;

      // Môn loại trừ khỏi GPA nếu tín chỉ = 0 hoặc có cờ isExcludedFromGpa
      const isExcluded = Boolean(c.isExcludedFromGpa) || (credits === 0);

      const s10 = (typeof c.score10Raw === 'number' && !isNaN(c.score10Raw))
        ? c.score10Raw
        : ((typeof c.score10 === 'number' && !isNaN(c.score10)) ? c.score10 : null);
      let s4 = (typeof c.score4Raw === 'number' && !isNaN(c.score4Raw))
        ? c.score4Raw
        : ((typeof c.score4 === 'number' && !isNaN(c.score4)) ? c.score4 : null);

      if (s4 === null && s10 !== null) {
        const conv = GradingRuleEngine.convertScore10(s10);
        if (conv) s4 = conv.gradePoint;
      }

      const isPassed = typeof c.passed === 'boolean'
        ? c.passed
        : (s10 !== null ? s10 >= 4.0 : false);

      if (s10 !== null) {
        if (isPassed) {
          earnedCredits += credits;
        } else {
          failedCredits += credits;
        }

        // Chỉ cộng vào trọng số GPA nếu môn không bị loại trừ và credits > 0
        if (!isExcluded && credits > 0) {
          sumWeighted10 += s10 * credits;
          if (s4 !== null) {
            sumWeighted4 += s4 * credits;
          }
          gradedCredits += credits;
        }
      }
    }

    // RAW FLOAT: Giữ nguyên full precision cho các phép tính tiếp theo
    const gpa10Raw = gradedCredits > 0 ? (sumWeighted10 / gradedCredits) : null;
    const gpa4Raw = gradedCredits > 0 ? (sumWeighted4 / gradedCredits) : null;

    // DISPLAY VALUES: Làm tròn 2 chữ số thập phân cho UI
    const gpa10 = gpa10Raw !== null ? this.round(gpa10Raw, 2) : null;
    const gpa4 = gpa4Raw !== null ? this.round(gpa4Raw, 2) : null;

    return {
      gpa10,
      gpa4,
      gpa10Raw,
      gpa4Raw,
      sumWeighted10,
      sumWeighted4,
      totalCredits,
      gradedCredits,
      earnedCredits,
      failedCredits,
      classification4: GradingRuleEngine.getClassification4(gpa4Raw !== null ? gpa4Raw : gpa4),
      classification10: GradingRuleEngine.getClassification10(gpa10Raw !== null ? gpa10Raw : gpa10),
    };
  }

  /**
   * Tính GPA tích lũy toàn khóa, xử lý các môn học lại / cải thiện.
   *
   * @param {Array<CourseCalcInput>} allCourses - Danh sách toàn bộ môn từ tất cả các kỳ
   * @param {Object} [options]
   * @param {'highest'|'latest'|'all'} [options.retakePolicy='all']
   * @returns {GPACalculationResult}
   */
  static calculateCumulativeGPA(allCourses, options = {}) {
    const policy = options.retakePolicy || 'all';

    if (policy === 'all') {
      return this.calculateGPA(allCourses, options);
    }

    // Nhóm theo mã môn học phần
    const grouped = new Map();
    for (const c of allCourses) {
      if (c.included === false) continue;
      const key = c.courseClassCode || c.courseName || c.id;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(c);
    }

    const effectiveCourses = [];
    for (const [_, attempts] of grouped.entries()) {
      if (attempts.length === 1) {
        effectiveCourses.push(attempts[0]);
        continue;
      }

      if (policy === 'highest') {
        let best = attempts[0];
        for (let i = 1; i < attempts.length; i++) {
          const curr = attempts[i];
          const currScore = (typeof curr.score10 === 'number') ? curr.score10 : -1;
          const bestScore = (typeof best.score10 === 'number') ? best.score10 : -1;
          if (currScore > bestScore) {
            best = curr;
          }
        }
        effectiveCourses.push(best);
      } else if (policy === 'latest') {
        effectiveCourses.push(attempts[attempts.length - 1]);
      }
    }

    return this.calculateGPA(effectiveCourses, options);
  }

  /**
   * Tính lại điểm tổng kết từ các đầu điểm thành phần
   *
   * @param {Object} params
   * @param {number|null} params.midterm - Điểm chuyên cần / giữa kỳ
   * @param {Array<number>} params.regular - Điểm thường xuyên / hệ số 1
   * @param {Array<number>} params.practice - Điểm thực hành
   * @param {number|null} params.finalExam - Điểm thi kết thúc học phần
   * @param {Object} [weights] - Tỷ lệ trọng số (mặc định: quá trình 50%, thi 50%)
   * @returns {{ total10: number|null, processScore: number|null, provenance: string }}
   */
  static recalculateFromComponents(params, weights = { process: 0.5, finalExam: 0.5 }) {
    const { midterm, regular = [], practice = [], finalExam } = params;

    const validRegular = regular.filter(v => typeof v === 'number' && !isNaN(v));
    const validPractice = practice.filter(v => typeof v === 'number' && !isNaN(v));

    let processScore = null;
    if (typeof midterm === 'number') {
      let regAvg = validRegular.length > 0
        ? validRegular.reduce((a, b) => a + b, 0) / validRegular.length
        : midterm;
      processScore = this.round((midterm + regAvg) / 2, 2);
    }

    let total10 = null;
    if (processScore !== null && typeof finalExam === 'number') {
      total10 = this.round(
        processScore * weights.process + finalExam * weights.finalExam,
        1
      );
    }

    return {
      total10,
      processScore,
      provenance: 'component-recalculated'
    };
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GPAEngine };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.GPAEngine = GPAEngine;
    global._IUHGPAEngine = { GPAEngine };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
