const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { CurriculumProgressEngine, ELECTIVE_STATUS } = require('../src/core/CurriculumProgressEngine.js');
const { PlanCoverageEngine } = require('../src/core/PlanCoverageEngine.js');
const { CurriculumGapEngine, GAP_TYPES } = require('../src/core/CurriculumGapEngine.js');
const { FutureSemesterEngine } = require('../src/core/FutureSemesterEngine.js');
const { PROVENANCE, PROVENANCE_LABELS } = require('../src/core/DataProvenance.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');

// Mock Courses for CTK
const mockCourses = [
  { code: 'MAND01', name: 'Toán cao cấp 1', credits: 3, isElective: false, countsTowardCumulativeGPA: true, type: 'LT', term: 1, inferredCourseType: 'LT' },
  { code: 'NONGPA01', name: 'Giáo dục thể chất 1', credits: 2, isElective: false, countsTowardCumulativeGPA: false, type: 'TH', term: 1, inferredCourseType: 'TH' },
  { code: 'MAND02', name: 'Nhập môn lập trình', credits: 4, isElective: false, countsTowardCumulativeGPA: true, type: 'LT+TH', term: 1, inferredCourseType: 'LT+TH' },
  { code: 'MAND03', name: 'Cấu trúc dữ liệu', credits: 4, isElective: false, countsTowardCumulativeGPA: true, type: 'LT+TH', term: 2, inferredCourseType: 'LT+TH' },
  { code: 'ELEC01', name: 'Lập trình Python', credits: 3, isElective: true, electiveGroupId: 1, countsTowardCumulativeGPA: true, type: 'LT', term: 2, inferredCourseType: 'LT' },
  { code: 'ELEC02', name: 'Lập trình C++', credits: 3, isElective: true, electiveGroupId: 1, countsTowardCumulativeGPA: true, type: 'LT', term: 2, inferredCourseType: 'LT' },
  { code: 'ELEC03', name: 'Lập trình Java', credits: 3, isElective: true, electiveGroupId: 1, countsTowardCumulativeGPA: true, type: 'LT', term: 2, inferredCourseType: 'LT' }
];

const mockCurriculum = {
  requiredCredits: 144,
  mandatoryCredits: 120,
  electiveCredits: 24,
  totals: {
    totalRequiredCredits: 144,
    totalMandatoryCredits: 120,
    totalElectiveCredits: 24
  },
  courses: mockCourses,
  electiveGroups: [
    {
      id: 1,
      groupIndex: 1,
      label: 'Nhóm tự chọn 1',
      requiredCredits: 3,
      courses: [
        { code: 'ELEC01', credits: 3 },
        { code: 'ELEC02', credits: 3 },
        { code: 'ELEC03', credits: 3 }
      ]
    }
  ]
};

test('CurriculumProgressEngine: Tách bạch rõ các khái niệm tín chỉ và xử lý môn Non-GPA', () => {
  // Matched grades: MAND01 (passed), NONGPA01 (passed)
  const matchedGrades = [
    {
      courseCode: 'MAND01',
      courseName: 'Toán cao cấp 1',
      credits: 3,
      passed: true,
      score4: 3.5,
      countsTowardCumulativeGPA: true
    },
    {
      courseCode: 'NONGPA01',
      courseName: 'Giáo dục thể chất 1',
      credits: 2,
      passed: true,
      score4: null,
      countsTowardCumulativeGPA: false // Non-GPA
    }
  ];

  const progress = CurriculumProgressEngine.calculateProgress(mockCurriculum, matchedGrades, null);

  // Curriculum required = 144
  assert.equal(progress.curriculumRequiredCredits, 144);
  // Curriculum completed = 3 + 2 = 5 credits (Non-GPA course counts toward CTK progress)
  assert.equal(progress.curriculumCompletedCredits, 5);
  // GPA-eligible completed credits = only 3 (Non-GPA course excluded from GPA denominator)
  assert.equal(progress.gpaEligibleCompletedCredits, 3);
  assert.equal(progress.gpaExcludedCompletedCredits, 2);

  // Disclaimer verification
  assert.ok(progress.disclaimer.includes('Không bao gồm toàn bộ điều kiện tốt nghiệp khác'));
});

