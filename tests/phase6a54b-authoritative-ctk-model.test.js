const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { IUHCurriculumAdapter } = require('../src/adapters/IUHCurriculumAdapter.js');
const { CurriculumProgressEngine, ELECTIVE_STATUS } = require('../src/core/CurriculumProgressEngine.js');
const { FutureSemesterEngine } = require('../src/core/FutureSemesterEngine.js');
const { GPARescueEngine } = require('../src/core/GPARescueEngine.js');
const { CompanionBar } = require('../src/ui/CompanionBar.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');

test('Phase 6A.5.4B: 1. CTK Parser against Real Snapshot (Section 41)', () => {
  const ctkHtmlPath = path.resolve(__dirname, '../Chương trình khung.html');
  assert.ok(fs.existsSync(ctkHtmlPath), 'Chương trình khung.html must exist');

  const html = fs.readFileSync(ctkHtmlPath, 'utf8');
  const dom = new JSDOM(html);
  const parseRes = IUHCurriculumAdapter.parseCurriculum(dom.window.document);

  assert.ok(parseRes.ok, 'Parser must succeed on real CTK HTML snapshot');
  const model = parseRes.data;

  // Assertions from Section 41
  assert.equal(model.totals.totalRequiredCredits, 144, 'Total required credits must be 144');
  assert.equal(model.totals.totalMandatoryCredits, 118, 'Total mandatory credits must be 118');
  assert.equal(model.totals.totalElectiveCredits, 26, 'Total elective credits must be 26');

  assert.equal(model.semesters.length, 9, 'Must parse 9 semesters');
  model.semesters.forEach(s => {
    assert.ok(s.label && !s.label.includes('undefined'), `Semester label must be valid: ${s.label}`);
    assert.ok(typeof s.curriculumIndex === 'number', 'curriculumIndex must be number');
  });

  assert.equal(model.electiveGroups.length, 7, 'Must parse 7 elective groups');
  model.electiveGroups.forEach(g => {
    assert.ok(g.id && typeof g.id === 'string' && !g.id.includes('undefined'), `Group ID must be valid: ${g.id}`);
    assert.ok(g.name && !g.name.includes('undefined'), `Group name must not contain undefined: ${g.name}`);
    assert.ok(Number.isFinite(g.requiredCredits) && g.requiredCredits > 0, `requiredCredits must be positive finite: ${g.requiredCredits}`);
  });

  assert.equal(model.courses.length, 83, 'Must parse exactly 83 courses');

  const nonGpa = model.courses.filter(c => c.countsTowardCumulativeGPA === false || c.hasAsterisk);
  assert.equal(nonGpa.length, 7, 'Must detect 7 non-GPA courses (GDTC, GDQP, Tiếng Anh, etc.)');
  nonGpa.forEach(c => {
    assert.equal(c.countsTowardCumulativeGPA, false, `Course ${c.name} must have countsTowardCumulativeGPA: false`);
  });
});

test('Phase 6A.5.4B: 2. Course Match Deduplication (Section 42)', () => {
  const mockCurriculum = {
    requiredCredits: 6,
    mandatoryCredits: 6,
    electiveCredits: 0,
    totals: { totalRequiredCredits: 6, totalMandatoryCredits: 6, totalElectiveCredits: 0 },
    courses: [
      {
        code: 'CS101',
        curriculumCourseCode: 'CS101',
        name: 'Nhập môn lập trình',
        credits: 3,
        requirementType: 'MANDATORY',
        countsTowardCumulativeGPA: true
      },
      {
        code: 'CS102',
        curriculumCourseCode: 'CS102',
        name: 'Toán rời rạc',
        credits: 3,
        requirementType: 'MANDATORY',
        countsTowardCumulativeGPA: true
      }
    ],
    electiveGroups: []
  };

  // Student attempted CS101 in Sem 1 (Fail) and retook in Sem 2 (Pass) and Sem 3 (Pass again)
  const transcriptAttempts = [
    { courseCode: 'CS101', score10: 2.0, score4: 0.0, letter: 'F', passed: false },
    { courseCode: 'CS101', score10: 7.0, score4: 3.0, letter: 'B', passed: true },
    { courseCode: 'CS101', score10: 8.5, score4: 3.5, letter: 'A', passed: true },
  ];

  const progress = CurriculumProgressEngine.calculateProgress(mockCurriculum, transcriptAttempts);

  // CS101 should only be counted ONCE towards curriculum completion
  assert.equal(progress.curriculumCompletedCredits, 3, 'CS101 retakes must only count once (3 TC)');
  assert.equal(progress.mandatory.completedCredits, 3);
  assert.equal(progress.curriculumRemainingCredits, 3);
});

