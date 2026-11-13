(function (global) {
  'use strict';

/**
 * Bảng quy đổi chuẩn theo Thông tư / Quy chế đào tạo đại học (IUH Standard)
 * Điểm 10 -> Điểm Chữ -> Điểm 4
 */
const DEFAULT_GRADE_BANDS = [
  { min10: 9.0, max10: 10.0, letter: 'A+', gradePoint: 4.0, classification: 'Xuất sắc', passed: true },
  { min10: 8.5, max10: 8.99, letter: 'A',  gradePoint: 3.8, classification: 'Giỏi',     passed: true },
  { min10: 8.0, max10: 8.49, letter: 'B+', gradePoint: 3.5, classification: 'Khá',      passed: true },
  { min10: 7.0, max10: 7.99, letter: 'B',  gradePoint: 3.0, classification: 'Khá',      passed: true },
  { min10: 6.0, max10: 6.99, letter: 'C+', gradePoint: 2.5, classification: 'Trung bình', passed: true },
  { min10: 5.5, max10: 5.99, letter: 'C',  gradePoint: 2.0, classification: 'Trung bình', passed: true },
  { min10: 5.0, max10: 5.49, letter: 'D+', gradePoint: 1.5, classification: 'Trung bình yếu', passed: true },
  { min10: 4.0, max10: 4.99, letter: 'D',  gradePoint: 1.0, classification: 'Trung bình yếu', passed: true },
  { min10: 0.0, max10: 3.99, letter: 'F',  gradePoint: 0.0, classification: 'Kém',     passed: false },
];

/**
   * Tính toán điểm tổng kết, thang 4, điểm chữ và xếp loại cho một môn học
 */
const CLASSIFICATION_BANDS_4 = [
  { min: 3.60, max: 4.00, label: 'Xuất sắc' },
  { min: 3.20, max: 3.59, label: 'Giỏi' },
  { min: 2.50, max: 3.19, label: 'Khá' },
  { min: 2.00, max: 2.49, label: 'Trung bình' },
  { min: 1.00, max: 1.99, label: 'Yếu' },
  { min: 0.00, max: 0.99, label: 'Kém' },
];

/**
 * Phân loại học lực theo GPA tích lũy thang 10
 */
const CLASSIFICATION_BANDS_10 = [
  { min: 9.00, max: 10.00, label: 'Xuất sắc' },
  { min: 8.00, max: 8.99, label: 'Giỏi' },
  { min: 7.00, max: 7.99, label: 'Khá' },
  { min: 5.00, max: 6.99, label: 'Trung bình' },
  { min: 4.00, max: 4.99, label: 'Yếu' },
  { min: 0.00, max: 3.99, label: 'Kém' },
];

/**
 * Định nghĩa cấu trúc tính điểm thành phần
 * Nguồn: inferred-from-legacy-implementation (được cô lập tại đây thay vì hardcode rải rác)
 */
const COMPONENT_RULES = {
  THEORY: {
    ruleId: 'THEORY_30_20_50',
    name: 'Lý thuyết',
    provenance: 'inferred-from-legacy-implementation',
    hasFinalExam: true,
    finalExamWeight: 0.5,
    minFinalExam: 3.0,
    weights: {
      midterm: 0.3,
      regularAvg: 0.2,
      finalExam: 0.5,
    },
    blockingConditions: [
      {
        id: 'MIDTERM_ZERO',
        description: 'Điểm giữa kỳ bằng 0 (theo quy định điểm liệt quá trình)',
        check: (scores) => scores.midterm === 0,
      }
    ],
    calculateTotal(scores) {
      const { midterm, regularAvg, finalExam } = scores;
      if (typeof midterm !== 'number' || typeof regularAvg !== 'number' || typeof finalExam !== 'number') {
        return null;
      }
      return midterm * 0.3 + regularAvg * 0.2 + finalExam * 0.5;
    },
  },
  COMBINED: {
    ruleId: 'COMBINED_THEORY_PRACTICE',
    name: 'Kết hợp (Lý thuyết + Thực hành)',
    provenance: 'inferred-from-legacy-implementation',
    hasFinalExam: true,
    finalExamWeight: 1 / 3,
    minFinalExam: 3.0,
    weights: {
      theoryRatio: 2 / 3,
      practiceRatio: 1 / 3,
      theoryWeights: {
        midterm: 0.3,
        regularAvg: 0.2,
        finalExam: 0.5,
      }
    },
    blockingConditions: [],
    calculateTotal(scores) {
      const { midterm, regularAvg, practiceAvg, finalExam } = scores;
      if (typeof midterm !== 'number' || typeof regularAvg !== 'number' || typeof practiceAvg !== 'number' || typeof finalExam !== 'number') {
        return null;
      }
      const lt = midterm * 0.3 + regularAvg * 0.2 + finalExam * 0.5;
      return (lt * 2 + practiceAvg) / 3;
    },
  },
  PRACTICE: {
    ruleId: 'PRACTICE_ONLY',
    name: 'Thực hành',
    provenance: 'inferred-from-legacy-implementation',
    hasFinalExam: false,
    finalExamWeight: 0,
    minFinalExam: null,
    blockingConditions: [],
    calculateTotal(scores) {
      return typeof scores.practiceAvg === 'number' ? scores.practiceAvg : null;
    }
  },
  SPECIAL: {
    ruleId: 'SPECIAL_FINAL_ONLY',
    name: 'Đặc biệt (Khóa luận / Đồ án / Thực tập)',
    provenance: 'inferred-from-legacy-implementation',
    hasFinalExam: true,
    finalExamWeight: 1.0,
    minFinalExam: 4.0,
    blockingConditions: [],
    calculateTotal(scores) {
      return typeof scores.finalExam === 'number' ? scores.finalExam : null;
    }
  }
};

class GradingRuleEngine {
  /**
   * Tính toán điểm tổng kết, thang 4, điểm chữ và xếp loại cho một môn học
   * @param {number|null} score10
   * @param {Array<Object>} [bands=DEFAULT_GRADE_BANDS]
   * @returns {{ letter: string, gradePoint: number, classification: string, passed: boolean } | null}
   */
  static convertScore10(score10, bands = DEFAULT_GRADE_BANDS) {
    if (typeof score10 !== 'number' || isNaN(score10)) return null;

    const clamped = Math.min(10.0, Math.max(0.0, score10));
    const EPS = 1e-9;

    for (const band of bands) {
      if (clamped >= band.min10 - EPS && clamped <= band.max10 + EPS) {
        return {
          letter: band.letter,
          gradePoint: band.gradePoint,
          classification: band.classification,
          passed: band.passed,
        };
      }
    }

    return {
      letter: 'F',
      gradePoint: 0.0,
      classification: 'Kém',
      passed: false,
    };
  }

  /**
   * Tính toán điểm tổng kết, thang 4, điểm chữ và xếp loại cho một môn học
   * @param {number|null} gpa4
   * @returns {string}
   */
  static getClassification4(gpa4) {
    if (typeof gpa4 !== 'number' || isNaN(gpa4)) return 'Chưa xếp loại';
    const rounded = Math.round(gpa4 * 100) / 100;
    for (const b of CLASSIFICATION_BANDS_4) {
      if (rounded >= b.min && rounded <= b.max) {
        return b.label;
      }
    }
    return 'Chưa xếp loại';
  }

  /**
   * Xếp loại dựa trên GPA thang 10
   * @param {number|null} gpa10
   * @returns {string}
   */
  static getClassification10(gpa10) {
    if (typeof gpa10 !== 'number' || isNaN(gpa10)) return 'Chưa xếp loại';
    const rounded = Math.round(gpa10 * 100) / 100;
    for (const b of CLASSIFICATION_BANDS_10) {
      if (rounded >= b.min && rounded <= b.max) {
        return b.label;
      }
    }
    return 'Chưa xếp loại';
  }

  /**
   * Kiểm tra xem môn học có bị tính là Rớt (F) do điểm liệt cuối kỳ không
   * @param {number|null} finalExamScore
   * @param {number} [cutoff=3.0]
   * @returns {boolean} true nếu bị liệt
   */
  static isFinalExamFailed(finalExamScore, cutoff = 3.0) {
    if (typeof finalExamScore !== 'number' || isNaN(finalExamScore)) return false;
    return finalExamScore < cutoff;
  }

  /**
   * Lấy cấu trúc quy tắc tính điểm theo mã quy tắc
   * @param {string} ruleKey
   * @returns {Object|null}
   */
  /**
   * Tính toán điểm tổng kết, thang 4, điểm chữ và xếp loại cho một môn học
   * @param {Object} input - Chứa scores, credits, courseTypeOverride
   * @param {string} [ruleType='THEORY']
   * @returns {Object}
   */
  static calculateCourse(input, ruleType = 'THEORY') {
    const scores = input.scores || {};
    const effectiveType = input.courseTypeOverride || ruleType || 'THEORY';
    const rule = this.getRule(effectiveType) || COMPONENT_RULES.THEORY;
    if (!rule) return null;

    const regularList = Array.isArray(scores.regular) ? scores.regular : [];
    const practiceList = Array.isArray(scores.practice) ? scores.practice : [];

    const regAvg = this.calculateAverage(regularList);
    const pracAvg = this.calculateAverage(practiceList);

    const total = rule.calculateTotal({
      midterm: scores.midterm,
      regularAvg: regAvg,
      practiceAvg: pracAvg,
      finalExam: scores.final,
    });

    if (typeof total !== 'number' || isNaN(total)) {
      return {
        score10Raw: null,
        score10: null,
        score4Raw: null,
        score4: null,
        letter: null,
        classification: null,
        isPassed: null,
      };
    }

    const conv = this.convertScore10(total);
    return {
      score10Raw: total,
      score10: Math.round(total * 100) / 100,
      score4Raw: conv ? conv.gradePoint : null,
      score4: conv ? conv.gradePoint : null,
      letter: conv ? conv.letter : null,
      classification: conv ? conv.classification : null,
      isPassed: conv ? conv.passed : null,
    };
  }

  static getRule(ruleKey) {
    if (!ruleKey) return null;
    const upper = String(ruleKey).toUpperCase();
    if (COMPONENT_RULES[upper]) return COMPONENT_RULES[upper];
    for (const r of Object.values(COMPONENT_RULES)) {
      if (r.ruleId === ruleKey) return r;
    }
    return null;
  }

  /**
   * Suy luận loại môn và rule tương ứng theo quy tắc chuẩn
   * Hỗ trợ LT > 0 && TH == 0 -> THEORY, LT == 0 && TH > 0 -> PRACTICE, LT > 0 && TH > 0 -> COMBINED,
   * LT == 0 && TH == 0 -> UNKNOWN / SPECIAL_CANDIDATE (chỉ chọn SPECIAL khi có bằng chứng từ khóa rõ ràng).
   * @param {Object} course
   * @returns {{ type: 'THEORY'|'PRACTICE'|'COMBINED'|'SPECIAL'|'UNKNOWN', rule: Object, isCandidate?: boolean }}
   */
  static inferCourseType(course) {
    if (!course) return { type: 'THEORY', rule: COMPONENT_RULES.THEORY };

    const courseName = course.courseName || '';
    const kwSpecial = ['Khóa luận', 'Thực tập', 'Đồ án', 'Kiến tập'];
    const hasSpecialEvidence = kwSpecial.some(k => courseName.includes(k));

    // 1. Kiểm tra nếu có metadata CTK / curriculum (LT vs TH credits)
    const curriculum = course.curriculum || null;
    const ltCredits = curriculum ? (curriculum.lt ?? curriculum.ltCredits ?? curriculum.theoryCredits) : (course.ltCredits ?? course.theoryCredits ?? null);
    const thCredits = curriculum ? (curriculum.th ?? curriculum.thCredits ?? curriculum.practiceCredits) : (course.thCredits ?? course.practiceCredits ?? null);

    if (typeof ltCredits === 'number' && typeof thCredits === 'number') {
      if (ltCredits > 0 && thCredits === 0) {
        return { type: COURSE_TYPES.THEORY, rule: COMPONENT_RULES.THEORY };
      }
      if (ltCredits === 0 && thCredits > 0) {
        return { type: COURSE_TYPES.PRACTICE, rule: COMPONENT_RULES.PRACTICE };
      }
      if (ltCredits > 0 && thCredits > 0) {
        return { type: COURSE_TYPES.COMBINED, rule: COMPONENT_RULES.COMBINED };
      }
      if (ltCredits === 0 && thCredits === 0) {
        if (hasSpecialEvidence) {
          return { type: COURSE_TYPES.SPECIAL, rule: COMPONENT_RULES.SPECIAL, isCandidate: false };
        }
        return { type: 'UNKNOWN', rule: COMPONENT_RULES.THEORY, isCandidate: true, candidate: 'SPECIAL_CANDIDATE' };
      }
    }

    // 2. Dựa trên bằng chứng từ khóa đặc biệt rõ ràng
    if (hasSpecialEvidence) {
      return { type: 'SPECIAL', rule: COMPONENT_RULES.SPECIAL };
    }

    // 3. Phân tích thành phần đánh giá (assessments) thực tế
    const assessments = course.assessments || {};
    const hasPractice = Array.isArray(assessments.practice) &&
      assessments.practice.some(p => p.value && p.value.status === 'ok');

    const hasRegular = Array.isArray(assessments.regular) &&
      assessments.regular.some(r => r.value && r.value.status === 'ok');

    const hasMidterm = assessments.midterm && assessments.midterm.status === 'ok';
    const hasLT = hasRegular || hasMidterm;

    if (hasLT && !hasPractice) {
      return { type: 'THEORY', rule: COMPONENT_RULES.THEORY };
    }
    if (!hasLT && hasPractice) {
      return { type: 'PRACTICE', rule: COMPONENT_RULES.PRACTICE };
    }
    if (hasLT && hasPractice) {
      return { type: 'COMBINED', rule: COMPONENT_RULES.COMBINED };
    }

    // Không có bằng chứng LT lẫn TH (chỉ có thi hoặc chưa có điểm)
    return { type: 'UNKNOWN', rule: COMPONENT_RULES.THEORY, isCandidate: true };
  }

  /**
   * Tự động nhận diện cấu trúc tính điểm từ dữ liệu môn học
   * @param {Object} course - Course object từ IUHPageAdapter
   * @returns {Object} rule object
   */
  static detectRule(course) {
    const inferred = this.inferCourseType(course);
    return inferred.rule || COMPONENT_RULES.THEORY;
  }

  /**
   * Tính điểm trung bình của một danh sách điểm (loại bỏ missing/invalid)
   * @param {Array<{ value: import('../utils/result.js').ParsedNumber } | number>} items
   * @returns {number|null}
   */
  static calculateAverage(items) {
    if (!Array.isArray(items) || items.length === 0) return null;

    let sum = 0;
    let count = 0;

    for (const item of items) {
      let num = null;
      if (typeof item === 'number') {
        num = item;
      } else if (item && typeof item === 'object') {
        if (item.value && item.value.status === 'ok' && typeof item.value.value === 'number') {
          num = item.value.value;
        } else if (typeof item.value === 'number') {
          num = item.value;
        }
      }

      if (num !== null && !isNaN(num)) {
        sum += num;
        count++;
      }
    }

    return count > 0 ? (sum / count) : null;
  }

  /**
   * Trả về danh sách tất cả các ngưỡng Grade Target có thể đạt được
   * @returns {Array<{ id: string, label: string, min10: number, gradePoint: number, letter: string }>}
   */
  static getTargetThresholds() {
    return [
      { id: 'PASS', label: 'Qua môn (≥ 4.0)', min10: 4.0, gradePoint: 1.0, letter: 'D' },
      { id: 'D',    label: 'Điểm D (≥ 4.0)',  min10: 4.0, gradePoint: 1.0, letter: 'D' },
      { id: 'D_PLUS', label: 'Điểm D+ (≥ 5.0)', min10: 5.0, gradePoint: 1.5, letter: 'D+' },
      { id: 'C',    label: 'Điểm C (≥ 5.5)',  min10: 5.5, gradePoint: 2.0, letter: 'C' },
      { id: 'C_PLUS', label: 'Điểm C+ (≥ 6.0)', min10: 6.0, gradePoint: 2.5, letter: 'C+' },
      { id: 'B',    label: 'Điểm B (≥ 7.0)',  min10: 7.0, gradePoint: 3.0, letter: 'B' },
      { id: 'B_PLUS', label: 'Điểm B+ (≥ 8.0)', min10: 8.0, gradePoint: 3.5, letter: 'B+' },
      { id: 'A',    label: 'Điểm A (≥ 8.5)',  min10: 8.5, gradePoint: 3.8, letter: 'A' },
      { id: 'A_PLUS', label: 'Điểm A+ (≥ 9.0)', min10: 9.0, gradePoint: 4.0, letter: 'A+' },
    ];
  }

  /**
   * Kiểm tra xem tên môn học có thuộc diện tự động loại trừ khỏi GPA theo centralized fallback rule
   * Áp dụng khi chưa có hoặc không có metadata Chương trình khung (CTK)
   *
   * Quy tắc kiểm tra nghiêm ngặt (strict pattern, không match broad):
   * 1. Giáo dục thể chất / GDTC: ^giáo dục thể chất(?:\s+\d+)?$
   * 2. Giáo dục quốc phòng và an ninh / GDQP: ^giáo dục quốc phòng(?:\s+và\s+an\s+ninh)?(?:\s+\d+)?$
   * 3. Tiếng Anh theo số thứ tự đại cương: ^tiếng anh\s+\d+$ (KHÔNG loại trừ Tiếng Anh chuyên ngành)
   * 4. Chứng chỉ tiếng Anh: ^chứng chỉ tiếng anh$
   *
   * @param {string} courseName
   * @returns {{ isNonGpa: boolean, matchedRule?: string, provenance?: string }}
   */
  static isNonGpaCourseFallback(courseName) {
    if (!courseName || typeof courseName !== 'string') {
      return { isNonGpa: false };
    }

    const normalized = courseName
      .normalize('NFC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

    // 1. Giáo dục thể chất (ví dụ: "Giáo dục thể chất 1", "Giáo dục thể chất 2", "Giáo dục thể chất")
    if (/^giáo dục thể chất(?:\s+\d+)?$/i.test(normalized)) {
      return { isNonGpa: true, matchedRule: 'PHYSICAL_EDUCATION', provenance: 'FALLBACK_NON_GPA_PE' };
    }

    // 2. Giáo dục quốc phòng và an ninh (ví dụ: "Giáo dục Quốc phòng và An ninh 1", "Giáo dục Quốc phòng và An ninh 2")
    if (/^giáo dục quốc phòng(?:\s+và\s+an\s+ninh)?(?:\s+\d+)?$/i.test(normalized)) {
      return { isNonGpa: true, matchedRule: 'DEFENSE_EDUCATION', provenance: 'FALLBACK_NON_GPA_DEFENSE' };
    }

    // 3. Tiếng Anh theo số thứ tự (ví dụ: "Tiếng Anh 1", "Tiếng Anh 2")
    // KHÔNG match "Tiếng Anh chuyên ngành CNTT", "Tiếng Anh thương mại"
    if (/^tiếng anh\s+\d+$/i.test(normalized)) {
      return { isNonGpa: true, matchedRule: 'GENERAL_NUMBERED_ENGLISH', provenance: 'FALLBACK_NON_GPA_ENGLISH' };
    }

    // 4. Chứng chỉ Tiếng Anh
    if (/^chứng chỉ tiếng anh$/i.test(normalized)) {
      return { isNonGpa: true, matchedRule: 'ENGLISH_CERTIFICATE', provenance: 'FALLBACK_NON_GPA_ENGLISH_CERT' };
    }

    return { isNonGpa: false };
  }
}

const COURSE_TYPES = {
  THEORY: 'THEORY',
  PRACTICE: 'PRACTICE',
  COMBINED: 'COMBINED',
  SPECIAL: 'SPECIAL',
  NON_GPA: 'NON_GPA',
};

GradingRuleEngine.DEFAULT_GRADE_BANDS = DEFAULT_GRADE_BANDS;
GradingRuleEngine.CLASSIFICATION_BANDS_4 = CLASSIFICATION_BANDS_4;
GradingRuleEngine.CLASSIFICATION_BANDS_10 = CLASSIFICATION_BANDS_10;
GradingRuleEngine.COMPONENT_RULES = COMPONENT_RULES;
GradingRuleEngine.COURSE_TYPES = COURSE_TYPES;

  const api = {
    GradingRuleEngine,
    DEFAULT_GRADE_BANDS,
    CLASSIFICATION_BANDS_4,
    CLASSIFICATION_BANDS_10,
    COMPONENT_RULES,
    COURSE_TYPES,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.GradingRuleEngine = GradingRuleEngine;
    root.core.DEFAULT_GRADE_BANDS = DEFAULT_GRADE_BANDS;
    root.core.CLASSIFICATION_BANDS_4 = CLASSIFICATION_BANDS_4;
    root.core.CLASSIFICATION_BANDS_10 = CLASSIFICATION_BANDS_10;
    root.core.COMPONENT_RULES = COMPONENT_RULES;
    root.core.COURSE_TYPES = COURSE_TYPES;
    global._IUHGradingRuleEngine = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
