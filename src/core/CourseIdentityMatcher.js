(function (global) {
  'use strict';

  const MATCH_STATUS = {
    EXACT: 'EXACT',
    DERIVED_CODE: 'DERIVED_CODE',
    CODE_AND_NAME: 'CODE_AND_NAME',
    AMBIGUOUS: 'AMBIGUOUS',
    UNMATCHED: 'UNMATCHED',
  };

  const MATCH_PROVENANCE = {
    EXACT_CODE: 'MATCH_EXACT_CODE',
    CLASS_TO_COURSE_PREFIX: 'MATCH_CLASS_TO_COURSE_PREFIX',
    CODE_PREFIX_AND_NAME_CONFIRM: 'MATCH_CODE_PREFIX_AND_NAME_CONFIRM',
    AMBIGUOUS_REJECTED: 'MATCH_AMBIGUOUS_REJECTED',
    NONE: 'MATCH_NONE',
  };

  /**
   * Chuẩn hóa chuỗi tên môn học tiếng Việt để đối chiếu an toàn
   * - Giữ nguyên dấu tiếng Việt chuẩn Unicode NFC
   * - Chuyển chữ thường, xóa khoảng trắng thừa
   * - Loại bỏ ghi chú trong ngoặc đơn nếu có (vd: "Toán giải tích A (Gia)")
   * @param {string} str
   * @returns {string}
   */
  function normalizeCourseName(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .normalize('NFC')
      .replace(/\s*\([^)]*\)\s*$/g, '') // Bỏ ngoặc đơn ở cuối nếu là ghi chú
      .replace(/[*+]/g, '')             // Bỏ dấu sao hoặc cộng
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  /**
   * Chuẩn hóa mã học phần
   * @param {string} code
   * @returns {string}
   */
  function normalizeCode(code) {
    if (!code || typeof code !== 'string') return '';
    return code.trim().replace(/\s+/g, '');
  }

  class CourseIdentityMatcher {
    /**
     * Đối chiếu 1 môn học từ Bảng điểm với Danh sách môn học trong Chương trình khung
     *
     * Thứ tự ưu tiên:
     * LEVEL 1: Exact normalized course code
     * LEVEL 2: Validated class-code -> course-code transformation (prefix + verified suffix + name confirmation)
     * LEVEL 3: Unique prefix candidate + strong name confirmation
     * LEVEL 4: Ambiguous detection (nhiều ứng viên thỏa mãn) -> REJECT
     * LEVEL 5: Unmatched
     *
     * @param {Object} gradeCourse - Môn học từ IUHPageAdapter { id, courseClassCode, courseName, credits }
     * @param {Array<Object>} ctkCourses - Danh sách môn từ IUHCurriculumAdapter
     * @returns {Object} MatchResult
     */
    static matchCourse(gradeCourse, ctkCourses) {
      if (!gradeCourse || !Array.isArray(ctkCourses) || ctkCourses.length === 0) {
        return {
          status: MATCH_STATUS.UNMATCHED,
          gradeCourseId: gradeCourse ? gradeCourse.id : null,
          gradeCourseCode: gradeCourse ? gradeCourse.courseClassCode : '',
          curriculumCourseCode: null,
          curriculumCourse: null,
          provenance: MATCH_PROVENANCE.NONE,
        };
      }

      const gClassCode = normalizeCode(gradeCourse.courseClassCode);
      const gNameNorm = normalizeCourseName(gradeCourse.courseName);
      const gradeCourseId = gradeCourse.id || null;

      // LEVEL 1: Khớp chính xác hoàn toàn mã học phần (Exact Code)
      const exactMatches = ctkCourses.filter(c => normalizeCode(c.code) === gClassCode);
      if (exactMatches.length === 1) {
        return {
          status: MATCH_STATUS.EXACT,
          gradeCourseId,
          gradeCourseCode: gClassCode,
          curriculumCourseCode: exactMatches[0].code,
          curriculumCourse: exactMatches[0],
          provenance: MATCH_PROVENANCE.EXACT_CODE,
        };
      } else if (exactMatches.length > 1) {
        return {
          status: MATCH_STATUS.AMBIGUOUS,
          gradeCourseId,
          gradeCourseCode: gClassCode,
          curriculumCourseCode: null,
          curriculumCourse: null,
          candidateCount: exactMatches.length,
          provenance: MATCH_PROVENANCE.AMBIGUOUS_REJECTED,
        };
      }

      // LEVEL 2 & LEVEL 3: Đối chiếu Mã lớp học phần (Class Code) với Mã học phần (Course Code)
      // Tại IUH: Mã lớp = Mã học phần (10 số) + Mã lớp/phân ban (2-4 số)
      const prefixCandidates = [];

      for (const ctk of ctkCourses) {
        const cCode = normalizeCode(ctk.code);
        if (!cCode || cCode.length < 6) continue;

        if (gClassCode.startsWith(cCode)) {
          const suffix = gClassCode.slice(cCode.length);
          // Suffix phải là số thứ tự lớp (từ 1 đến 4 chữ số, vd: "01", "02", "111")
          if (/^\d{1,4}$/.test(suffix)) {
            prefixCandidates.push(ctk);
          }
        }
      }

      if (prefixCandidates.length === 1) {
        const candidate = prefixCandidates[0];
        const ctkNameNorm = normalizeCourseName(candidate.name);

        // Kiểm tra xác nhận bằng tên môn học (Name Confirmation)
        const isNameConfirmed = gNameNorm && ctkNameNorm && (gNameNorm === ctkNameNorm || gNameNorm.includes(ctkNameNorm) || ctkNameNorm.includes(gNameNorm));

        if (isNameConfirmed) {
          return {
            status: MATCH_STATUS.DERIVED_CODE,
            gradeCourseId,
            gradeCourseCode: gClassCode,
            curriculumCourseCode: candidate.code,
            curriculumCourse: candidate,
            provenance: MATCH_PROVENANCE.CLASS_TO_COURSE_PREFIX,
          };
        } else {
          // Tiền tố khớp nhưng tên môn hoàn toàn không khớp -> Kiểm tra an toàn
          // Không tự ý match nếu tên môn hoàn toàn khác nhau để tránh gán nhầm
          return {
            status: MATCH_STATUS.CODE_AND_NAME,
            gradeCourseId,
            gradeCourseCode: gClassCode,
            curriculumCourseCode: candidate.code,
            curriculumCourse: candidate,
            provenance: MATCH_PROVENANCE.CODE_PREFIX_AND_NAME_CONFIRM,
            nameMismatchWarning: true,
          };
        }
      } else if (prefixCandidates.length > 1) {
        // Nhiều candidate tiền tố -> Thử phân giải bằng Tên môn chuẩn xác
        const nameConfirmedCandidates = prefixCandidates.filter(c => {
          const ctkName = normalizeCourseName(c.name);
          return gNameNorm === ctkName;
        });

        if (nameConfirmedCandidates.length === 1) {
          return {
            status: MATCH_STATUS.DERIVED_CODE,
            gradeCourseId,
            gradeCourseCode: gClassCode,
            curriculumCourseCode: nameConfirmedCandidates[0].code,
            curriculumCourse: nameConfirmedCandidates[0],
            provenance: MATCH_PROVENANCE.CODE_PREFIX_AND_NAME_CONFIRM,
          };
        }

        // Vẫn còn đa nghĩa -> REJECT (Fail-safe, không đoán mò)
        return {
          status: MATCH_STATUS.AMBIGUOUS,
          gradeCourseId,
          gradeCourseCode: gClassCode,
          curriculumCourseCode: null,
          curriculumCourse: null,
          candidateCount: prefixCandidates.length,
          provenance: MATCH_PROVENANCE.AMBIGUOUS_REJECTED,
        };
      }

      // LEVEL 4: Thử tìm theo tên môn duy nhất (chỉ làm fallback nếu mã không khớp tiền tố)
      if (gNameNorm.length >= 4) {
        const nameCandidates = ctkCourses.filter(c => {
          const ctkName = normalizeCourseName(c.name);
          return ctkName === gNameNorm;
        });

        if (nameCandidates.length === 1) {
          return {
            status: MATCH_STATUS.CODE_AND_NAME,
            gradeCourseId,
            gradeCourseCode: gClassCode,
            curriculumCourseCode: nameCandidates[0].code,
            curriculumCourse: nameCandidates[0],
            provenance: MATCH_PROVENANCE.CODE_PREFIX_AND_NAME_CONFIRM,
          };
        } else if (nameCandidates.length > 1) {
          return {
            status: MATCH_STATUS.AMBIGUOUS,
            gradeCourseId,
            gradeCourseCode: gClassCode,
            curriculumCourseCode: null,
            curriculumCourse: null,
            candidateCount: nameCandidates.length,
            provenance: MATCH_PROVENANCE.AMBIGUOUS_REJECTED,
          };
        }
      }

      // LEVEL 5: Hoàn toàn không khớp
      return {
        status: MATCH_STATUS.UNMATCHED,
        gradeCourseId,
        gradeCourseCode: gClassCode,
        curriculumCourseCode: null,
        curriculumCourse: null,
        provenance: MATCH_PROVENANCE.NONE,
      };
    }

    /**
     * Đối chiếu hàng loạt danh sách môn học từ Bảng điểm với Chương trình khung
     * @param {Array<Object>} gradeCourses
     * @param {Array<Object>} ctkCourses
     * @returns {{ matches: Map<string, Object>, summary: { total: number, exact: number, derived: number, codeAndName: number, ambiguous: number, unmatched: number } }}
     */
    static matchAll(gradeCourses, ctkCourses) {
      const matches = new Map();
      const summary = {
        total: 0,
        exact: 0,
        derived: 0,
        codeAndName: 0,
        ambiguous: 0,
        unmatched: 0,
      };

      if (!Array.isArray(gradeCourses)) {
        return { matches, summary };
      }

      gradeCourses.forEach(gc => {
        summary.total++;
        const res = this.matchCourse(gc, ctkCourses);
        matches.set(gc.id || gc.courseClassCode, res);

        if (res.status === MATCH_STATUS.EXACT) summary.exact++;
        else if (res.status === MATCH_STATUS.DERIVED_CODE) summary.derived++;
        else if (res.status === MATCH_STATUS.CODE_AND_NAME) summary.codeAndName++;
        else if (res.status === MATCH_STATUS.AMBIGUOUS) summary.ambiguous++;
        else summary.unmatched++;
      });

      return {
        matches,
        results: Array.from(matches.values()),
        summary,
        totalGradeCourses: summary.total,
        matchedExact: summary.exact,
        matchedDerived: summary.derived,
        matchedCodeAndName: summary.codeAndName,
        ambiguous: summary.ambiguous,
        unmatched: summary.unmatched,
      };
    }
  }

  CourseIdentityMatcher.MATCH_STATUS = MATCH_STATUS;
  CourseIdentityMatcher.MATCH_PROVENANCE = MATCH_PROVENANCE;
  CourseIdentityMatcher.normalizeCourseName = normalizeCourseName;
  CourseIdentityMatcher.normalizeCode = normalizeCode;

  const api = {
    CourseIdentityMatcher,
    MATCH_STATUS,
    MATCH_PROVENANCE,
    normalizeCourseName,
    normalizeCode,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.CourseIdentityMatcher = CourseIdentityMatcher;
    global._IUHCourseIdentityMatcher = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