test('Phase 6A.5.4B: 3. Elective Group Capping (Section 43)', () => {
  const mockCurriculum = {
    requiredCredits: 3,
    mandatoryCredits: 0,
    electiveCredits: 3,
    totals: { totalRequiredCredits: 3, totalMandatoryCredits: 0, totalElectiveCredits: 3 },
    courses: [
      { code: 'ELEC1', curriculumCourseCode: 'ELEC1', name: 'Tự chọn 1', credits: 3, requirementType: 'ELECTIVE', electiveGroupId: 'grp1', electiveGroupRequiredCredits: 3 },
      { code: 'ELEC2', curriculumCourseCode: 'ELEC2', name: 'Tự chọn 2', credits: 3, requirementType: 'ELECTIVE', electiveGroupId: 'grp1', electiveGroupRequiredCredits: 3 },
      { code: 'ELEC3', curriculumCourseCode: 'ELEC3', name: 'Tự chọn 3', credits: 3, requirementType: 'ELECTIVE', electiveGroupId: 'grp1', electiveGroupRequiredCredits: 3 },
    ],
    electiveGroups: [
      { id: 'grp1', name: 'Nhóm tự chọn chuyên đề', requiredCredits: 3, courses: [] }
    ]
  };

  // Student passed all 3 courses in the group (9 raw credits, required 3)
  const grades = [
    { courseCode: 'ELEC1', passed: true, score4: 3.0 },
    { courseCode: 'ELEC2', passed: true, score4: 3.5 },
    { courseCode: 'ELEC3', passed: true, score4: 4.0 },
  ];

  const progress = CurriculumProgressEngine.calculateProgress(mockCurriculum, grades);
  const grp = progress.electives.groups.find(g => g.groupId === 'grp1');

  assert.ok(grp);
  assert.equal(grp.rawCompletedCredits, 9, 'Raw completed credits is 9');
  assert.equal(grp.completedCredits, 3, 'Counted completed credits is capped at required (3)');
  assert.equal(grp.remainingCredits, 0, 'Remaining credits is 0');
  assert.equal(grp.remainingCreditsAfterPlan, 0, 'Remaining credits after plan is 0');
  assert.equal(grp.status, ELECTIVE_STATUS.SATISFIED_COMPLETED);
});

test('Phase 6A.5.4B: 4. Overall Degree Coverage Capping (Section 44)', () => {
  // Real snapshot scenario: 118 mandatory required, 123 raw passed. 26 elective required, 26 raw passed. Total raw 149, required 144.
  const ctkHtmlPath = path.resolve(__dirname, '../Chương trình khung.html');
  const html = fs.readFileSync(ctkHtmlPath, 'utf8');
  const dom = new JSDOM(html);
  const model = IUHCurriculumAdapter.parseCurriculum(dom.window.document).data;

  // Student whose CTK passState matches snapshot
  const progress = CurriculumProgressEngine.calculateProgress(model, []);

  assert.equal(progress.curriculumRawCompletedCredits, 149, 'Raw completed credits is 149');
  assert.equal(progress.curriculumCompletedCredits, 144, 'Counted coverage credits must be capped at 144');
  assert.equal(progress.curriculumRequiredCredits, 144);
  assert.equal(progress.currentProgressPercent, 100, 'Progress percentage must be 100%, not 103%');

  assert.equal(progress.mandatory.rawCompletedCredits, 123);
  assert.equal(progress.mandatory.completedCredits, 118, 'Mandatory counted completed must be capped at 118');
  assert.equal(progress.mandatory.remainingCredits, 0);
  assert.equal(progress.mandatory.remainingCreditsAfterPlan, 0);
});

test('Phase 6A.5.4B: 5. No Literal Undefined / NaN / HKundefined in UI (Section 45 & 30)', () => {
  const ctkHtmlPath = path.resolve(__dirname, '../Chương trình khung.html');
  const html = fs.readFileSync(ctkHtmlPath, 'utf8');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const doc = dom.window.document;
  const root = doc.getElementById('root');

  const ctkDom = new JSDOM(html);
  const model = IUHCurriculumAdapter.parseCurriculum(ctkDom.window.document).data;

  const store = new SimulationStore();
  store.setCurriculumModel(model);

  const bar = new CompanionBar({ store, mountParent: root, doc });
  bar.switchTab('plan');

  const serialized = root.innerHTML;

  assert.doesNotMatch(serialized, /Còn thiếu:\s*undefined/i, 'Must not contain "Còn thiếu: undefined"');
  assert.doesNotMatch(serialized, /Nhóm tự chọn\s*undefined/i, 'Must not contain "Nhóm tự chọn undefined"');
  assert.doesNotMatch(serialized, /HKundefined/i, 'Must not contain "HKundefined"');
  assert.doesNotMatch(serialized, />NaN</i, 'Must not contain literal NaN');
  assert.doesNotMatch(serialized, />undefined</i, 'Must not contain literal undefined');
});