test('CurriculumProgressEngine: Phân biệt Hiện tại vs Kế hoạch tương lai & Future Pass Requirement', () => {
  const matchedGrades = [
    { courseCode: 'MAND01', courseName: 'Toán cao cấp 1', credits: 3, passed: true }
  ];

  // Future plan with 2 courses: 1 passing, 1 without score (in progress/unscored)
  const futurePlan = {
    semesters: [
      {
        id: 'sem_future_1',
        courses: [
          {
            code: 'MAND02',
            courseName: 'Nhập môn lập trình',
            credits: 4,
            isPassed: true,
            score4: 3.0 // PASS
          },
          {
            code: 'MAND03',
            courseName: 'Cấu trúc dữ liệu',
            credits: 4,
            score4: null // No score entered yet
          }
        ]
      }
    ]
  };

  const progress = CurriculumProgressEngine.calculateProgress(mockCurriculum, matchedGrades, futurePlan);

  // Completed credits (current actual): 3
  assert.equal(progress.curriculumCompletedCredits, 3);
  // Planned credits: 4 + 4 = 8
  assert.equal(progress.curriculumPlannedCredits, 8);
  // Projected completed credits: 3 (current) + 4 (passing future course) = 7
  // Course without score does NOT count toward projectedCompletedCredits
  assert.equal(progress.curriculumProjectedCompletedCredits, 7);

  // Check mandatory progress
  assert.equal(progress.mandatory.completedCredits, 3);
  assert.equal(progress.mandatory.plannedCredits, 8);
  assert.equal(progress.mandatory.projectedCompletedCredits, 7);
});

test('CurriculumProgressEngine: Future course simulated FAIL không tính vào projected completed', () => {
  const matchedGrades = [];
  const futurePlan = {
    semesters: [
      {
        id: 'sem_future_1',
        courses: [
          {
            code: 'MAND01',
            courseName: 'Toán cao cấp 1',
            credits: 3,
            isPassed: false,
            letter: 'F' // Failed
          }
        ]
      }
    ]
  };

  const progress = CurriculumProgressEngine.calculateProgress(mockCurriculum, matchedGrades, futurePlan);
  assert.equal(progress.curriculumPlannedCredits, 3);
  assert.equal(progress.curriculumProjectedCompletedCredits, 0); // Not counted toward completion
});

test('CurriculumProgressEngine: Xử lý nhóm tự chọn (SATISFIED_WITH_PLAN và OVER_PLANNED)', () => {
  // Scenario 1: Completed 0, Planned 3 for group requiring 3
  const plan1 = {
    semesters: [
      {
        courses: [
          { code: 'ELEC01', credits: 3, electiveGroupId: 1 }
        ]
      }
    ]
  };
  const prog1 = CurriculumProgressEngine.calculateProgress(mockCurriculum, [], plan1);
  const grp1 = prog1.electives.groups.find(g => g.groupId === 1);
  assert.ok(grp1);
  assert.equal(grp1.status, ELECTIVE_STATUS.SATISFIED_WITH_PLAN);
  assert.equal(grp1.remainingCreditsAfterPlan, 0);

  // Scenario 2: User plans 6 credits for group requiring 3 (OVER_PLANNED)
  const plan2 = {
    semesters: [
      {
        courses: [
          { code: 'ELEC01', credits: 3, electiveGroupId: 1 },
          { code: 'ELEC02', credits: 3, electiveGroupId: 1 }
        ]
      }
    ]
  };
  const prog2 = CurriculumProgressEngine.calculateProgress(mockCurriculum, [], plan2);
  const grp2 = prog2.electives.groups.find(g => g.groupId === 1);
  assert.ok(grp2);
  assert.equal(grp2.status, ELECTIVE_STATUS.OVER_PLANNED);
  assert.equal(grp2.plannedCredits, 6);
  // Remaining credits must not be negative
  assert.equal(grp2.remainingCreditsAfterPlan, 0);
  assert.equal(grp2.coverageCredits, 3); // Capped at required
});

