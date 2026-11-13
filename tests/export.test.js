const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ExportEngine,
  sanitizeSpreadsheetCell,
  escapeCSVField,
  generateSafeFileName,
  EXPORT_DISCLAIMER
} = require('../src/core/ExportEngine.js');

test('ExportEngine: sanitizeSpreadsheetCell - Giữ nguyên kiểu số và chuỗi an toàn', () => {
  assert.equal(sanitizeSpreadsheetCell(7.5), '7.5');
  assert.equal(sanitizeSpreadsheetCell(0), '0');
  assert.equal(sanitizeSpreadsheetCell(10.0), '10');
  assert.equal(sanitizeSpreadsheetCell('Tin học đại cương'), 'Tin học đại cương');
  assert.equal(sanitizeSpreadsheetCell('Toán cao cấp A1'), 'Toán cao cấp A1');
  assert.equal(sanitizeSpreadsheetCell(null), '');
  assert.equal(sanitizeSpreadsheetCell(undefined), '');
});

test('ExportEngine: Formula Injection - Ngăn chặn = + - @ \\t \\r kích hoạt công thức', () => {
  // Bắt đầu bằng dấu =
  assert.equal(sanitizeSpreadsheetCell('=1+1'), "'=1+1");
  assert.equal(sanitizeSpreadsheetCell('=cmd|"/C calc"!A0'), "'=cmd|\"/C calc\"!A0");

  // Bắt đầu bằng dấu +
  assert.equal(sanitizeSpreadsheetCell('+SUM(A1:A10)'), "'+SUM(A1:A10)");

  // Bắt đầu bằng dấu -
  assert.equal(sanitizeSpreadsheetCell('-1+1'), "'-1+1");

  // Bắt đầu bằng dấu @
  assert.equal(sanitizeSpreadsheetCell('@SUM(A1:A10)'), "'@SUM(A1:A10)");

  // Bắt đầu bằng tab \t hoặc CR \r
  assert.equal(sanitizeSpreadsheetCell('\t=1+1'), "'\t=1+1");
  assert.equal(sanitizeSpreadsheetCell('\r=1+1'), "'\r=1+1");
});

test('ExportEngine: escapeCSVField - RFC 4180 escaping (dấu phẩy, ngoặc kép, ký tự xuống dòng)', () => {
  // Không có ký tự đặc biệt
  assert.equal(escapeCSVField('Toán đại số'), 'Toán đại số');

  // Chứa dấu phẩy
  assert.equal(escapeCSVField('Lập trình, nâng cao'), '"Lập trình, nâng cao"');

  // Chứa dấu ngoặc kép (phải nhân đôi thành "")
  assert.equal(escapeCSVField('Lập trình "Web"'), '"Lập trình ""Web"""');

  // Chứa xuống dòng
  assert.equal(escapeCSVField("Dòng 1\nDòng 2"), "\"Dòng 1\nDòng 2\"");
  assert.equal(escapeCSVField("Dòng 1\r\nDòng 2"), "\"Dòng 1\r\nDòng 2\"");

  // Kết hợp dấu phẩy + ngoặc kép + formula trigger
  assert.equal(escapeCSVField('="A", "B"'), "\"'=\"\"A\"\", \"\"B\"\"\"");
});

test('ExportEngine: generateSafeFileName - Chuẩn hóa tên tệp không chứa ký tự độc hại', () => {
  const fixedDate = new Date(2026, 9, 4); // 2026-10-04
  const name1 = generateSafeFileName('IUH-GPA-Mo-Phong', 'csv', fixedDate);
  assert.equal(name1, 'IUH-GPA-Mo-Phong-2026-10-04.csv');

  // Sanitize path traversal / bad characters: / \ : * ? " < > |
  const unsafePrefix = '../../../etc/passwd<script>:*?';
  const name2 = generateSafeFileName(unsafePrefix, 'csv', fixedDate);
  assert.equal(name2.includes('..'), false);
  assert.equal(name2.includes('/'), false);
  assert.equal(name2.includes('\\'), false);
  assert.equal(name2.includes(':'), false);
  assert.equal(name2.includes('*'), false);
  assert.equal(name2.includes('?'), false);
  assert.equal(name2.includes('<'), false);
  assert.equal(name2.endsWith('-2026-10-04.csv'), true);
});

