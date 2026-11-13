(function (global) {
  'use strict';

  /**
   * Central Data Provenance Enum
   */
  const PROVENANCE = {
    CURRICULUM_EXPLICIT: 'CURRICULUM_EXPLICIT',
    CURRICULUM_LT_TH: 'CURRICULUM_LT_TH',
    CURRICULUM_NON_GPA: 'CURRICULUM_NON_GPA',
    GRADE_PAGE: 'GRADE_PAGE',
    USER_OVERRIDE: 'USER_OVERRIDE',
    LEGACY_FALLBACK: 'LEGACY_FALLBACK',
    SIMULATED: 'SIMULATED',
    UNKNOWN: 'UNKNOWN'
  };

  /**
   * Human-readable confidence / source labels (Academic & Strict - No fake 98%)
   */
  const PROVENANCE_LABELS = {
    [PROVENANCE.CURRICULUM_EXPLICIT]: 'Xác định từ CTK',
    [PROVENANCE.CURRICULUM_LT_TH]: 'Xác định từ CTK',
    [PROVENANCE.CURRICULUM_NON_GPA]: 'Xác định từ CTK (Không tính TBTL)',
    [PROVENANCE.GRADE_PAGE]: 'Bảng điểm chính thức',
    [PROVENANCE.USER_OVERRIDE]: 'Tùy chỉnh',
    [PROVENANCE.LEGACY_FALLBACK]: 'Fallback',
    [PROVENANCE.SIMULATED]: 'Mô phỏng',
    [PROVENANCE.UNKNOWN]: 'Chưa xác định'
  };

  /**
   * Lấy nhãn nguồn dữ liệu hiển thị an toàn
   * @param {string} provenanceKey
   * @returns {string}
   */
  function getProvenanceLabel(provenanceKey) {
    return PROVENANCE_LABELS[provenanceKey] || PROVENANCE_LABELS.UNKNOWN;
  }

  const api = {
    PROVENANCE,
    PROVENANCE_LABELS,
    getProvenanceLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global) {
    global.IUHGPA = global.IUHGPA || {};
    global.IUHGPA.core = global.IUHGPA.core || {};
    global.IUHGPA.core.DataProvenance = api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