test('PlanCoverageEngine: Phân tích kế hoạch và chênh lệch mục tiêu GPA', () => {
  const progressSummary = {
    curriculumPlannedCredits: 15,
    gpaEligiblePlannedCredits: 15,
    mandatory: { requiredCredits: 120, completedCredits: 90, plannedCredits: 15, remainingAfterPlan: 15 },
    electives: { totalRequired: 24, totalCompleted: 12, totalPlanned: 6, groups: [] },
    curriculumRemainingAfterPlan: 21
  };

  const futurePlan = {
    semesters: [
      { id: 's1', courses: [ { id: 'c1', credits: 5 }, { id: 'c2', credits: 5 } ] },
      { id: 's2', courses: [ { id: 'c3', credits: 5 } ] }
    ]
  };

  const actualSummary = {
    gpa4: 3.20,
    earnedCredits: 102
  };

  // Target GPA = 3.50
  const coverage = PlanCoverageEngine.analyzePlanCoverage({
    progressSummary,
    futurePlan,
    actualSemestersOrSummary: actualSummary,
    targetGpa: 3.50
  });

  assert.equal(coverage.futureSemesterCount, 2);
  assert.equal(coverage.plannedCourseCount, 3);
  assert.equal(coverage.plannedCurriculumCredits, 15);
  assert.equal(coverage.mandatoryCoverage.remainingAfterPlan, 15);
  assert.ok(coverage.targetInsight);
  assert.ok(coverage.disclaimer.includes('không đồng nghĩa Nhà trường sẽ mở lớp'));
});

test('CurriculumGapEngine: Phát hiện bất nhất dữ liệu an toàn (fail-safe)', () => {
  // Case 1: Exact matches with known inferred type -> No gaps
  const ctkExact = {
    courses: [ { code: 'CS101', name: 'Toán cao cấp 1', credits: 3, inferredCourseType: 'LT' } ]
  };
  const gradesExact = [
    { courseCode: 'CS101', courseName: 'Toán cao cấp 1', credits: 3 }
  ];
  const resExact = CurriculumGapEngine.detectGaps({ curriculumModel: ctkExact, gradeSemestersOrCourses: gradesExact });
  assert.equal(resExact.hasGaps, false);
  assert.equal(resExact.gapCount, 0);

  // Case 2: Credit mismatch
  const gradesMismatch = [
    { courseCode: 'CS101', courseName: 'Toán cao cấp 1', credits: 4 } // 4 vs 3
  ];
  const resMismatch = CurriculumGapEngine.detectGaps({ curriculumModel: ctkExact, gradeSemestersOrCourses: gradesMismatch });
  assert.equal(resMismatch.hasGaps, true);
  assert.ok(resMismatch.gaps.some(g => g.type === GAP_TYPES.CREDITS_MISMATCH));

  // Case 3: Grade course not in CTK
  const gradesExtra = [
    { courseCode: 'EXTRA99', courseName: 'Môn học mới', credits: 2 }
  ];
  const resExtra = CurriculumGapEngine.detectGaps({ curriculumModel: ctkExact, gradeSemestersOrCourses: gradesExtra });
  assert.equal(resExtra.hasGaps, true);
  assert.ok(resExtra.gaps.some(g => g.type === GAP_TYPES.UNMATCHED_GRADE_COURSE));
});

