(function (global) {
  'use strict';

  /**
   * Lấy toàn bộ tổng quan GPA toàn khóa (Gốc vs Mô phỏng)
   */
  function selectOverallComparison(derivedData) {
    if (!derivedData) return null;
    return {
      original: derivedData.overallOriginal,
      simulated: derivedData.overallSimulated,
      hasSimulations: derivedData.hasSimulations,
      deltaGPA4: (derivedData.overallSimulated?.gpa4 !== null && derivedData.overallOriginal?.gpa4 !== null)
        ? Math.round((derivedData.overallSimulated.gpa4 - derivedData.overallOriginal.gpa4) * 100) / 100
        : 0,
      deltaGPA10: (derivedData.overallSimulated?.gpa10 !== null && derivedData.overallOriginal?.gpa10 !== null)
        ? Math.round((derivedData.overallSimulated.gpa10 - derivedData.overallOriginal.gpa10) * 100) / 100
        : 0,
    };
  }

  /**
   * Lấy danh sách các học kỳ kèm tóm tắt
   */
  function selectSemestersList(derivedData) {
    if (!derivedData || !derivedData.semesters) return [];
    return derivedData.semesters.map(s => ({
      semesterKey: s.semesterKey,
      semesterName: s.semesterName,
      courseCount: s.courses.length,
      originalGPA4: s.calculatedOriginalGPA?.gpa4,
      simulatedGPA4: s.calculatedSimulatedGPA?.gpa4,
      originalGPA10: s.calculatedOriginalGPA?.gpa10,
      simulatedGPA10: s.calculatedSimulatedGPA?.gpa10,
      officialSummary: s.officialSummary,
    }));
  }

  /**
   * Tìm môn học theo ID trong derivedData
   */
  function selectCourseById(derivedData, courseId) {
    if (!derivedData || !derivedData.semesters) return null;
    for (const sem of derivedData.semesters) {
      const found = sem.courses.find(c => c.id === courseId);
      if (found) return found;
    }
    return null;
  }

  const api = {
    selectOverallComparison,
    selectSemestersList,
    selectCourseById,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.state = root.state || Object.create(null);
    root.state.selectors = api;
    global._IUHSelectors = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
