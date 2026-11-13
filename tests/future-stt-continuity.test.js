const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const { FutureSemesterEngine, assignFutureDisplayOrdinals } = require('../src/core/FutureSemesterEngine.js');
const { AppController } = require('../src/ui/AppController.js');

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/grade-page.sanitized.html');

function setupTestEnvironment() {
  const html = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const dom = new JSDOM(html, {
    url: 'https://sv.iuh.edu.vn/ket-qua-hoc-tap.html',
    runScripts: 'outside-only',
  });
  const doc = dom.window.document;
  const app = new AppController(doc);
  app.init();
  return { dom, doc, app };
}

test('Future STT Continuity: 1. assignFutureDisplayOrdinals starts from max actual + 1 across semesters', () => {
  // Mock actual courses with max STT = 54
  const actualCourses = [
    { ordinal: 1, courseName: 'Mon 1' },
    { ordinal: 53, courseName: 'Mon 53' },
    { ordinal: 54, courseName: 'Mon 54' },
  ];

  const futureSemesters = [
    {
      id: 'fsem_1',
      label: 'HK3 (2025 - 2026)',
      courses: [
        { curriculumCourseCode: 'HP_A', courseName: 'Mon Tuong Lai A' },
        { curriculumCourseCode: 'HP_B', courseName: 'Mon Tuong Lai B' },
      ],
    },
    {
      id: 'fsem_2',
      label: 'HK1 (2026 - 2027)',
      courses: [
        { curriculumCourseCode: 'HP_C', courseName: 'Mon Tuong Lai C' },
        { curriculumCourseCode: 'HP_D', courseName: 'Mon Tuong Lai D' },
      ],
    },
  ];

  const ordinals = assignFutureDisplayOrdinals({ actualCourses, futureSemesters });
  assert.equal(ordinals['HP_A'], 55, 'Course A in first future semester must have STT 55');
  assert.equal(ordinals['HP_B'], 56, 'Course B in first future semester must have STT 56');
  assert.equal(ordinals['HP_C'], 57, 'Course C in second future semester must have STT 57');
  assert.equal(ordinals['HP_D'], 58, 'Course D in second future semester must have STT 58');
});

test('Future STT Continuity: 2. Delete middle course recalculates continuous sequence without gaps', () => {
  const actualCourses = [{ ordinal: 54 }];
  const futureSemesters = [
    {
      id: 'fsem_1',
      courses: [
        { curriculumCourseCode: 'HP_1' },
        { curriculumCourseCode: 'HP_2' },
        { curriculumCourseCode: 'HP_3' },
      ],
    },
  ];

  // Before delete
  let ordinals = assignFutureDisplayOrdinals({ actualCourses, futureSemesters });
  assert.equal(ordinals['HP_1'], 55);
  assert.equal(ordinals['HP_2'], 56);
  assert.equal(ordinals['HP_3'], 57);

  // Delete middle course HP_2
  futureSemesters[0].courses = futureSemesters[0].courses.filter(c => c.curriculumCourseCode !== 'HP_2');

  ordinals = assignFutureDisplayOrdinals({ actualCourses, futureSemesters });
  assert.equal(ordinals['HP_1'], 55);
  assert.equal(ordinals['HP_3'], 56, 'HP_3 must re-index to 56, no gap 57');
  assert.equal(ordinals['HP_2'], undefined);
});

test('Future STT Continuity: 3. Move course between future semesters re-indexes according to visual order', () => {
  const actualCourses = [{ ordinal: 54 }];
  const futureSemesters = [
    {
      id: 'fsem_1',
      courses: [
        { curriculumCourseCode: 'HP_1' },
        { curriculumCourseCode: 'HP_2' },
      ],
    },
    {
      id: 'fsem_2',
      courses: [
        { curriculumCourseCode: 'HP_3' },
      ],
    },
  ];

  // Move HP_3 from semester 2 to beginning of semester 1
  const moved = futureSemesters[1].courses.pop();
  futureSemesters[0].courses.unshift(moved);

  const ordinals = assignFutureDisplayOrdinals({ actualCourses, futureSemesters });
  assert.equal(ordinals['HP_3'], 55, 'HP_3 is now first -> STT 55');
  assert.equal(ordinals['HP_1'], 56, 'HP_1 is second -> STT 56');
  assert.equal(ordinals['HP_2'], 57, 'HP_2 is third -> STT 57');
});

test('Future STT Continuity: 4. STT is not stored as identity; internal course id and codes stay invariant', () => {
  const c1 = { id: 'stable_uuid_1', curriculumCourseCode: 'HP_100', courseName: 'Test' };
  const actualCourses = [{ ordinal: 54 }];
  const futureSemesters = [{ id: 'fsem_1', courses: [c1] }];

  const ordinals = assignFutureDisplayOrdinals({ actualCourses, futureSemesters });
  assert.equal(ordinals['HP_100'], 55);
  assert.equal(ordinals['stable_uuid_1'], 55);
  assert.equal(c1.curriculumCourseCode, 'HP_100', 'Identity unchanged');
  assert.equal(c1.id, 'stable_uuid_1', 'Internal id unchanged');
});

test('Future STT Continuity: 5. DOM verification: Future course STT continues after actual 54 (renders 55, 56)', () => {
  const { doc, app } = setupTestEnvironment();
  const table = app.table;

  // Add a future semester with 2 courses
  app.store.addFutureSemester({
    term: 1,
    startYear: 2026,
    endYear: 2027,
    isFuture: true,
    courses: [
      {
        curriculumCourseCode: '4203001001',
        courseName: 'Thực tập doanh nghiệp',
        credits: 3,
        theoryHours: 0,
        practiceHours: 90,
        inferredCourseType: 'PRACTICE',
      },
      {
        curriculumCourseCode: '4203001002',
        courseName: 'Khóa luận tốt nghiệp',
        credits: 7,
        theoryHours: 0,
        practiceHours: 0,
        inferredCourseType: 'SPECIAL',
      },
    ],
  });

  const futureRows = table.querySelectorAll('tbody tr.iuh-gpa-future-course-row');
  assert.equal(futureRows.length, 2, 'Must render 2 future course rows');

  const sttCell1 = futureRows[0].querySelector('td.iuh-gpa-future-col-stt, td.iuh-gpa-col-stt, td:nth-child(3)');
  const sttCell2 = futureRows[1].querySelector('td.iuh-gpa-future-col-stt, td.iuh-gpa-col-stt, td:nth-child(3)');

  assert.equal(sttCell1.textContent.trim(), '55', 'First future course STT must be 55');
  assert.equal(sttCell2.textContent.trim(), '56', 'Second future course STT must be 56');

  // Actual first course STT must remain 1 and last course STT must remain 54 (at index 2 / 3rd child)
  const actualFirstStt = table.querySelector('tbody tr[data-course-id] td:nth-child(3)');
  assert.equal(actualFirstStt.textContent.trim(), '1', 'Historical STT 1 untouched');
});