test('Phase 6A.5.4B: 6. Planner Course Pool originates from CTK (Section 46)', () => {
  const ctkHtmlPath = path.resolve(__dirname, '../Chương trình khung.html');
  const html = fs.readFileSync(ctkHtmlPath, 'utf8');
  const dom = new JSDOM(html);
  const model = IUHCurriculumAdapter.parseCurriculum(dom.window.document).data;

  const pool = FutureSemesterEngine.getCoursePool(model, [], null);
  const ctkCodes = new Set(model.courses.map(c => c.curriculumCourseCode || c.code));

  (pool.allAvailable || []).forEach(course => {
    assert.ok(ctkCodes.has(course.code), `Course ${course.code} in planner pool must exist in CTK`);
  });
});

test('Phase 6A.5.4B: 7. Satisfied Elective Group excludes extra courses from default pool (Section 47)', () => {
  const mockCurriculum = {
    requiredCredits: 3,
    mandatoryCredits: 0,
    electiveCredits: 3,
    totals: { totalRequiredCredits: 3, totalMandatoryCredits: 0, totalElectiveCredits: 3 },
    courses: [
      { code: 'ELEC1', curriculumCourseCode: 'ELEC1', name: 'Tự chọn 1', credits: 3, requirementType: 'ELECTIVE', electiveGroupId: 'grp1', electiveGroupRequiredCredits: 3 },
      { code: 'ELEC2', curriculumCourseCode: 'ELEC2', name: 'Tự chọn 2', credits: 3, requirementType: 'ELECTIVE', electiveGroupId: 'grp1', electiveGroupRequiredCredits: 3 },
    ],
    electiveGroups: [
      { id: 'grp1', name: 'Nhóm 1', requiredCredits: 3, courses: [] }
    ]
  };

  // Student already passed ELEC1, so grp1 is satisfied
  const grades = [
    { courseCode: 'ELEC1', passed: true, score4: 3.0 }
  ];

  const pool = FutureSemesterEngine.getCoursePool(mockCurriculum, grades, null);

  // ELEC2 should NOT be in electiveRemaining because grp1 is already satisfied
  const elecRemainingCodes = pool.electiveRemaining.map(c => c.code);
  assert.ok(!elecRemainingCodes.includes('ELEC2'), 'ELEC2 must not be in electiveRemaining when group is satisfied');
});

test('Phase 6A.5.4B: 8. Non-GPA Courses in CTK excluded from GPA and GPA Rescue (Section 48 & 19)', () => {
  const nonGpaCourse = {
    code: '4203003242',
    name: 'Giáo dục Quốc phòng và An ninh 1',
    courseName: 'Giáo dục Quốc phòng và An ninh 1',
    credits: 4,
    hasAsterisk: true,
    countsTowardCumulativeGPA: false,
    score4: 2.0,
    gradeLetter: 'C'
  };

  const eligibility = GPARescueEngine.checkCourseEligibility(nonGpaCourse);
  assert.equal(eligibility.eligible, false, 'Non-GPA course must be excluded from GPA Rescue');
  assert.ok(eligibility.reason.includes('không tính vào điểm trung bình'), 'Exclusion reason must state non-GPA');
});

test('Phase 6A.5.4B: 9. Privacy wording is accurate and non-misleading (Section 40)', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const store = new SimulationStore();
  const root = dom.window.document.getElementById('root');
  const bar = new CompanionBar({ store, mountParent: root, doc: dom.window.document });

  bar.switchTab('privacy');
  const serialized = root.innerHTML;

  assert.ok(serialized.includes('Tiện ích không gửi dữ liệu học tập tới máy chủ của nhà phát triển hoặc bên thứ ba'));
  assert.ok(serialized.includes('Khi đồng bộ Chương trình khung, trình duyệt gửi yêu cầu trực tiếp tới cổng sinh viên IUH bằng phiên đăng nhập hiện tại'));
  assert.ok(!serialized.includes('Không có bất kỳ dữ liệu nào được truyền ra khỏi máy tính'));
});

test('Phase 6A.5.4B: 10. Invalid Group Fail-Safe (Section 29)', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const store = new SimulationStore();
  const root = dom.window.document.getElementById('root');

  const invalidCurriculum = {
    requiredCredits: 10,
    mandatoryCredits: 10,
    electiveCredits: 0,
    totals: { totalRequiredCredits: 10, totalMandatoryCredits: 10, totalElectiveCredits: 0 },
    courses: [],
    electiveGroups: [
      { id: 'invalid_grp', name: 'Nhóm lỗi', requiredCredits: 0, status: 'INCOMPATIBLE_GROUP', courses: [] }
    ]
  };

  store.setCurriculumModel(invalidCurriculum);
  const bar = new CompanionBar({ store, mountParent: root, doc: dom.window.document });
  bar.switchTab('plan');

  const serialized = root.innerHTML;
  assert.ok(serialized.includes('Không thể xác định một nhóm học phần tự chọn từ dữ liệu CTK.'));
  assert.doesNotMatch(serialized, /Nhóm lỗi/);
});

