(function (global) {
  'use strict';

  const GAP_TYPES = {
    UNMATCHED_GRADE_COURSE: 'UNMATCHED_GRADE_COURSE',
    UNMATCHED_PASSED_CTK: 'UNMATCHED_PASSED_CTK',
    DUPLICATE_COURSE_MAPPING: 'DUPLICATE_COURSE_MAPPING',
    CREDITS_MISMATCH: 'CREDITS_MISMATCH',
    UNKNOWN_COURSE_TYPE: 'UNKNOWN_COURSE_TYPE',
    UNKNOWN_GPA_ELIGIBILITY: 'UNKNOWN_GPA_ELIGIBILITY'
  };

  const GAP_MESSAGES = {
    [GAP_TYPES.UNMATCHED_GRADE_COURSE]: 'Học phần trên bảng điểm chưa khớp với Chương trình khung',
    [GAP_TYPES.UNMATCHED_PASSED_CTK]: 'Học phần ghi nhận đạt trên CTK nhưng chưa đối chiếu được trên bảng điểm',
    [GAP_TYPES.DUPLICATE_COURSE_MAPPING]: 'Trùng lặp đối chiếu nhiều học phần với cùng một mã CTK',
    [GAP_TYPES.CREDITS_MISMATCH]: 'Số tín chỉ trên bảng điểm khác với Chương trình khung',
    [GAP_TYPES.UNKNOWN_COURSE_TYPE]: 'Chưa xác định loại môn (Lý thuyết / Thực hành / Kết hợp)',
    [GAP_TYPES.UNKNOWN_GPA_ELIGIBILITY]: 'Chưa xác định điều kiện tính điểm TBTL'
  };

  function normalizeCode(code) {
    if (!code || typeof code !== 'string') return '';
    return code.trim().replace(/\s+/g, '');
  }

  class CurriculumGapEngine {
    /**
     * Phát hiện các bất nhất dữ liệu giữa Bảng điểm và Chương trình khung
     * TUYỆT ĐỐI KHÔNG TỰ ĐỘNG SỬA DỮ LIỆU.
     *
     * @param {Object} options
     * @param {Object} options.curriculumModel - Dữ liệu CTK từ IUHCurriculumAdapter
     * @param {Array<Object>} options.gradeSemestersOrCourses - Dữ liệu bảng điểm
     * @param {Array<Object>} [options.matchResults] - Kết quả đối chiếu từ CourseIdentityMatcher nếu có
     * @returns {Object} GapDetectionResult
     */
    static detectGaps({ curriculumModel, gradeSemestersOrCourses, matchResults = null }) {
      if (!curriculumModel || !Array.isArray(curriculumModel.courses)) {
        return {
          hasGaps: false,
          gapCount: 0,
          gaps: [],
          summaryText: 'Chưa có dữ liệu Chương trình khung để đối chiếu'
        };
      }

      // Trích xuất mảng môn học phẳng từ bảng điểm
      const flatGradeCourses = [];
      if (Array.isArray(gradeSemestersOrCourses)) {
        gradeSemestersOrCourses.forEach(item => {
          if (item && Array.isArray(item.courses)) {
            flatGradeCourses.push(...item.courses);
          } else if (item) {
            flatGradeCourses.push(item);
          }
        });
      }

      const gaps = [];

      // 1. Tạo Map môn CTK
      const ctkMap = new Map();
      curriculumModel.courses.forEach(c => {
        const cCode = normalizeCode(c.code);
        if (cCode) ctkMap.set(cCode, c);
      });

      // 2. Kiểm tra từng môn trên Bảng điểm
      const mappedCtkUsage = new Map(); // ctkCode -> Array<gradeCourse>

      flatGradeCourses.forEach(gc => {
        const gName = gc.courseName || '';
        const gCode = gc.courseClassCode || gc.courseCode || '';
        const normCode = normalizeCode(gCode);
        const code10 = normCode.length >= 10 ? normCode.slice(0, 10) : normCode;

        // Tìm môn CTK khớp
        let matchedCtk = gc.curriculumCourse || ctkMap.get(normCode) || ctkMap.get(code10) || null;

        if (!matchedCtk && matchResults && Array.isArray(matchResults)) {
          const m = matchResults.find(r => r.gradeCourseId === gc.id || r.gradeCourseCode === normCode);
          if (m && m.curriculumCourse) {
            matchedCtk = m.curriculumCourse;
          }
        }

        if (!matchedCtk) {
          // UNMATCHED_GRADE_COURSE
          gaps.push({
            type: GAP_TYPES.UNMATCHED_GRADE_COURSE,
            courseName: gName,
            courseCode: gCode,
            message: GAP_MESSAGES[GAP_TYPES.UNMATCHED_GRADE_COURSE],
            details: `Học phần "${gName}" (${gCode}) chưa tìm thấy trong CTK`,
            severity: 'INFO'
          });
        } else {
          const matchedCode = normalizeCode(matchedCtk.code);
          if (!mappedCtkUsage.has(matchedCode)) {
            mappedCtkUsage.set(matchedCode, []);
          }
          mappedCtkUsage.get(matchedCode).push(gc);

          // CREDITS_MISMATCH
          const gradeCr = gc.credits?.status === 'ok' ? gc.credits.value : (typeof gc.credits === 'number' ? gc.credits : null);
          const ctkCr = matchedCtk.credits;
          if (typeof gradeCr === 'number' && typeof ctkCr === 'number' && gradeCr !== ctkCr) {
            gaps.push({
              type: GAP_TYPES.CREDITS_MISMATCH,
              courseName: gName,
              courseCode: gCode,
              message: GAP_MESSAGES[GAP_TYPES.CREDITS_MISMATCH],
              details: `Bảng điểm ghi ${gradeCr} TC nhưng CTK ghi ${ctkCr} TC`,
              severity: 'WARNING'
            });
          }

          // UNKNOWN_COURSE_TYPE
          const inferredType = matchedCtk.inferredCourseType || gc.courseType || 'UNKNOWN';
          if (inferredType === 'UNKNOWN') {
            gaps.push({
              type: GAP_TYPES.UNKNOWN_COURSE_TYPE,
              courseName: gName,
              courseCode: gCode,
              message: GAP_MESSAGES[GAP_TYPES.UNKNOWN_COURSE_TYPE],
              details: `Chưa suy luận được loại môn học cho "${gName}"`,
              severity: 'INFO'
            });
          }
        }
      });

      // 3. DUPLICATE_COURSE_MAPPING
      mappedCtkUsage.forEach((courses, ctkCode) => {
        if (courses.length > 1) {
          // Nhiều môn điểm cùng khớp vào 1 mã CTK (có thể học lại hoặc môn trùng)
          gaps.push({
            type: GAP_TYPES.DUPLICATE_COURSE_MAPPING,
            courseName: courses.map(c => c.courseName).join(', '),
            courseCode: ctkCode,
            message: GAP_MESSAGES[GAP_TYPES.DUPLICATE_COURSE_MAPPING],
            details: `Có ${courses.length} học phần trên bảng điểm cùng khớp mã CTK ${ctkCode}`,
            severity: 'INFO'
          });
        }
      });

      // 4. UNMATCHED_PASSED_CTK
      // CTK ghi nhận PASS nhưng trên bảng điểm không tìm thấy
      curriculumModel.courses.forEach(c => {
        if (c.passState === 'PASS') {
          const cCode = normalizeCode(c.code);
          const usage = mappedCtkUsage.get(cCode);
          if (!usage || usage.length === 0) {
            gaps.push({
              type: GAP_TYPES.UNMATCHED_PASSED_CTK,
              courseName: c.name,
              courseCode: c.code,
              message: GAP_MESSAGES[GAP_TYPES.UNMATCHED_PASSED_CTK],
              details: `CTK đánh dấu "Đạt" môn "${c.name}" nhưng bảng điểm không có dữ liệu khớp`,
              severity: 'INFO'
            });
          }
        }
      });

      const hasGaps = gaps.length > 0;
      const gapCount = gaps.length;
      const summaryText = hasGaps
        ? `${gapCount} học phần cần kiểm tra đối chiếu dữ liệu`
        : 'Toàn bộ dữ liệu đã được đối chiếu thành công';

      return {
        hasGaps,
        gapCount,
        gaps,
        summaryText
      };
    }
  }

  CurriculumGapEngine.GAP_TYPES = GAP_TYPES;
  CurriculumGapEngine.GAP_MESSAGES = GAP_MESSAGES;
  CurriculumGapEngine.detectGaps = CurriculumGapEngine.detectGaps;
  CurriculumGapEngine.CurriculumGapEngine = CurriculumGapEngine;

  const api = {
    CurriculumGapEngine,
    GAP_TYPES,
    GAP_MESSAGES,
    detectGaps: CurriculumGapEngine.detectGaps
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
    t.IUHGPA.core.CurriculumGapEngine = CurriculumGapEngine;
    t.IUHGPA.core.GAP_TYPES = GAP_TYPES;
    t.IUHGPA.core.GAP_MESSAGES = GAP_MESSAGES;
    t._IUHCurriculumGapEngine = api;
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
