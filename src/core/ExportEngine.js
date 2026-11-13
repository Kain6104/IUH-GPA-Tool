(function (global) {
  'use strict';

  const EXPORT_DISCLAIMER = 'MÔ PHỎNG – KHÔNG PHẢI BẢNG ĐIỂM CHÍNH THỨC IUH';
  const targetMod = typeof require !== 'undefined'
    ? require('./GPATargetEngine.js')
    : (global.IUHGPA?.core || global._IUHGPATargetEngine || {});
  const forecastMod = typeof require !== 'undefined'
    ? require('./ForecastEngine.js')
    : (global.IUHGPA?.core || global._IUHForecastEngine || {});
  const rescueMod = typeof require !== 'undefined'
    ? require('./GPARescueEngine.js')
    : (global.IUHGPA?.core || global._IUHGPARescueEngine || {});
  const GPATargetEngine = targetMod.GPATargetEngine;
  const ForecastEngine = forecastMod.ForecastEngine;
  const DEFAULT_FORECAST_SCENARIOS = forecastMod.DEFAULT_FORECAST_SCENARIOS || [];
  const GPARescueEngine = rescueMod.GPARescueEngine;

/**
 * Các ký tự kích hoạt thực thi công thức trong bảng tính (Excel, LibreOffice, Google Sheets)
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Sanitize một ô văn bản nhằm ngăn chặn CSV / Spreadsheet Formula Injection.
 * Nếu chuỗi bắt đầu bằng các ký tự trigger công thức (=, +, -, @, \t, \r),
 * thêm dấu nháy đơn ' ở đầu để buộc bảng tính hiểu đây là kiểu TEXT thuần túy.
 *
 * @param {*} value
 * @returns {string}
 */
function sanitizeSpreadsheetCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  // Nếu là số thực sự thì giữ nguyên định dạng số
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'boolean') {
    return value ? 'ĐẠT' : 'RỚT';
  }

  let str = String(value);

  // Loại bỏ control characters độc hại ở đầu (ngoại trừ ký tự có thể in)
  // Nếu ký tự đầu tiên nằm trong danh sách trigger
  if (str.length > 0 && FORMULA_TRIGGERS.includes(str[0])) {
    // Prefix bằng dấu nháy đơn theo chuẩn bảo mật bảng tính OWASP
    str = "'" + str;
  }

  return str;
}

/**
 * Escape một ô CSV theo chuẩn RFC 4180
 * Bao bọc bởi ngoặc kép nếu chứa dấu phẩy, ngoặc kép hoặc ký tự xuống dòng.
 * Dấu ngoặc kép bên trong được nhân đôi (" -> "").
 *
 * @param {*} rawValue
 * @returns {string}
 */