test('FutureSemesterEngine: What-if Presets và độ ưu tiên điểm thành phần', () => {
  const plan = {
    semesters: [
      {
        id: 'sem_1',
        courses: [
          {
            id: 'fc_1',
            courseCode: 'IT01',
            credits: 3,
            scores: {}
          },
          {
            id: 'fc_2',
            courseCode: 'IT02',
            credits: 2,
            scores: {}
          }
        ]
      }
    ]
  };

  // 1. Áp dụng What-if preset "B+"
  const presetResult = FutureSemesterEngine.applyWhatIfPreset(plan, 'B+');
  assert.equal(presetResult.ok, true);
  assert.equal(presetResult.modifiedCount, 2);
  assert.ok(presetResult.previousSnapshot); // Snapshot for undo

  const course1 = plan.semesters[0].courses[0];
  assert.equal(course1.plannedLetterGradeOverride, 'B+');
  assert.equal(course1.plannedGradePointOverride, 3.5);
  // Không được bịa component scores
  assert.deepEqual(course1.scores, {});

  // 2. Độ ưu tiên: Khi người dùng nhập component score, override bị xóa hoặc bị ghi đè
  course1.scores = { final: 9.0 };
  const updatedCourse = FutureSemesterEngine.recalculateFutureCourse(course1);
  // Component-based score takes precedence
  assert.equal(updatedCourse.plannedLetterGradeOverride, null);
  assert.equal(updatedCourse.plannedGradePointOverride, null);

  // 3. Hoàn tác What-if preset
  const restoreRes = FutureSemesterEngine.restoreWhatIfPreset(plan, presetResult.previousSnapshot);
  assert.equal(restoreRes.ok, true);
  assert.equal(plan.semesters[0].courses[0].plannedLetterGradeOverride, undefined);
});

test('DataProvenance: Tập trung hóa provenance enum và nhãn học thuật', () => {
  assert.ok(PROVENANCE.CURRICULUM_EXPLICIT);
  assert.ok(PROVENANCE.CURRICULUM_LT_TH);
  assert.ok(PROVENANCE.CURRICULUM_NON_GPA);
  assert.ok(PROVENANCE.GRADE_PAGE);
  assert.ok(PROVENANCE.USER_OVERRIDE);
  assert.ok(PROVENANCE.LEGACY_FALLBACK);
  assert.ok(PROVENANCE.SIMULATED);
  assert.ok(PROVENANCE.UNKNOWN);

  // Nhãn học thuật, không dùng % confidence giả tạo
  assert.equal(PROVENANCE_LABELS[PROVENANCE.CURRICULUM_EXPLICIT], 'Xác định từ CTK');
  assert.equal(PROVENANCE_LABELS[PROVENANCE.USER_OVERRIDE], 'Tùy chỉnh');
  assert.equal(PROVENANCE_LABELS[PROVENANCE.UNKNOWN], 'Chưa xác định');
});

test('Audit Permissions and Zero Network Endpoints: MV3 an toàn tuyệt đối', () => {
  const manifestPath = path.join(__dirname, '../manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // MV3 format
  assert.equal(manifest.manifest_version, 3);

  // Host permissions: Chỉ sv.iuh.edu.vn/*
  assert.deepEqual(manifest.host_permissions, ['https://sv.iuh.edu.vn/*']);

  // Không xin các quyền nguy hiểm
  const forbiddenPermissions = ['<all_urls>', 'cookies', 'history', 'debugger', 'webRequest', 'downloads'];
  forbiddenPermissions.forEach(p => {
    assert.equal(manifest.permissions?.includes(p), false, `Permission ${p} must not be present`);
  });

  // Zero new network endpoints in core files
  const coreFiles = [
    'src/core/CurriculumProgressEngine.js',
    'src/core/PlanCoverageEngine.js',
    'src/core/CurriculumGapEngine.js',
    'src/core/FutureSemesterEngine.js'
  ];

  coreFiles.forEach(relPath => {
    const code = fs.readFileSync(path.join(__dirname, '../', relPath), 'utf8');
    assert.equal(code.includes('fetch('), false, `${relPath} must not initiate fetch`);
    assert.equal(code.includes('XMLHttpRequest'), false, `${relPath} must not initiate XHR`);
    assert.equal(code.includes('WebSocket'), false, `${relPath} must not initiate WebSocket`);
    assert.equal(code.includes('sendBeacon'), false, `${relPath} must not initiate sendBeacon`);
  });
});
