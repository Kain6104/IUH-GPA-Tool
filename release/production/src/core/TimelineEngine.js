(function (global) {
  'use strict';

  const FutureSemesterEngine = (typeof require !== 'undefined')
    ? require('./FutureSemesterEngine.js').FutureSemesterEngine
    : (global.IUHGPA && global.IUHGPA.core ? global.IUHGPA.core.FutureSemesterEngine : (global._IUHFutureSemesterEngine ? global._IUHFutureSemesterEngine.FutureSemesterEngine : null));

class TimelineEngine {
  /**
   * Tạo chuỗi điểm tiến trình GPA qua các học kỳ
   *
   * @param {Array<Object>} semesters - Danh sách học kỳ theo đúng thứ tự adapter đã trích xuất
   * @returns {Array<Object>} Danh sách các điểm mốc tiến trình
   */
  static generateTimelineData(semesters, futureSemesters = []) {
    if (!Array.isArray(semesters) || (semesters.length === 0 && (!Array.isArray(futureSemesters) || futureSemesters.length === 0))) {
      return [];
    }

    const timeline = [];

    // Tích lũy lũy tiến gốc (Original)
    let cumulativeOrigGradePoints = 0;
    let cumulativeOrigCredits = 0;

    // Tích lũy lũy tiến mô phỏng (Simulated)
    let cumulativeSimGradePoints = 0;
    let cumulativeSimCredits = 0;

    // 1. Học kỳ thực tế
    semesters.forEach((sem, index) => {
      const origCalc = sem.calculatedOriginalGPA || ((sem.cumulativeGPA?.value !== undefined || sem.overallGPA?.value !== undefined) ? {
        gradedCredits: sem.credits?.value || 15,
        gpa4: sem.cumulativeGPA?.value ?? sem.overallGPA?.value ?? 0,
        gpa4Raw: sem.cumulativeGPA?.value ?? sem.overallGPA?.value ?? 0,
      } : null);
      const simCalc = sem.calculatedSimulatedGPA || origCalc;

      // Cộng dồn điểm tích lũy gốc
      if (origCalc && origCalc.gradedCredits > 0) {
        cumulativeOrigGradePoints += (origCalc.sumWeighted4 ?? (origCalc.gpa4Raw * origCalc.gradedCredits));
        cumulativeOrigCredits += origCalc.gradedCredits;
      }

      // Cộng dồn điểm tích lũy mô phỏng
      if (simCalc && simCalc.gradedCredits > 0) {
        cumulativeSimGradePoints += (simCalc.sumWeighted4 ?? (simCalc.gpa4Raw * simCalc.gradedCredits));
        cumulativeSimCredits += simCalc.gradedCredits;
      }

      // Tính GPA tích lũy lũy tiến chính xác: sumWeighted / sumCredits
      const cumulativeOrigGPARaw = cumulativeOrigCredits > 0 ? (cumulativeOrigGradePoints / cumulativeOrigCredits) : null;
      const cumulativeOrigGPADisplay = cumulativeOrigGPARaw !== null ? Math.round(cumulativeOrigGPARaw * 100) / 100 : null;

      const cumulativeSimGPARaw = cumulativeSimCredits > 0 ? (cumulativeSimGradePoints / cumulativeSimCredits) : null;
      const cumulativeSimGPADisplay = cumulativeSimGPARaw !== null ? Math.round(cumulativeSimGPARaw * 100) / 100 : null;

      const rawSemName = sem.semesterName || `HK ${index + 1}`;
      const hkMatch = rawSemName.match(/HK\s*([0-9A-Za-z]+)/i);
      const yearMatch = rawSemName.match(/(\d{4})\s*[-–]\s*(\d{4})/);
      let compactLabel = rawSemName;
      if (hkMatch && yearMatch) {
        compactLabel = `HK${hkMatch[1]} ${yearMatch[1].slice(2)}–${yearMatch[2].slice(2)}`;
      } else if (hkMatch) {
        compactLabel = `HK${hkMatch[1]}`;
      }

      timeline.push({
        index,
        isFuture: false,
        semesterKey: sem.semesterKey,
        semesterName: rawSemName,
        compactLabel,
        fullLabel: rawSemName,
        isLatest: index === semesters.length - 1 && (!futureSemesters || futureSemesters.length === 0),

        // Điểm học kỳ này
        semesterOrigGPARaw: origCalc?.gpa4Raw ?? null,
        semesterOrigGPADisplay: origCalc?.gpa4 ?? null,
        semesterSimGPARaw: simCalc?.gpa4Raw ?? null,
        semesterSimGPADisplay: simCalc?.gpa4 ?? null,

        // Điểm tích lũy lũy tiến đến hết học kỳ này
        cumulativeOrigGPARaw,
        cumulativeOrigGPADisplay,
        cumulativeSimGPARaw,
        cumulativeSimGPADisplay,

        // Tín chỉ
        semesterCredits: simCalc?.gradedCredits ?? origCalc?.gradedCredits ?? 0,
        cumulativeCredits: cumulativeSimCredits > 0 ? cumulativeSimCredits : cumulativeOrigCredits,

        // Có mô phỏng khác biệt không
        hasSimulationDelta: cumulativeSimGPADisplay !== null && cumulativeOrigGPADisplay !== null &&
          cumulativeSimGPADisplay !== cumulativeOrigGPADisplay,
        hasSemesterSimulationDelta: simCalc?.gpa4 !== null && origCalc?.gpa4 !== null &&
          simCalc?.gpa4 !== origCalc?.gpa4,
      });
    });

    // 2. Học kỳ tương lai (Future Semesters)
    if (Array.isArray(futureSemesters) && futureSemesters.length > 0) {
      futureSemesters.forEach((fSem, fIdx) => {
        const globalIdx = semesters.length + fIdx;
        let simCalc = fSem.calculatedSimulatedGPA || fSem.summary;
        if (!simCalc && fSem.courses && FutureSemesterEngine) {
          simCalc = FutureSemesterEngine.calculateFutureSemesterGPA(fSem.courses);
        }
        const hasSufficientData = simCalc && simCalc.hasSufficientData;

        if (hasSufficientData && simCalc.gpaEligibleCredits > 0) {
          cumulativeSimGradePoints += (simCalc.gpa4Raw * simCalc.gpaEligibleCredits);
          cumulativeSimCredits += simCalc.gpaEligibleCredits;
        }

        const cumulativeSimGPARaw = (hasSufficientData && cumulativeSimCredits > 0)
          ? (cumulativeSimGradePoints / cumulativeSimCredits)
          : null;
        const cumulativeSimGPADisplay = cumulativeSimGPARaw !== null
          ? Math.round(cumulativeSimGPARaw * 100) / 100
          : null;

        const rawSemName = fSem.semesterName || fSem.label || `HK tương lai ${fIdx + 1}`;
        const hkMatch = rawSemName.match(/HK\s*([0-9A-Za-z]+)/i);
        const yearMatch = rawSemName.match(/(\d{4})\s*[-–]\s*(\d{4})/);
        let compactLabel = rawSemName;
        if (hkMatch && yearMatch) {
          compactLabel = `HK${hkMatch[1]} ${yearMatch[1].slice(2)}–${yearMatch[2].slice(2)}`;
        } else if (hkMatch) {
          compactLabel = `HK${hkMatch[1]}`;
        }

        timeline.push({
          index: globalIdx,
          isFuture: true,
          semesterKey: fSem.id || `future_sem_${fIdx}`,
          semesterName: rawSemName,
          compactLabel: `${compactLabel}*`,
          fullLabel: `${rawSemName} (Mô phỏng tương lai)`,
          isLatest: fIdx === futureSemesters.length - 1,

          // Điểm học kỳ này
          semesterOrigGPARaw: null,
          semesterOrigGPADisplay: null,
          semesterSimGPARaw: hasSufficientData ? simCalc.gpa4Raw : null,
          semesterSimGPADisplay: hasSufficientData ? (Math.round(simCalc.gpa4Raw * 100) / 100) : null,

          // Điểm tích lũy lũy tiến
          cumulativeOrigGPARaw: null,
          cumulativeOrigGPADisplay: null,
          cumulativeSimGPARaw,
          cumulativeSimGPADisplay,

          // Tín chỉ
          semesterCredits: simCalc?.totalPlannedCredits ?? 0,
          cumulativeCredits: cumulativeSimCredits,

          hasSimulationDelta: true,
          hasSemesterSimulationDelta: true,
          hasSufficientData
        });
      });
    }

    return timeline;
  }

  /**
   * Alias cho generateTimelineData
   */
  static generateTimelineSeries(semesters, futureSemesters = []) {
    return this.generateTimelineData(semesters, futureSemesters);
  }

  /**
   * Tính toán tọa độ và đường cong SVG cho biểu đồ tiến trình GPA
   *
   * @param {Array<Object>} timelineData - Kết quả từ generateTimelineData
   * @param {Object} [options] - Kích thước viewBox SVG và mode
   * @param {number} [options.width=600]
   * @param {number} [options.height=220]
   * @param {number} [options.padding=36]
   * @param {'cumulative'|'semester'} [options.mode='cumulative']
   * @returns {Object} SVG chart geometry model
   */
  static computeSVGChartModel(timelineData, options = {}) {
    const width = options.width ?? 600;
    const height = options.height ?? 220;
    const padding = options.padding ?? 36;
    const mode = options.mode || 'cumulative';

    if (!Array.isArray(timelineData) || timelineData.length === 0) {
      return { isEmpty: true, width, height, padding, mode };
    }

    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const count = timelineData.length;
    const xStep = count > 1 ? chartW / (count - 1) : chartW / 2;

    // Y scale: Thang điểm 4 (từ 0.0 đến 4.0), thuần túy số học, không nhãn phân loại gây ngộ nhận
    const yMin = 0.0;
    const yMax = 4.0;

    const getY = (val) => {
      if (val === null || isNaN(val)) return null;
      const clamped = Math.max(yMin, Math.min(yMax, val));
      return height - padding - ((clamped - yMin) / (yMax - yMin)) * chartH;
    };

    const getX = (idx) => padding + (count > 1 ? idx * xStep : chartW / 2);

    // Tọa độ các điểm mốc
    const origSemesterPoints = [];
    const simSemesterPoints = [];
    const origCumulativePoints = [];
    const simCumulativePoints = [];

    timelineData.forEach((item, idx) => {
      const x = getX(idx);

      if (typeof item.semesterOrigGPADisplay === 'number') {
        const y = getY(item.semesterOrigGPADisplay);
        if (y !== null) origSemesterPoints.push({ x, y, val: item.semesterOrigGPADisplay, data: item });
      }
      if (typeof item.semesterSimGPADisplay === 'number') {
        const y = getY(item.semesterSimGPADisplay);
        if (y !== null) simSemesterPoints.push({ x, y, val: item.semesterSimGPADisplay, data: item });
      }

      if (typeof item.cumulativeOrigGPADisplay === 'number') {
        const y = getY(item.cumulativeOrigGPADisplay);
        if (y !== null) origCumulativePoints.push({ x, y, val: item.cumulativeOrigGPADisplay, data: item });
      }
      if (typeof item.cumulativeSimGPADisplay === 'number') {
        const y = getY(item.cumulativeSimGPADisplay);
        if (y !== null) simCumulativePoints.push({ x, y, val: item.cumulativeSimGPADisplay, data: item });
      }
    });

    const buildPath = (pts) => {
      if (!Array.isArray(pts)) return '';
      const valid = pts.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
      if (valid.length === 0) return '';
      return valid.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    };

    // Numeric-only Y gridlines (Không gán nhãn Xuất sắc/Giỏi/Khá lên trục)
    const yGuides = [
      { val: 4.0, label: '4.0', y: getY(4.0) },
      { val: 3.0, label: '3.0', y: getY(3.0) },
      { val: 2.0, label: '2.0', y: getY(2.0) },
      { val: 1.0, label: '1.0', y: getY(1.0) },
      { val: 0.0, label: '0.0', y: getY(0.0) },
    ];

    // Điểm và đường cong active theo mode
    const isSemesterMode = mode === 'semester';
    const activeOrigPoints = isSemesterMode ? origSemesterPoints : origCumulativePoints;
    const activeSimPoints = isSemesterMode ? simSemesterPoints : simCumulativePoints;
    const activePathOrig = isSemesterMode ? buildPath(origSemesterPoints) : buildPath(origCumulativePoints);
    const activePathSim = isSemesterMode ? buildPath(simSemesterPoints) : buildPath(simCumulativePoints);

    // Tách đường nét liền cho học kỳ thực tế và nét đứt (dashed) cho học kỳ tương lai
    const actualSimPts = activeSimPoints.filter(p => !p.data?.isFuture);
    const actualBasePts = actualSimPts.length > 0 ? actualSimPts : activeOrigPoints.filter(p => !p.data?.isFuture);
    const lastActualPt = actualBasePts.length > 0 ? actualBasePts[actualBasePts.length - 1] : null;
    const futureSimPts = (activeSimPoints.length > 0 ? activeSimPoints : activeOrigPoints).filter(p => p.data?.isFuture);
    const futurePathPts = (lastActualPt && futureSimPts.length > 0) ? [lastActualPt, ...futureSimPts] : futureSimPts;

    const pathActualSolid = buildPath(actualBasePts);
    const pathFutureDashed = buildPath(futurePathPts);

    return {
      isEmpty: false,
      width,
      height,
      padding,
      mode,
      xStep,
      yGuides,
      gridLines: yGuides,
      activeOrigPoints,
      activeSimPoints,
      activePathOrig,
      activePathSim,
      pathActualSolid,
      pathFutureDashed,
      hasFuturePoints: futureSimPts.length > 0,
      origSemesterPoints,
      simSemesterPoints,
      origCumulativePoints,
      simCumulativePoints,
      pathOrigSemester: buildPath(origSemesterPoints),
      pathSimSemester: buildPath(simSemesterPoints),
      pathOrigCumulative: buildPath(origCumulativePoints),
      pathSimCumulative: buildPath(simCumulativePoints),
    };
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      TimelineEngine,
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.TimelineEngine = TimelineEngine;
    global._IUHTimelineEngine = {
      TimelineEngine,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