function escapeCSVField(rawValue) {
  const sanitized = sanitizeSpreadsheetCell(rawValue);

  // Nếu chuỗi chứa dấu phẩy, ngoặc kép, hoặc xuống dòng thì phải bọc ngoặc kép
  if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n') || sanitized.includes('\r')) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}

/**
 * Tạo tên file xuất an toàn, ngăn chặn Directory Traversal và ký tự đặc biệt của OS
 *
 * @param {string} [prefix='IUH-GPA-Mo-Phong']
 * @param {string} [extension='csv']
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
function generateSafeFileName(prefix = 'IUH-GPA-Mo-Phong', extension = 'csv', now = new Date()) {
  // Sanitize prefix: chỉ cho phép chữ cái, chữ số, gạch ngang, gạch dưới
  const cleanPrefix = String(prefix)
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .substring(0, 32) || 'IUH-GPA-Mo-Phong';

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const cleanExt = String(extension).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'csv';

  return `${cleanPrefix}-${year}-${month}-${day}.${cleanExt}`;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let name = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  }
  return name;
}

function normalizeCell(value, style = 0) {
  if (value === null || value === undefined || value === '') return { value: '', style };
  if (typeof value === 'number') {
    return { value: Number.isFinite(value) ? value : '', style };
  }
  if (typeof value === 'boolean') {
    return { value: value ? 'Có' : 'Không', style };
  }
  return { value: sanitizeSpreadsheetCell(value), style };
}

function assessmentValue(item) {
  if (typeof item === 'number') return item;
  if (item && item.status === 'ok' && typeof item.value === 'number') return item.value;
  if (item && item.value?.status === 'ok' && typeof item.value.value === 'number') return item.value.value;
  if (item && typeof item.value === 'number') return item.value;
  return null;
}

function assessmentListValue(items, slot) {
  if (!Array.isArray(items)) return null;
  const item = items.find((candidate, index) => (candidate?.slot ?? index + 1) === slot);
  return assessmentValue(item);
}

function workbookStylesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="4">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="16"/><color rgb="FF153898"/><name val="Calibri"/></font>' +
    '<font><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
    '<font><i/><color rgb="FF991B1B"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="5">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF153898"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F0FE"/><bgColor indexed="64"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right>' +
    '<top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="10">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>' +
    '<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

function worksheetXml(sheet) {
  const rows = sheet.rows || [];
  const maxColumns = Math.max(1, ...rows.map(row => row.length));
  const lastRow = Math.max(1, rows.length);
  const lastColumn = columnName(maxColumns - 1);
  const columns = (sheet.widths || []).map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  ).join('');
  const rowXml = rows.map((row, rowIndex) => {
    const cells = row.map((rawCell, columnIndex) => {
      const cell = (rawCell && typeof rawCell === 'object' && Object.prototype.hasOwnProperty.call(rawCell, 'value'))
        ? rawCell
        : normalizeCell(rawCell);
      if (cell.value === '') return '';
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      const style = cell.style ? ` s="${cell.style}"` : '';
      if (typeof cell.value === 'number') return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');
  const pane = sheet.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const autoFilter = sheet.autoFilter && rows.length > sheet.headerRow
    ? `<autoFilter ref="A${sheet.headerRow + 1}:${lastColumn}${lastRow}"/>`
    : '';
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastColumn}${lastRow}"/>${pane}` +
    (columns ? `<cols>${columns}</cols>` : '') +
    `<sheetData>${rowXml}</sheetData>${autoFilter}${merges}</worksheet>`;
}

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zipStoredFiles(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(file => {
    const name = encoder.encode(file.name);
    const data = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
    const checksum = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034B50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(12, 0x0021, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014B50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(14, 0x0021, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  });

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054B50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const parts = [...localParts, ...centralParts, end];
  const archive = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let position = 0;
  parts.forEach(part => {
    archive.set(part, position);
    position += part.length;
  });
  return archive;
}

class ExportEngine {
  /**
   * Tạo chuỗi CSV từ dữ liệu học kỳ và kịch bản mô phỏng
   *
   * @param {Object} options
   * @param {Array<Object>} options.semesters - Danh sách học kỳ từ derivedData
   * @param {string} [options.scenarioName='Mặc định'] - Tên kịch bản đang active
   * @param {Object} [options.overallSummary] - Tổng kết GPA toàn khóa { original, simulated }
   * @returns {string} - Chuỗi CSV hoàn chỉnh bao gồm UTF-8 BOM
   */
  static generateCSV(options = {}) {
    const { semesters = [], scenarioName = 'Mặc định', overallSummary = null } = options;

    const lines = [];

    // Dòng 1: Disclaimer bắt buộc
    lines.push(escapeCSVField(`# ${EXPORT_DISCLAIMER}`));

    // Dòng 2: Metadata kịch bản và ngày xuất (không chứa PII)
    const exportTime = new Date().toISOString().slice(0, 10);
    lines.push(escapeCSVField(`# Kịch bản: ${scenarioName} | Ngày xuất: ${exportTime}`));

    // Dòng 3: Tổng quan GPA nếu có
    if (overallSummary) {
      const orig4 = overallSummary.original?.gpa4 !== null ? overallSummary.original.gpa4.toFixed(2) : '--';
      const sim4 = overallSummary.simulated?.gpa4 !== null ? overallSummary.simulated.gpa4.toFixed(2) : '--';
      lines.push(escapeCSVField(`# GPA Hệ 4 Gốc: ${orig4} | GPA Hệ 4 Mô phỏng: ${sim4}`));
    }

    // Dòng trống phân cách metadata
    lines.push('');

    // Dòng tiêu đề cột chính thức
    const headers = [
      'Học kỳ',
      'Mã môn',
      'Tên môn',
      'Số tín chỉ',
      'Điểm cuối kỳ gốc',
      'Điểm cuối kỳ mô phỏng',
      'Điểm tổng kết gốc',
      'Điểm tổng kết mô phỏng',
      'Điểm hệ 4 mô phỏng',
      'Điểm chữ mô phỏng',
      'Trạng thái mô phỏng'
    ];
    lines.push(headers.map(escapeCSVField).join(','));

    // Các dòng dữ liệu
    for (const sem of semesters) {
      const semName = sem.semesterName || sem.semesterKey || 'Học kỳ';

      if (!Array.isArray(sem.courses)) continue;

      for (const course of sem.courses) {
        // Tín chỉ
        const credits = course.credits?.status === 'ok' ? course.credits.value : (course.credits?.raw || 0);

        // Điểm cuối kỳ gốc vs mô phỏng
        const origFinal = course.originalFinal !== null && course.originalFinal !== undefined ? course.originalFinal : '';
        const simFinal = course.simulatedFinal !== null && course.simulatedFinal !== undefined ? course.simulatedFinal : origFinal;

        // Điểm tổng kết gốc vs mô phỏng
        const origTotal = course.officialResult?.total10?.status === 'ok'
          ? course.officialResult.total10.value
          : (course.score10 !== null ? course.score10 : '');
        const simTotal = course.score10 !== null && course.score10 !== undefined ? course.score10 : '';

        // Điểm thang 4 & chữ mô phỏng
        const simScore4 = course.score4 !== null && course.score4 !== undefined ? course.score4 : '';
        const simLetter = course.letter || '';

        // Trạng thái đạt/rớt
        const statusText = course.passed === true ? 'ĐẠT' : (course.passed === false ? 'RỚT' : 'CHƯA CÓ ĐIỂM');

        const row = [
          semName,
          course.courseCode || course.id || '',
          course.courseName || '',
          credits,
          origFinal,
          simFinal,
          origTotal,
          simTotal,
          simScore4,
          simLetter,
          statusText
        ];

        lines.push(row.map(escapeCSVField).join(','));
      }
    }

    // Xuất các học kỳ trong kế hoạch tương lai nếu có (Requirement 67 & 68)
    const futureSemesters = (options.futurePlan && Array.isArray(options.futurePlan.semesters))
      ? options.futurePlan.semesters
      : (Array.isArray(semesters) ? semesters.filter(s => s.isFuture) : []);

    if (futureSemesters.length > 0) {
      lines.push('');
      lines.push(escapeCSVField('# KẾ HOẠCH HỌC TẬP TƯƠNG LAI (MÔ PHỎNG – KHÔNG PHẢI BẢNG ĐIỂM CHÍNH THỨC)'));

      for (const fSem of futureSemesters) {
        // Tránh trùng lặp nếu fSem đã được duyệt trong vòng lặp trước
        if (semesters.includes(fSem)) continue;

        const semLabel = (fSem.label || fSem.semesterName || 'Học kỳ mô phỏng') + ' [Mô phỏng tương lai]';
        const courses = fSem.courses || [];

        for (const fc of courses) {
          const credits = fc.credits || 0;
          const origFinal = ''; // Không có điểm gốc vì là tương lai
          const origTotal = '';

          let simFinal = '';
          if (fc.scores && fc.scores.final !== null && fc.scores.final !== undefined) {
            simFinal = fc.scores.final;
          } else if (fc.isPlannedPreset && fc.plannedLetterGradeOverride) {
            simFinal = 'Giả định ' + fc.plannedLetterGradeOverride;
          }

          const simTotal = (fc.score10Raw !== null && fc.score10Raw !== undefined)
            ? fc.score10Raw
            : (typeof fc.plannedScore10Override === 'number' ? fc.plannedScore10Override : '');

          const simScore4 = (fc.score4Raw !== null && fc.score4Raw !== undefined)
            ? fc.score4Raw
            : (typeof fc.plannedGradePointOverride === 'number' ? fc.plannedGradePointOverride : '');

          const simLetter = fc.letter || fc.plannedLetterGradeOverride || '';

          let statusText = 'MÔ PHỎNG TƯƠNG LAI';
          if (fc.isPassed === true || (fc.plannedGradePointOverride && fc.plannedGradePointOverride >= 1.0)) {
            statusText = fc.isPlannedPreset ? 'ĐẠT (Mô phỏng - Giả định)' : 'ĐẠT (Mô phỏng tương lai)';
          } else if (fc.isPassed === false) {
            statusText = 'RỚT (Mô phỏng tương lai)';
          }

          const row = [
            semLabel,
            fc.curriculumCourseCode || fc.code || fc.id || '',
            fc.courseName || '',
            credits,
            origFinal,
            simFinal,
            origTotal,
            simTotal,
            simScore4,
            simLetter,
            statusText
          ];

          lines.push(row.map(escapeCSVField).join(','));
        }
      }
    }

    // Kết hợp bằng CRLF (\r\n) chuẩn cho Windows & Excel
    // Thêm UTF-8 BOM (\uFEFF) để Excel hiển thị đúng tiếng Việt có dấu
    return '\uFEFF' + lines.join('\r\n');
  }

  static generateXLSX(options = {}) {
    if (!GPATargetEngine || !ForecastEngine || !GPARescueEngine) {
      throw new Error('Không thể tải đầy đủ các engine phân tích để xuất Excel.');
    }

    const semesters = Array.isArray(options.semesters) ? options.semesters : [];
    const futureSemesters = options.futurePlan?.semesters || [];
    const overallSummary = options.overallSummary || {};
    const original = overallSummary.original || {};
    const simulated = overallSummary.simulated || {};
    const effective = options.hasSimulations ? simulated : original;
    const analysisOptions = options.analysis || {};
    const currentGradePoints = effective.sumWeighted4
      ?? (Number.isFinite(effective.gpa4Raw) && Number.isFinite(effective.gradedCredits)
        ? effective.gpa4Raw * effective.gradedCredits
        : 0);
    const currentCredits = effective.gradedCredits || 0;
    const targetGPA = analysisOptions.targetGPA ?? 3.2;
    const remainingCredits = analysisOptions.remainingCredits ?? 0;
    const futureAverage = analysisOptions.forecastFutureAverage ?? 3.0;
    const targetLetter = analysisOptions.rescueTargetLetter || 'B+';
    const tableRow = (values, style = 0) => values.map(value => normalizeCell(value, style));
    const titleRow = (title, count) => {
      const row = Array.from({ length: count }, () => normalizeCell(''));
      row[0] = normalizeCell(title, 1);
      return row;
    };
    const noteRow = (text, count) => {
      const row = Array.from({ length: count }, () => normalizeCell(''));
      row[0] = normalizeCell(text, 2);
      return row;
    };
    const headerRow = values => tableRow(values, 3);
    const sectionRow = values => tableRow(values, 4);
    const numberOrBlank = value => (typeof value === 'number' && Number.isFinite(value) ? value : '');
    const resultValue = (obj, key) => {
      const entry = obj?.[key];
      return entry?.status === 'ok' ? entry.value : numberOrBlank(entry);
    };
    const courseCode = course => course.courseCode || course.courseClassCode || course.curriculumCourseCode || course.code || '';
    const letterName = letter => letter || '';
    const classificationName = course => course.classification || course.officialResult?.classification || '';
    const allActualCourses = semesters.flatMap(semester => (semester.courses || []).map(course => ({
      ...course,
      semesterName: semester.semesterName || semester.semesterKey || 'Học kỳ',
    })));
    const academicYear = label => {
      const match = String(label || '').match(/(\d{4})\s*[-–]\s*(\d{4})/);
      return match ? `Niên học ${match[1]} - ${match[2]}` : String(label || 'Học kỳ');
    };

    const transcriptRows = [
      titleRow('PHỤ LỤC KẾT QUẢ HỌC TẬP · BẢNG ĐIỂM CHI TIẾT', 11),
      noteRow(EXPORT_DISCLAIMER, 11),
      noteRow(`Kịch bản: ${options.scenarioName || 'Mặc định'} · Xuất ngày ${new Date().toISOString().slice(0, 10)} · Không xuất họ tên, mã sinh viên hoặc ngày sinh.`, 11),
      headerRow(['STT', 'Mã học phần', 'Tên học phần', 'STC', 'Hệ 10 gốc', 'Hệ 4 gốc', 'Chữ gốc', 'Xếp loại gốc', 'Hệ 10 mô phỏng', 'Hệ 4 mô phỏng', 'Chữ mô phỏng']),
    ];
    let ordinal = 0;
    semesters.forEach(semester => {
      const startRow = transcriptRows.length + 1;
      transcriptRows.push(sectionRow([academicYear(semester.semesterName || semester.semesterKey), '', '', '', '', '', '', '', '', '', '']));
      (semester.courses || []).forEach(course => {
        ordinal++;
        const originalTotal = course.originalScore10 ?? resultValue(course.officialResult, 'total10');
        const originalFour = course.originalScore4 ?? resultValue(course.officialResult, 'score4');
        transcriptRows.push(tableRow([
          course.ordinal || ordinal,
          courseCode(course),
          course.courseName || '',
          numberOrBlank(course.credits),
          numberOrBlank(originalTotal),
          numberOrBlank(originalFour),
          course.officialResult?.letter || (course.isSimulated ? '' : course.letter) || '',
          course.officialResult?.classification || (course.isSimulated ? '' : classificationName(course)),
          numberOrBlank(course.score10),
          numberOrBlank(course.score4),
          letterName(course.letter),
        ]));
      });
      const semGpa = semester.calculatedSimulatedGPA || {};
      transcriptRows.push(tableRow(['', '', 'GPA học kỳ mô phỏng', numberOrBlank(semGpa.gradedCredits), '', '', '', '', numberOrBlank(semGpa.gpa10), numberOrBlank(semGpa.gpa4), ''], 7));
      transcriptRows.push(Array(11).fill(normalizeCell('')));
      transcriptRows[startRow - 1] = sectionRow([academicYear(semester.semesterName || semester.semesterKey), '', '', '', '', '', '', '', '', '', '']);
    });
    if (allActualCourses.length === 0) {
      transcriptRows.push(tableRow(['', '', 'Chưa có dữ liệu học phần.', '', '', '', '', '', '', '', ''], 8));
    }
    const transcriptSheet = {
      name: 'Phu luc diem',
      rows: transcriptRows,
      widths: [7, 18, 42, 8, 13, 13, 12, 22, 16, 16, 16],
      freezeRows: 4,
      headerRow: 3,
      autoFilter: true,
      merges: ['A1:K1', 'A2:K2', 'A3:K3'],
    };

    const detailHeaders = [
      'Học kỳ', 'STT', 'Mã học phần', 'Tên học phần', 'Loại môn', 'TC',
      'Giữa kỳ gốc', 'Giữa kỳ mô phỏng',
      ...Array.from({ length: 9 }, (_, index) => `TX${index + 1} gốc`),
      ...Array.from({ length: 9 }, (_, index) => `TX${index + 1} mô phỏng`),
      ...Array.from({ length: 5 }, (_, index) => `TH${index + 1} gốc`),
      ...Array.from({ length: 5 }, (_, index) => `TH${index + 1} mô phỏng`),
      'Cuối kỳ gốc', 'Cuối kỳ mô phỏng', 'TB quá trình', 'Tổng kết gốc / 10',
      'Tổng kết mô phỏng / 10', 'GPA gốc / 4', 'GPA mô phỏng / 4',
      'Chữ mô phỏng', 'Tính GPA', 'Đạt',
    ];
    const detailRows = [
      titleRow('CHI TIẾT ĐIỂM THÀNH PHẦN THEO HỌC PHẦN', detailHeaders.length),
      noteRow(EXPORT_DISCLAIMER, detailHeaders.length),
      headerRow(detailHeaders),
    ];
    allActualCourses.forEach(course => {
      const assessments = course.assessments || {};
      const simRegular = course.simulatedRegular || [];
      const simPractice = course.simulatedPractice || [];
      const originalRegular = Array.from({ length: 9 }, (_, index) => assessmentListValue(assessments.regular, index + 1));
      const originalPractice = Array.from({ length: 5 }, (_, index) => assessmentListValue(assessments.practice, index + 1));
      const simulatedRegularValues = Array.from({ length: 9 }, (_, index) => {
        const score = simRegular.find(item => (item.slot || 0) === index + 1);
        return score ? score.value : originalRegular[index];
      });
      const simulatedPracticeValues = Array.from({ length: 5 }, (_, index) => {
        const score = simPractice.find(item => (item.slot || 0) === index + 1);
        return score ? score.value : originalPractice[index];
      });
      const values = [
        course.semesterName, course.ordinal || '', courseCode(course), course.courseName,
        course.courseType || course.courseTypeOverride || '', numberOrBlank(course.credits),
        assessmentValue(assessments.midterm), course.simulatedMidterm ?? assessmentValue(assessments.midterm),
        ...originalRegular, ...simulatedRegularValues,
        ...originalPractice, ...simulatedPracticeValues,
        course.originalFinal ?? assessmentValue(assessments.finalExam),
        course.simulatedFinal ?? course.originalFinal ?? assessmentValue(assessments.finalExam),
        numberOrBlank(course.processAverage),
        numberOrBlank(course.originalScore10),
        numberOrBlank(course.score10),
        numberOrBlank(course.originalScore4),
        numberOrBlank(course.score4),
        course.letter || '',
        course.included === false || course.isExcludedFromGpa ? 'Không' : 'Có',
        course.passed === true ? 'Đạt' : course.passed === false ? 'Chưa đạt' : 'Chưa có điểm',
      ];
      detailRows.push(tableRow(values));
    });
    if (allActualCourses.length === 0) {
      detailRows.push(tableRow(['', '', '', 'Chưa có dữ liệu học phần'], 8));
    }
    const detailSheet = {
      name: 'Chi tiet diem',
      rows: detailRows,
      widths: [24, 7, 18, 40, 18, 7, ...Array(30).fill(11), ...Array(10).fill(15)],
      freezeRows: 3,
      headerRow: 2,
      autoFilter: true,
    };

    const summaryRows = [
      titleRow('TỔNG QUAN KẾT QUẢ HỌC TẬP & MÔ PHỎNG', 4),
      noteRow(EXPORT_DISCLAIMER, 4),
      headerRow(['Chỉ số', 'Kết quả gốc', 'Mô phỏng hiện tại', 'Chênh lệch']),
    ];
    [
      ['GPA hệ 10', original.gpa10Raw ?? original.gpa10, simulated.gpa10Raw ?? simulated.gpa10],
      ['GPA hệ 4', original.gpa4Raw ?? original.gpa4, simulated.gpa4Raw ?? simulated.gpa4],
      ['Tín chỉ tính GPA', original.gradedCredits, simulated.gradedCredits],
      ['Tín chỉ tích lũy', original.earnedCredits, simulated.earnedCredits],
      ['Tổng tín chỉ', original.totalCredits, simulated.totalCredits],
      ['Số học kỳ thực tế', semesters.length, semesters.length],
      ['Số học phần thực tế', allActualCourses.length, allActualCourses.length],
      ['Trạng thái đồng bộ CTK', options.curriculumStatus || 'UNSYNCED', options.curriculumProgress?.reconciliationStatus || ''],
      ['Tín chỉ CTK đã hoàn thành', numberOrBlank(options.curriculumProgress?.verifiedCurriculumCompletedCredits ?? options.curriculumProgress?.curriculumCompletedCredits), ''],
      ['Tổng tín chỉ yêu cầu theo CTK', numberOrBlank(options.curriculumProgress?.curriculumRequiredCredits), ''],
      ['Tín chỉ GPA còn lại theo CTK', numberOrBlank(options.curriculumProgress?.gpaEligibleRemainingCredits), ''],
      ['Tín chỉ còn thiếu sau kế hoạch', numberOrBlank(options.curriculumProgress?.curriculumRemainingAfterPlan), ''],
    ].forEach(([label, oldValue, newValue]) => {
      const difference = typeof oldValue === 'number' && typeof newValue === 'number' ? newValue - oldValue : '';
      summaryRows.push(tableRow([label, numberOrBlank(oldValue), numberOrBlank(newValue), numberOrBlank(difference)]));
    });
    summaryRows.push(tableRow(['Trạng thái mô phỏng', options.hasSimulations ? 'Có mô phỏng đang áp dụng' : 'Đang dùng dữ liệu gốc', '', ''], 7));
    const summarySheet = {
      name: 'Tong quan',
      rows: summaryRows,
      widths: [34, 24, 26, 20],
      freezeRows: 3,
      headerRow: 2,
    };

    const planRows = [
      titleRow('KẾ HOẠCH HỌC TẬP TƯƠNG LAI', 12),
      noteRow(EXPORT_DISCLAIMER, 12),
      headerRow(['Học kỳ dự kiến', 'Mã học phần', 'Tên học phần', 'Loại môn', 'TC', 'Giữa kỳ', ...Array.from({ length: 9 }, (_, index) => `TX${index + 1}`), 'Cuối kỳ', 'Tổng kết / 10', 'GPA / 4', 'Điểm chữ', 'Trạng thái', 'Tính GPA']),
    ];
    const planHeadersCount = planRows[2].length;
    futureSemesters.forEach(semester => {
      (semester.courses || []).forEach(course => {
        const scores = course.scores || {};
        planRows.push(tableRow([
          semester.label || semester.semesterName || `HK${semester.term || ''}`,
          course.curriculumCourseCode || course.code || '',
          course.courseName || '',
          course.courseTypeOverride || course.inferredCourseType || '',
          numberOrBlank(course.credits),
          numberOrBlank(scores.midterm),
          ...Array.from({ length: 9 }, (_, index) => numberOrBlank(scores.regular?.[index])),
          numberOrBlank(scores.final),
          numberOrBlank(course.score10Raw ?? course.score10),
          numberOrBlank(course.score4Raw ?? course.score4),
          course.letter || course.plannedLetterGradeOverride || '',
          course.isPassed === true ? 'Đạt (mô phỏng)' : course.isPassed === false ? 'Chưa đạt (mô phỏng)' : 'Chưa nhập đủ điểm',
          course.included === false || course.courseTypeOverride === 'EXCLUDED' ? 'Không' : 'Có',
        ]));
      });
    });
    if (futureSemesters.length === 0) {
      planRows.push(tableRow(['', '', 'Chưa có học kỳ mô phỏng tương lai.'], 8));
    }
    const planSheet = {
      name: 'Ke hoach',
      rows: planRows,
      widths: [26, 18, 42, 18, 7, ...Array(10).fill(11), 14, 18, 14, 14, 22, 18],
      freezeRows: 3,
      headerRow: 2,
      autoFilter: true,
    };
    if (planHeadersCount !== planRows[2].length) throw new Error('Cấu trúc cột kế hoạch Excel không hợp lệ.');

    const target = GPATargetEngine.calculateRequiredFutureGPA({
      currentGradePoints,
      currentCredits,
      targetGPA,
      remainingCredits,
    });
    const targetRows = [
      titleRow('PHÂN TÍCH MỤC TIÊU GPA', 3),
      noteRow('Kết quả phụ thuộc tín chỉ còn lại và dữ liệu hiện có; đây là ước tính, không phải cam kết kết quả.', 3),
      headerRow(['Thông số', 'Giá trị', 'Diễn giải']),
      tableRow(['GPA mục tiêu hệ 4', targetGPA, 'Giá trị nhập trên bảng Phân tích']),
      tableRow(['GPA hiện tại dùng tính toán', numberOrBlank(currentCredits > 0 ? currentGradePoints / currentCredits : null), 'Dữ liệu mô phỏng hiện tại nếu đang bật; nếu không dùng kết quả gốc']),
      tableRow(['Tín chỉ đã tính GPA', currentCredits, 'Lấy từ kết quả GPA hiện tại']),
      tableRow(['Tín chỉ còn lại', remainingCredits, analysisOptions.remainingCreditsSource || 'Nguồn theo bảng Phân tích']),
      tableRow(['GPA trung bình cần đạt', numberOrBlank(target.requiredFutureAverageRaw), target.requiredFutureAverageDisplay === null || target.requiredFutureAverageDisplay === undefined ? '' : target.requiredFutureAverageDisplay]),
      tableRow(['Trạng thái', target.status, target.difficulty?.label || target.reason || '']),
      tableRow(['Tổng tín chỉ sau hoàn thành', numberOrBlank(target.totalCredits), '']),
    ];
    const targetSheet = { name: 'Muc tieu GPA', rows: targetRows, widths: [34, 24, 78], freezeRows: 3 };

    const forecastPoint = ForecastEngine.calculateProjectedGPA({
      currentGradePoints,
      currentCredits,
      futureAverage,
      remainingCredits,
    });
    const forecastRows = [
      titleRow('PHÂN TÍCH DỰ BÁO GPA TỐT NGHIỆP', 5),
      noteRow('Các kịch bản giả định GPA trung bình phần còn lại; không bao gồm điều kiện tốt nghiệp khác.', 5),
      headerRow(['Kịch bản', 'GPA phần còn lại', 'GPA tốt nghiệp dự kiến', 'Xếp loại', 'Trạng thái']),
      tableRow(['Đang chọn', futureAverage, numberOrBlank(forecastPoint.projectedGPADisplay), forecastPoint.classification || '', forecastPoint.status]),
      ...DEFAULT_FORECAST_SCENARIOS.map(average => {
        const result = ForecastEngine.calculateProjectedGPA({
          currentGradePoints, currentCredits, futureAverage: average, remainingCredits,
        });
        return tableRow(['So sánh', average, numberOrBlank(result.projectedGPADisplay), result.classification || '', result.status]);
      }),
    ];
    const forecastSheet = { name: 'Du bao', rows: forecastRows, widths: [20, 24, 30, 24, 20], freezeRows: 3, headerRow: 2, autoFilter: true };

    const rescue = GPARescueEngine.analyzeRescuePriorities({
      courses: options.allSimulatedCourses || allActualCourses,
      currentTotalGradePoints: currentGradePoints,
      eligibleCredits: currentCredits,
      defaultTargetLetter: targetLetter,
    });
    const rescueRows = [
      titleRow('PHÂN TÍCH CẢI THIỆN GPA', 11),
      noteRow(rescue.disclaimer || EXPORT_DISCLAIMER, 11),
      noteRow(`Mục tiêu đang chọn: ${targetLetter} · Tín chỉ đang tính GPA: ${currentCredits} · Trạng thái: ${rescue.status || 'UNKNOWN'}`, 11),
      headerRow(['Xếp hạng', 'Mã học phần', 'Tên học phần', 'TC', 'Điểm chữ hiện tại', 'GPA hiện tại', 'Điểm chữ mục tiêu', 'GPA mục tiêu', 'Tăng điểm quy đổi', 'GPA tích lũy mới', 'GPA tăng']),
    ];
    (rescue.rankedCourses || []).forEach((course, index) => {
      rescueRows.push(tableRow([
        index + 1, course.courseCode || course.courseId || '', course.courseName || '', course.credits,
        course.currentLetter || '', course.currentGradePoint, course.selectedTargetLetter,
        course.selectedTargetGradePoint, course.deltaGradePoints,
        course.newCumulativeGPADisplay, course.gpaDeltaDisplay,
      ]));
    });
    rescueRows.push(Array(11).fill(normalizeCell('')));
    rescueRows.push(headerRow(['Môn chưa đủ điều kiện / đã tối đa', 'Mã / ID', 'Tên học phần', 'TC', 'Lý do']));
    (rescue.excludedCourses || []).forEach(course => {
      rescueRows.push(tableRow(['Bỏ qua', course.courseCode || course.courseId || '', course.courseName || '', numberOrBlank(course.credits), course.reason || '']));
    });
    if (!(rescue.rankedCourses || []).length) {
      rescueRows.push(tableRow(['', '', rescue.reason || 'Không có học phần đủ điều kiện cải thiện.', '', '', '', '', '', '', '', ''], 8));
    }
    const rescueSheet = {
      name: 'Cai thien GPA',
      rows: rescueRows,
      widths: [14, 18, 40, 8, 20, 16, 20, 16, 22, 22, 16],
      freezeRows: 4,
      headerRow: 3,
      autoFilter: true,
    };

    const gapsData = options.curriculumGaps;
    const gapRows = [
      titleRow('CẢNH BÁO ĐỐI CHIẾU BẢNG ĐIỂM & CHƯƠNG TRÌNH KHUNG', 6),
      noteRow('Tiện ích chỉ cảnh báo và không tự động sửa dữ liệu bảng điểm hoặc Chương trình khung.', 6),
      tableRow(['Trạng thái CTK', options.curriculumStatus || 'UNSYNCED', 'Kết quả', gapsData?.summaryText || 'Chưa có dữ liệu đối chiếu', 'Số cảnh báo', gapsData?.gapCount ?? '']),
      headerRow(['Mức độ', 'Loại đối chiếu', 'Mã học phần', 'Tên học phần', 'Nội dung', 'Chi tiết']),
    ];
    (gapsData?.gaps || []).forEach(gap => {
      gapRows.push(tableRow([
        gap.severity || 'INFO', gap.type || '', gap.courseCode || '', gap.courseName || '',
        gap.message || '', gap.details || '',
      ]));
    });
    if (!gapsData?.gaps?.length) {
      const status = options.curriculumStatus === 'SYNCED' ? 'Không phát hiện bất nhất' : 'Chưa đồng bộ CTK; chưa thể kết luận không có bất nhất';
      gapRows.push(tableRow(['', '', '', status, gapsData?.summaryText || 'Chưa có dữ liệu đối chiếu', ''], 8));
    }
    const gapSheet = { name: 'Canh bao doi chieu', rows: gapRows, widths: [16, 30, 20, 40, 55, 65], freezeRows: 4, headerRow: 3, autoFilter: true };

    const sheets = [summarySheet, transcriptSheet, detailSheet, planSheet, targetSheet, forecastSheet, rescueSheet, gapSheet];
    const workbookSheets = sheets.map((sheet, index) =>
      `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    ).join('');
    const files = [
      { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets>${workbookSheets}</sheets></workbook>` },
      { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', content: workbookStylesXml() },
      ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: worksheetXml(sheet) })),
    ];
    return zipStoredFiles(files);
  }

  /**
   * Tạo Blob và kích hoạt download phía client an toàn
   * KHÔNG yêu cầu quyền chrome.downloads
   * Sử dụng URL.createObjectURL và giải phóng ngay bằng URL.revokeObjectURL
   *
   * @param {string} content
   * @param {string} fileName
   * @param {string} [mimeType='text/csv;charset=utf-8;']
   * @param {Document} [doc=document]
   * @returns {boolean} - true nếu thành công
   */
  static triggerDownload(content, fileName, mimeType = 'text/csv;charset=utf-8;', doc = (typeof document !== 'undefined' ? document : null)) {
    if (!doc || !doc.createElement) {
      return false;
    }

    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const a = doc.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;

      doc.body.appendChild(a);
      a.click();

      // Dọn dẹp DOM và giải phóng memory object URL
      setTimeout(() => {
        if (a.parentElement) {
          a.parentElement.removeChild(a);
        }
        URL.revokeObjectURL(url);
      }, 100);

      return true;
    } catch (e) {
      console.error('[IUH-GPA] EXPORT_DOWNLOAD_FAILED');
      return false;
    }
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ExportEngine,
      sanitizeSpreadsheetCell,
      escapeCSVField,
      generateSafeFileName,
      EXPORT_DISCLAIMER
    };
  }
  if (global) {
    const root = global.IUHGPA || (global.IUHGPA = Object.create(null));
    root.core = root.core || Object.create(null);
    root.core.ExportEngine = ExportEngine;
    root.core.sanitizeSpreadsheetCell = sanitizeSpreadsheetCell;
    root.core.escapeCSVField = escapeCSVField;
    root.core.generateSafeFileName = generateSafeFileName;
    root.core.EXPORT_DISCLAIMER = EXPORT_DISCLAIMER;
    global._IUHExportEngine = {
      ExportEngine,
      sanitizeSpreadsheetCell,
      escapeCSVField,
      generateSafeFileName,
      EXPORT_DISCLAIMER
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