test('ExportEngine: generateCSV - Xuất CSV chuẩn UTF-8 BOM, phân tách gốc vs mô phỏng và không chứa PII', () => {
  const semesters = [
    {
      semesterKey: 'HK1',
      semesterName: 'Học kỳ 1 (2024 - 2025)',
      courses: [
        {
          id: 'c1',
          courseCode: '001122',
          courseName: 'Giải tích 1',
          credits: { status: 'ok', value: 3 },
          originalFinal: 6.0,
          simulatedFinal: 8.5,
          score10: 8.2,
          score4: 3.5,
          letter: 'B+',
          passed: true,
          officialResult: {
            total10: { status: 'ok', value: 6.8 },
          },
        },
        {
          id: 'c2',
          courseCode: '003344',
          courseName: 'Nhập môn lập trình, "C/C++"',
          credits: { status: 'ok', value: 4 },
          originalFinal: null, // Chưa có điểm cuối kỳ gốc
          simulatedFinal: 9.0,
          score10: 9.1,
          score4: 4.0,
          letter: 'A',
          passed: true,
          officialResult: null,
        },
        {
          id: 'c3',
          courseCode: '005566',
          courseName: '=HYPERLINK("http://evil.com")', // Malicious formula payload
          credits: { status: 'ok', value: 2 },
          originalFinal: 0.0, // Điểm số 0.0 được bảo toàn
          simulatedFinal: 0.0,
          score10: 0.0,
          score4: 0.0,
          letter: 'F',
          passed: false,
          officialResult: {
            total10: { status: 'ok', value: 0.0 },
          },
        },
      ],
    },
  ];

  const overallSummary = {
    original: { gpa4: 2.85, gpa10: 6.8 },
    simulated: { gpa4: 3.25, gpa10: 7.6 },
  };

  const csv = ExportEngine.generateCSV({
    semesters,
    scenarioName: 'Kịch bản mục tiêu A',
    overallSummary,
  });

  // 1. Phải bắt đầu bằng UTF-8 BOM (\uFEFF) cho Excel
  assert.equal(csv.charCodeAt(0), 0xFEFF);

  // 2. Chứa Disclaimer bắt buộc
  assert.ok(csv.includes(EXPORT_DISCLAIMER));

  // 3. Phân tách rõ ràng cột Điểm cuối kỳ gốc vs mô phỏng
  assert.ok(csv.includes('Điểm cuối kỳ gốc'));
  assert.ok(csv.includes('Điểm cuối kỳ mô phỏng'));
  assert.ok(csv.includes('Điểm tổng kết gốc'));
  assert.ok(csv.includes('Điểm tổng kết mô phỏng'));

  // 4. Kiểm tra dòng môn 1
  assert.ok(csv.includes('Giải tích 1'));
  assert.ok(csv.includes('6,8.5,6.8,8.2,3.5,B+,ĐẠT'));

  // 5. Kiểm tra escaping tên môn 2 (chứa dấu phẩy và ngoặc kép)
  assert.ok(csv.includes('"Nhập môn lập trình, ""C/C++"""'));

  // 6. Kiểm tra formula injection ở môn 3 được neutralize an toàn bằng dấu nháy đơn
  assert.ok(csv.includes("'=HYPERLINK"));

  // 7. Điểm 0.0 được bảo toàn
  assert.ok(csv.includes('0,0,0,0,0,F,RỚT'));

  // 8. Đảm bảo sử dụng CRLF \r\n
  assert.ok(csv.includes('\r\n'));
});

