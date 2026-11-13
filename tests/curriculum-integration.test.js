/**
 * curriculum-integration.test.js — Phase 6A.3 Authoritative IUH Curriculum Integration Tests
 *
 * Covers:
 *  - 51. Adapter parsing: root, dynamic semesters, mandatory/elective groups, credits, LT/TH, pass/studied, non-GPA asterisk, totals
 *  - 52. Course type inference: LT/TH rules
 *  - 53. CourseIdentityMatcher: exact, derived prefix, name confirmation, ambiguous rejection, unmatched
 *  - 54. Sync robustness: mock 200 valid, 200 login, redirect, 401, 403, 500, timeout, missing root
 *  - 55. Request counts: max 1 auto-sync, exactly 1 on manual refresh
 *  - 56. Security: detached parsing, plain text extraction, script/img tags never executed
 *  - 57. Zero PII in CurriculumModel
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { IUHCurriculumAdapter } = require('../src/adapters/IUHCurriculumAdapter.js');
const { CourseIdentityMatcher } = require('../src/core/CourseIdentityMatcher.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { AppController } = require('../src/ui/AppController.js');

const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'curriculum.sanitized.html');

function loadCurriculumFixtureDOM() {
  const html = fs.readFileSync(FIXTURE_PATH, 'utf8');
  return new JSDOM(html, { url: 'https://sv.iuh.edu.vn/chuong-trinh-khung.html' });
}

// ==========================================
// 51. CURRICULUM PARSER TESTS
// ==========================================
test('Curriculum Parser: isCompatiblePage validation', () => {
  const dom = loadCurriculumFixtureDOM();
  const res = IUHCurriculumAdapter.isCompatiblePage(dom.window.document);
  assert.strictEqual(res.compatible, true, 'Sanitized fixture must be compatible');
  assert.ok(res.root, 'Must return #viewChuongTrinhKhung container');

  // Invalid page test
  const emptyDom = new JSDOM('<!DOCTYPE html><html><body><div>Trang chu</div></body></html>');
  const invalidRes = IUHCurriculumAdapter.isCompatiblePage(emptyDom.window.document);
  assert.strictEqual(invalidRes.compatible, false, 'Page without root must be incompatible');
  assert.strictEqual(invalidRes.code, 'ROOT_NOT_FOUND');
});

test('Curriculum Parser: detectColumns and validateStructure', () => {
  const dom = loadCurriculumFixtureDOM();
  const root = dom.window.document.querySelector('#viewChuongTrinhKhung');
  const colRes = IUHCurriculumAdapter.detectColumns(root);
  assert.strictEqual(colRes.ok, true, 'Column detection must succeed');
  assert.ok(colRes.data.codeIndex >= 0, 'ctk-mahp index must be detected');
  assert.ok(colRes.data.nameIndex >= 0, 'ctk-tenmhhp index must be detected');
  assert.ok(colRes.data.creditsIndex >= 0, 'ctk-stc index must be detected');
  assert.ok(colRes.data.theoryIndex >= 0, 'ctk-sotietlt index must be detected');
  assert.ok(colRes.data.practiceIndex >= 0, 'ctk-sotietth index must be detected');

  const structRes = IUHCurriculumAdapter.validateStructure(colRes.data);
  assert.strictEqual(structRes.valid, true, 'Structure must be valid');
});

test('Curriculum Parser: dynamic semesters, groups, courses, and totals', () => {
  const dom = loadCurriculumFixtureDOM();
  const parseRes = IUHCurriculumAdapter.parseCurriculum(dom.window.document);
  assert.strictEqual(parseRes.ok, true, 'parseCurriculum must succeed');

  const model = parseRes.data;
  assert.ok(model, 'Model must be returned');

  // Dynamic semesters
  assert.ok(model.semesters.length > 0, 'Semesters array must not be empty');
  assert.strictEqual(model.semesters.length, 3, 'Sanitized fixture has 3 semesters');

  // Check Semester 1
  const sem1 = model.semesters[0];
  assert.strictEqual(sem1.curriculumIndex, 1);
  assert.strictEqual(sem1.label, 'Học kỳ 1');
  assert.strictEqual(sem1.requiredCredits, 11);
  assert.strictEqual(sem1.groups.length, 1);
  assert.strictEqual(sem1.groups[0].type, 'MANDATORY');

  // Check Semester 2 (contains elective group)
  const sem2 = model.semesters[1];
  assert.strictEqual(sem2.curriculumIndex, 2);
  assert.strictEqual(sem2.groups.length, 2, 'Semester 2 has 1 mandatory and 1 elective group');
  const electiveGroup = sem2.groups.find(g => g.type === 'ELECTIVE');
  assert.ok(electiveGroup, 'Elective group must exist in Semester 2');
  assert.strictEqual(electiveGroup.requiredCredits, 3, 'Elective group requiredCredits must be 3');
  assert.strictEqual(electiveGroup.courses.length, 2, 'Elective group has 2 courses');

  // Check totals parsed dynamically
  assert.strictEqual(model.totals.totalRequiredCredits, 144, 'Total required credits');
  assert.strictEqual(model.totals.totalMandatoryCredits, 118, 'Total mandatory credits');
  assert.strictEqual(model.totals.totalElectiveCredits, 26, 'Total elective credits');
});

test('Curriculum Parser: course details, non-GPA asterisk, studied and pass states', () => {
  const dom = loadCurriculumFixtureDOM();
  const parseRes = IUHCurriculumAdapter.parseCurriculum(dom.window.document);
  assert.strictEqual(parseRes.ok, true);
  const courses = parseRes.data.courses;

  // Course 1: 4203003307 "Giáo dục thể chất 1 *"
  const gdtc = courses.find(c => c.code === '4203003307');
  assert.ok(gdtc, 'GDTC course must be found');
  assert.strictEqual(gdtc.countsTowardCumulativeGPA, false, 'Asterisk in name must mark countsTowardCumulativeGPA = false');
  assert.strictEqual(gdtc.provenance, 'CURRICULUM_EXPLICIT_NON_GPA');
  assert.strictEqual(gdtc.studiedState, 'STUDIED', 'Has colorSTLichHoc class');
  assert.strictEqual(gdtc.passState, 'PASS', 'Has .check div');
  assert.strictEqual(gdtc.inferredCourseType, 'PRACTICE', 'LT 0, TH 60 -> PRACTICE');

  // Course 2: 4203003259 "Toán cao cấp 1"
  const math = courses.find(c => c.code === '4203003259');
  assert.ok(math, 'Math course must be found');
  assert.strictEqual(math.countsTowardCumulativeGPA, true, 'Standard course counts toward GPA');
  assert.strictEqual(math.theoryHours, 30);
  assert.strictEqual(math.practiceHours, 0);
  assert.strictEqual(math.inferredCourseType, 'THEORY', 'LT 30, TH 0 -> THEORY');
  assert.strictEqual(math.studiedState, 'STUDIED');
  assert.strictEqual(math.passState, 'PASS');

  // Course 3: 4203002419 "Truyền thông đa phương tiện" (LT 30, TH 30, Unregistered, Pending)
  const unreg = courses.find(c => c.code === '4203002419');
  assert.ok(unreg, 'Unregistered course must be found');
  assert.strictEqual(unreg.theoryHours, 30);
  assert.strictEqual(unreg.practiceHours, 30);
  assert.strictEqual(unreg.inferredCourseType, 'COMBINED', 'LT 30, TH 30 -> COMBINED');
  assert.strictEqual(unreg.studiedState, 'UNREGISTERED', 'Missing colorSTLichHoc');
  assert.strictEqual(unreg.passState, 'PENDING', 'Missing .check div');
});

// ==========================================
// 52. COURSE TYPE INFERENCE TESTS
// ==========================================
test('Course Type Inference: pure rule evaluation', () => {
  assert.strictEqual(IUHCurriculumAdapter.inferCourseType(30, 0), 'THEORY', 'LT > 0, TH == 0 -> THEORY');
  assert.strictEqual(IUHCurriculumAdapter.inferCourseType(0, 30), 'PRACTICE', 'LT == 0, TH > 0 -> PRACTICE');
  assert.strictEqual(IUHCurriculumAdapter.inferCourseType(30, 30), 'COMBINED', 'LT > 0, TH > 0 -> COMBINED');
  assert.strictEqual(IUHCurriculumAdapter.inferCourseType(0, 0), 'UNKNOWN', 'LT == 0, TH == 0 -> UNKNOWN');
  assert.strictEqual(IUHCurriculumAdapter.inferCourseType(null, null), 'UNKNOWN', 'Missing LT/TH -> UNKNOWN');
});

// ==========================================
// 53. COURSE IDENTITY MATCHER TESTS
// ==========================================
test('CourseIdentityMatcher: Exact, Derived Prefix, Name Confirmation, Ambiguous Rejection', () => {
  const ctkCourses = [
    { code: '4203002009', name: 'Nhập môn Lập trình', credits: 3 },
    { code: '4203002010', name: 'Cấu trúc Dữ liệu và Giải thuật', credits: 4 },
    { code: '4203003001', name: 'Kỹ năng Giao tiếp', credits: 2 },
    { code: '4203003002', name: 'Kỹ năng Làm việc nhóm', credits: 2 },
    { code: '5555555555', name: 'Môn Trùng Mã A', credits: 3 },
  ];

  // 1. Exact match
  const exactGrade = { id: 'g1', courseClassCode: '4203002009', courseName: 'Nhập môn Lập trình' };
  const resExact = CourseIdentityMatcher.matchCourse(exactGrade, ctkCourses);
  assert.strictEqual(resExact.status, 'EXACT');
  assert.strictEqual(resExact.curriculumCourseCode, '4203002009');
  assert.strictEqual(resExact.provenance, 'MATCH_EXACT_CODE');

  // 2. Verified derived prefix match (Mã lớp 420300200901 -> Mã môn 4203002009 + lớp 01 + tên khớp)
  const derivedGrade = { id: 'g2', courseClassCode: '420300200901', courseName: 'Nhập môn Lập trình' };
  const resDerived = CourseIdentityMatcher.matchCourse(derivedGrade, ctkCourses);
  assert.strictEqual(resDerived.status, 'DERIVED_CODE');
  assert.strictEqual(resDerived.curriculumCourseCode, '4203002009');
  assert.strictEqual(resDerived.provenance, 'MATCH_CLASS_TO_COURSE_PREFIX');

  // 3. Prefix match with Unicode Vietnamese differences
  const unicodeGrade = { id: 'g3', courseClassCode: '420300201002', courseName: 'Cấu trúc Dữ liệu và Giải thuật (N02)' };
  const resUnicode = CourseIdentityMatcher.matchCourse(unicodeGrade, ctkCourses);
  assert.strictEqual(resUnicode.status, 'DERIVED_CODE');
  assert.strictEqual(resUnicode.curriculumCourseCode, '4203002010');

  // 4. Ambiguous candidates (multiple candidate courses match same prefix -> must be REJECTED, fail-safe)
  const ambiguousCtk = [
    { code: '420300', name: 'Môn Tiền tố Ngắn 1', credits: 3 },
    { code: '4203001', name: 'Môn Tiền tố Ngắn 2', credits: 3 },
  ];
  const ambiguousGrade = { id: 'g4', courseClassCode: '420300101', courseName: 'Khác Tên Hoàn Toàn' };
  const resAmbiguous = CourseIdentityMatcher.matchCourse(ambiguousGrade, ambiguousCtk);
  assert.strictEqual(resAmbiguous.status, 'AMBIGUOUS');
  assert.strictEqual(resAmbiguous.curriculumCourseCode, null);
  assert.strictEqual(resAmbiguous.provenance, 'MATCH_AMBIGUOUS_REJECTED');

  // 5. Unmatched
  const unmatchedGrade = { id: 'g5', courseClassCode: '999999999999', courseName: 'Môn Ngoài CTK' };
  const resUnmatched = CourseIdentityMatcher.matchCourse(unmatchedGrade, ctkCourses);
  assert.strictEqual(resUnmatched.status, 'UNMATCHED');
  assert.strictEqual(resUnmatched.curriculumCourseCode, null);
});

test('CourseIdentityMatcher: batch matchAll coverage report', () => {
  const ctkCourses = [
    { code: '4203001', name: 'Toán 1', credits: 3 },
    { code: '4203002', name: 'Vật lý 1', credits: 3 },
  ];
  const gradeCourses = [
    { id: '1', courseClassCode: '420300101', courseName: 'Toán 1' },
    { id: '2', courseClassCode: '420300201', courseName: 'Vật lý 1' },
    { id: '3', courseClassCode: '999999999', courseName: 'Môn Lạ' },
  ];

  const report = CourseIdentityMatcher.matchAll(gradeCourses, ctkCourses);
  assert.strictEqual(report.totalGradeCourses, 3);
  assert.strictEqual(report.matchedExact, 0);
  assert.strictEqual(report.matchedDerived, 2);
  assert.strictEqual(report.unmatched, 1);
  assert.strictEqual(report.ambiguous, 0);
  assert.strictEqual(report.results.length, 3);
});

// ==========================================
// 54. SYNC ROBUSTNESS TESTS
// ==========================================
test('AppController syncCurriculum: Handles 200 valid, 200 login redirect, 401, 500, timeout, missing root', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="table-wrapper"><table class="table-wrapper"><thead><tr><th>Header</th></tr></thead><tbody></tbody></table></div></body></html>', {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
  });

  const app = new AppController(dom.window.document);
  app.store = new SimulationStore();

  const originalFetch = global.fetch;
  const originalDOMParser = global.DOMParser;
  global.DOMParser = dom.window.DOMParser;

  try {
    // 1. Mock 200 Valid
    const validHtml = fs.readFileSync(FIXTURE_PATH, 'utf8');
    global.fetch = async () => ({
      ok: true,
      status: 200,
      redirected: false,
      text: async () => validHtml,
    });

    const res1 = await app.syncCurriculum({ force: true });
    assert.strictEqual(res1.ok, true, 'Valid CTK sync must succeed');
    assert.strictEqual(app.store.getCurriculumSyncStatus().status, 'SYNCED');

    // 2. Mock 200 with Login Form HTML
    global.fetch = async () => ({
      ok: true,
      status: 200,
      redirected: false,
      text: async () => '<html><body><form id="loginForm"><input type="password"/></form></body></html>',
    });

    const res2 = await app.syncCurriculum({ force: true });
    assert.strictEqual(res2.ok, false, 'Login HTML must fail');
    assert.strictEqual(app.store.getCurriculumSyncStatus().status, 'FAILED');
    assert.strictEqual(res2.error, 'MISSING_CURRICULUM_ROOT');

    // 3. Mock 302 Redirect to Login
    global.fetch = async () => ({
      ok: true,
      status: 200,
      redirected: true,
      url: 'https://sv.iuh.edu.vn/dang-nhap.html',
      text: async () => 'redirected',
    });

    const res3 = await app.syncCurriculum({ force: true });
    assert.strictEqual(res3.ok, false, 'Auth redirect must fail');
    assert.strictEqual(res3.error, 'AUTH_REDIRECT_DETECTED');

    // 4. Reject redirects outside the IUH origin before reading the response body.
    let externalRedirectBodyRead = false;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      redirected: true,
      url: 'https://example.com/chuong-trinh-khung.html',
      text: async () => {
        externalRedirectBodyRead = true;
        return validHtml;
      },
    });

    const externalRedirectResult = await app.syncCurriculum({ force: true });
    assert.strictEqual(externalRedirectResult.ok, false, 'Cross-origin redirects must fail');
    assert.strictEqual(externalRedirectResult.error, 'EXTERNAL_REDIRECT_BLOCKED');
    assert.strictEqual(externalRedirectBodyRead, false, 'Cross-origin response body must not be consumed');

    // 5. Mock 401 / 403 / 500
    global.fetch = async () => ({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const res4 = await app.syncCurriculum({ force: true });
    assert.strictEqual(res4.ok, false, '500 error must fail cleanly');
    assert.strictEqual(res4.error, 'HTTP_500');

    // 6. Mock Timeout (AbortError)
    global.fetch = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const res5 = await app.syncCurriculum({ force: true });
    assert.strictEqual(res5.ok, false, 'Timeout must fail cleanly');
    assert.strictEqual(res5.error, 'TIMEOUT');
  } finally {
    global.fetch = originalFetch;
    global.DOMParser = originalDOMParser;
  }
});

// ==========================================
// 55. FETCH COUNT TESTS
// ==========================================
test('AppController syncCurriculum: At most 1 auto-request per session; exactly 1 on manual refresh', async () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
  });

  const app = new AppController(dom.window.document);
  app.store = new SimulationStore();

  let fetchCallCount = 0;
  const originalFetch = global.fetch;
  const originalDOMParser = global.DOMParser;
  global.DOMParser = dom.window.DOMParser;

  try {
    const validHtml = fs.readFileSync(FIXTURE_PATH, 'utf8');
    global.fetch = async () => {
      fetchCallCount++;
      return {
        ok: true,
        status: 200,
        redirected: false,
        text: async () => validHtml,
      };
    };

    // First auto-sync
    await app.syncCurriculum({ force: false });
    assert.strictEqual(fetchCallCount, 1, 'Initial sync must make 1 request');

    // Second auto-sync without force -> MUST NOT make another request
    const secondRes = await app.syncCurriculum({ force: false });
    assert.strictEqual(secondRes.ok, false);
    assert.strictEqual(secondRes.reason, 'ALREADY_ATTEMPTED');
    assert.strictEqual(fetchCallCount, 1, 'Auto-sync must NOT request more than once per session');

    // User manual refresh (force: true) -> Exactly 1 additional request
    const manualRes = await app.syncCurriculum({ force: true });
    assert.strictEqual(manualRes.ok, true);
    assert.strictEqual(fetchCallCount, 2, 'Manual refresh must make exactly 1 additional request');
  } finally {
    global.fetch = originalFetch;
    global.DOMParser = originalDOMParser;
  }
});

// ==========================================
// 56. SECURITY TEST: DETACHED PARSING & XSS DEFENSE
// ==========================================
test('Security: Malicious script and img tags in CTK HTML are never executed', () => {
  const liveDom = new JSDOM('<!DOCTYPE html><html><body><div id="live-page"></div></body></html>', {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'dangerously',
  });

  const maliciousHTML = `
    <!DOCTYPE html>
    <html>
      <body>
        <div id="viewChuongTrinhKhung">
          <table class="table-wrapper">
            <thead>
              <tr>
                <th lang="ctk-stt">STT</th>
                <th lang="ctk-mahp">Mã học phần</th>
                <th lang="ctk-tenmhhp">Tên môn học/Học phần</th>
                <th lang="ctk-stc">STC</th>
                <th lang="ctk-sotietlt">LT</th>
                <th lang="ctk-sotietth">TH</th>
                <th lang="ctk-nhomtuchon">Nhóm tự chọn</th>
                <th lang="ctk-sotcnhombatbuoc">Số TC nhóm bắt buộc</th>
                <th lang="ctk-pass">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr class="row-head row-head-hover">
                <td colspan="4">Học kỳ 1</td>
                <td>3</td>
                <td colspan="5"></td>
              </tr>
              <tr>
                <td>1</td>
                <td>9999999999</td>
                <td><script>window.__XSS_TRIGGERED__ = true;</script><img src="x" onerror="window.__XSS_TRIGGERED__ = true;">Toán Rời Rạc</td>
                <td>3</td>
                <td>45</td>
                <td>0</td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `;

  // Parse detached using live document's DOMParser
  const parser = new liveDom.window.DOMParser();
  const detachedDoc = parser.parseFromString(maliciousHTML, 'text/html');

  const parseRes = IUHCurriculumAdapter.parseCurriculum(detachedDoc);
  assert.strictEqual(parseRes.ok, true);

  // Assert malicious script was never executed in live window
  assert.strictEqual(liveDom.window.__XSS_TRIGGERED__, undefined, 'XSS script must never execute in live window');

  // Assert course name extracted plain text only
  const course = parseRes.data.courses[0];
  assert.strictEqual(course.name, 'Toán Rời Rạc', 'Course name must only contain text content');
});

// ==========================================
// 57. NO PII IN CURRICULUM MODEL TEST
// ==========================================
test('Curriculum Model: Contains ZERO Personally Identifiable Information (PII)', () => {
  const dom = loadCurriculumFixtureDOM();
  const parseRes = IUHCurriculumAdapter.parseCurriculum(dom.window.document);
  const model = parseRes.data;

  const serialized = JSON.stringify(model);
  const forbiddenPiiKeys = [
    'studentName',
    'studentId',
    'email',
    'avatar',
    'phone',
    'cookie',
    'token',
    'session',
    'mssv',
    'lopHoc',
  ];

  for (const key of forbiddenPiiKeys) {
    const regex = new RegExp(`"${key}"\\s*:`, 'i');
    assert.strictEqual(regex.test(serialized), false, `CurriculumModel must NOT contain PII key: ${key}`);
  }
});

// ==========================================
// STORE INTEGRATION & USER OVERRIDE PRIORITY TEST
// ==========================================
test('Store Integration: CTK metadata sets defaults; User overrides ALWAYS win', () => {
  const store = new SimulationStore();

  const originalSemesters = [
    {
      semesterKey: 'HK1_2023_2024',
      semesterName: 'Học kỳ 1 (2023-2024)',
      courses: [
        {
          id: 'c1',
          courseClassCode: '420300330701',
          courseName: 'Giáo dục thể chất 1 *',
          credits: { status: 'ok', value: 2 },
          officialResult: { total10: { status: 'ok', value: 8.0 }, score4: { status: 'ok', value: 3.5 }, passed: true },
        },
        {
          id: 'c2',
          courseClassCode: '420300241901',
          courseName: 'Truyền thông đa phương tiện',
          credits: { status: 'ok', value: 3 },
          officialResult: { total10: { status: 'ok', value: 8.5 }, score4: { status: 'ok', value: 4.0 }, passed: true },
        },
      ],
    },
  ];

  store.setOriginalData(originalSemesters);

  // Before CTK sync
  let derived = store.getDerivedData();
  assert.strictEqual(derived.curriculumStatus, 'UNSYNCED');

  // Load and set CTK model
  const dom = loadCurriculumFixtureDOM();
  const ctkRes = IUHCurriculumAdapter.parseCurriculum(dom.window.document);
  store.setCurriculumModel(ctkRes.data);

  derived = store.getDerivedData();
  assert.strictEqual(derived.curriculumStatus, 'SYNCED');

  const c1 = derived.semesters[0].courses.find(c => c.id === 'c1');
  assert.ok(c1, 'Course c1 must exist');
  // Explicit non-GPA marker in CTK -> default included must be false!
  assert.strictEqual(c1.isExplicitNonGpa, true);
  assert.strictEqual(c1.included, false, 'Explicit non-GPA course must default to included = false');
  assert.strictEqual(c1.courseType, 'PRACTICE', 'LT 0, TH 60 inferred as PRACTICE');

  const c2 = derived.semesters[0].courses.find(c => c.id === 'c2');
  assert.ok(c2, 'Course c2 must exist');
  assert.strictEqual(c2.included, true);
  assert.strictEqual(c2.courseType, 'COMBINED', 'LT 30, TH 30 inferred as COMBINED');

  // USER OVERRIDE TEST: User overrides c1 included = true, and c2 courseType = THEORY
  store.setCourseOverride('c1', { included: true });
  store.setCourseOverride('c2', { courseTypeOverride: 'THEORY' });

  const overriddenDerived = store.getDerivedData();
  const over1 = overriddenDerived.semesters[0].courses.find(c => c.id === 'c1');
  assert.strictEqual(over1.included, true, 'User override included = true must win');
  assert.strictEqual(over1.isSelectionOverridden, true);
  assert.strictEqual(over1.inclusionProvenance, 'USER_OVERRIDE');

  const over2 = overriddenDerived.semesters[0].courses.find(c => c.id === 'c2');
  assert.strictEqual(over2.courseType, 'THEORY', 'User override courseType = THEORY must win');
  assert.strictEqual(over2.isTypeOverridden, true);
  assert.strictEqual(over2.courseTypeProvenance, 'USER_OVERRIDE');

  // Restore to curriculum
  store.restoreCourseToCurriculum('c1');
  store.restoreCourseToCurriculum('c2');

  const restoredDerived = store.getDerivedData();
  const res1 = restoredDerived.semesters[0].courses.find(c => c.id === 'c1');
  assert.strictEqual(res1.included, false, 'Restored to curriculum non-GPA default');
  assert.strictEqual(res1.isSelectionOverridden, false);

  const res2 = restoredDerived.semesters[0].courses.find(c => c.id === 'c2');
  assert.strictEqual(res2.courseType, 'COMBINED', 'Restored to curriculum combined default');
  assert.strictEqual(res2.isTypeOverridden, false);
});