test('ExportEngine: generateXLSX creates a detailed multi-sheet Excel workbook without PII', () => {
  const workbook = ExportEngine.generateXLSX({
    scenarioName: 'Kịch bản kiểm thử',
    hasSimulations: true,
    semesters: [{
      semesterKey: 'HK1_2024_2025',
      semesterName: 'HK1 (2024 - 2025)',
      calculatedSimulatedGPA: { gpa10: 8.1, gpa4: 3.5, gradedCredits: 3 },
      courses: [{
        id: 'course-1',
        ordinal: 1,
        courseClassCode: 'CS101',
        courseName: 'Lập trình cơ bản',
        credits: 3,
        courseType: 'THEORY',
        assessments: {
          midterm: { status: 'ok', value: 7 },
          regular: [{ slot: 1, value: { status: 'ok', value: 8 } }],
          practice: [],
          finalExam: { status: 'ok', value: 8 },
        },
        originalFinal: 8,
        simulatedFinal: 9,
        originalScore10: 7.8,
        score10: 8.5,
        originalScore4: 3.0,
        score4: 3.5,
        letter: 'B+',
        classification: 'Khá',
        passed: true,
        included: true,
        isSimulated: true,
        simulatedMidterm: 8,
        simulatedRegular: [{ slot: 1, value: 9 }],
      }, {
        id: 'formula-course',
        courseName: '=SUM(1,1)',
        credits: 0,
        isExcludedFromGpa: true,
      }],
    }],
    futurePlan: {
      semesters: [{
        label: 'HK2 (2025 - 2026)',
        courses: [{
          curriculumCourseCode: 'THESIS',
          courseName: 'Khóa luận tốt nghiệp',
          credits: 8,
          courseTypeOverride: 'SPECIAL',
          scores: { final: 8 },
          score10Raw: 8,
          score4Raw: 3.5,
          letter: 'B+',
          isPassed: true,
          included: true,
        }],
      }],
    },
    overallSummary: {
      original: { gpa10: 7.8, gpa10Raw: 7.8, gpa4: 3, gpa4Raw: 3, gradedCredits: 3, earnedCredits: 3, totalCredits: 3 },
      simulated: { gpa10: 8.5, gpa10Raw: 8.5, gpa4: 3.5, gpa4Raw: 3.5, sumWeighted4: 10.5, gradedCredits: 3, earnedCredits: 3, totalCredits: 3 },
    },
    allSimulatedCourses: [{
      id: 'course-1',
      courseCode: 'CS101',
      courseName: 'Lập trình cơ bản',
      credits: 3,
      score4: 3.5,
      gradeLetter: 'B+',
      countsTowardGPA: true,
    }],
    curriculumStatus: 'SYNCED',
    curriculumGaps: {
      hasGaps: true,
      gapCount: 1,
      summaryText: '1 vấn đề cần kiểm tra',
      gaps: [{
        severity: 'WARNING',
        type: 'CREDITS_MISMATCH',
        courseCode: 'CS101',
        courseName: 'Lập trình cơ bản',
        message: 'Số tín chỉ khác nhau',
        details: 'Bảng điểm 3 TC; CTK 4 TC',
      }],
    },
    analysis: {
      targetGPA: 3.4,
      remainingCredits: 30,
      remainingCreditsSource: 'Chương trình khung IUH',
      forecastFutureAverage: 3,
      rescueTargetLetter: 'A',
    },
  });

  assert.ok(workbook instanceof Uint8Array);
  assert.equal(new DataView(workbook.buffer).getUint32(0, true), 0x04034B50, 'XLSX must be a ZIP archive');

  const files = new Map();
  const decoder = new TextDecoder();
  let offset = 0;
  while (new DataView(workbook.buffer).getUint32(offset, true) === 0x04034B50) {
    const view = new DataView(workbook.buffer, offset);
    const compressedSize = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const fileName = decoder.decode(workbook.subarray(nameStart, nameStart + nameLength));
    files.set(fileName, decoder.decode(workbook.subarray(dataStart, dataStart + compressedSize)));
    offset = dataStart + compressedSize;
  }

  assert.ok(files.has('[Content_Types].xml'));
  assert.ok(files.has('xl/workbook.xml'));
  assert.equal(files.size, 13, 'Workbook should contain core XML and 8 worksheets');
  const workbookXml = files.get('xl/workbook.xml');
  for (const sheetName of ['Tong quan', 'Phu luc diem', 'Chi tiet diem', 'Ke hoach', 'Muc tieu GPA', 'Du bao', 'Cai thien GPA', 'Canh bao doi chieu']) {
    assert.ok(workbookXml.includes(`name="${sheetName}"`), `Workbook must include ${sheetName}`);
  }
  const transcript = files.get('xl/worksheets/sheet2.xml');
  const details = files.get('xl/worksheets/sheet3.xml');
  const plan = files.get('xl/worksheets/sheet4.xml');
  const target = files.get('xl/worksheets/sheet5.xml');
  const improvement = files.get('xl/worksheets/sheet7.xml');
  const gaps = files.get('xl/worksheets/sheet8.xml');
  assert.ok(transcript.includes('PHỤ LỤC KẾT QUẢ HỌC TẬP'));
  assert.ok(transcript.includes('Lập trình cơ bản'));
  assert.ok(details.includes('Giữa kỳ mô phỏng'));
  assert.ok(details.includes('TX1 mô phỏng'));
  assert.ok(plan.includes('Khóa luận tốt nghiệp'));
  assert.ok(target.includes('GPA trung bình cần đạt'));
  assert.ok(improvement.includes('Tăng điểm quy đổi'));
  assert.ok(gaps.includes('CREDITS_MISMATCH'));
  assert.equal([...files.values()].some(xml => /studentName|studentId|dateOfBirth/i.test(xml)), false);
  assert.ok(transcript.includes('&apos;=SUM(1,1)'), 'Spreadsheet formula-like course text must be stored as literal text');
  assert.equal(transcript.includes('<f>'), false, 'Workbook cells must not contain executable formulas');
});

test('ExportEngine: triggerDownload - An toàn DOM Blob URL creation & cleanup', () => {
  let createdUrl = null;
  let revokedUrl = null;
  let clicked = false;

  // Mock document và URL
  const mockDoc = {
    body: {
      appendChild: (el) => {
        el.parentElement = mockDoc.body;
      },
      removeChild: (el) => {
        el.parentElement = null;
      },
    },
    createElement: (tag) => {
      if (tag === 'a') {
        return {
          style: {},
          click: () => { clicked = true; },
          parentElement: null,
        };
      }
      return {};
    },
  };

  const originalURL = global.URL;
  global.URL = {
    createObjectURL: (blob) => {
      createdUrl = 'blob:test-export-id';
      return createdUrl;
    },
    revokeObjectURL: (url) => {
      revokedUrl = url;
    },
  };

  try {
    const success = ExportEngine.triggerDownload('test,content', 'test.csv', 'text/csv', mockDoc);
    assert.equal(success, true);
    assert.equal(clicked, true);
    assert.equal(createdUrl, 'blob:test-export-id');
  } finally {
    global.URL = originalURL;
  }
});
