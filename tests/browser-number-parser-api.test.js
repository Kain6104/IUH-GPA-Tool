const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('Browser NumberParser API & Namespace Contract Test: Exact browser environment', () => {
  // Create clean browser DOM window
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
    runScripts: 'dangerously'
  });
  const win = dom.window;

  // Load scripts in EXACT manifest order into browser global context
  const scriptsToLoad = [
    'src/utils/result.js',
    'src/parsers/NumberParser.js',
    'src/parsers/HeaderGridParser.js',
    'src/adapters/IUHCurriculumAdapter.js'
  ];

  scriptsToLoad.forEach(relPath => {
    const code = fs.readFileSync(path.join(__dirname, '../', relPath), 'utf8');
    win.eval(code);
  });

  // Verify browser global namespace
  assert.ok(win.IUHGPA, 'IUHGPA must be defined on window');
  assert.ok(win.IUHGPA.parsers, 'IUHGPA.parsers must be defined');
  assert.ok(win.IUHGPA.parsers.NumberParser, 'IUHGPA.parsers.NumberParser must be defined');

  const np = win.IUHGPA.parsers.NumberParser;

  // Canonical API assertions
  assert.equal(typeof np.parseCredit, 'function', 'np.parseCredit must be a function');
  assert.equal(typeof np.parseCredits, 'function', 'np.parseCredits must be a function');
  assert.equal(typeof np.parseScore, 'function', 'np.parseScore must be a function');
  assert.equal(typeof np.parseGradePoint, 'function', 'np.parseGradePoint must be a function');
  assert.equal(typeof np.formatScore2, 'function', 'np.formatScore2 must be a function');
  assert.equal(typeof np.formatAverage4, 'function', 'np.formatAverage4 must be a function');

  // Alias strict equality
  assert.strictEqual(np.parseCredits, np.parseCredit, 'parseCredits must be an exact alias of parseCredit');

  // Verify direct fallback on parsers
  assert.equal(typeof win.IUHGPA.parsers.parseCredit, 'function');
  assert.equal(typeof win.IUHGPA.parsers.parseCredits, 'function');

  // Test parsing behavior in browser context
  const resOk = np.parseCredit('3');
  assert.equal(resOk.status, 'ok');
  assert.equal(resOk.value, 3);

  const resMissing = np.parseCredit('');
  assert.equal(resMissing.status, 'missing');
  assert.equal(resMissing.value, null);

  const resInvalid = np.parseCredit('abc');
  assert.equal(resInvalid.status, 'invalid');
  assert.equal(resInvalid.value, null);
});

test('IUHCurriculumAdapter: Browser context parsing does NOT throw NumberParser.parseCredits is not a function', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    runScripts: 'dangerously'
  });
  const win = dom.window;

  // Load in manifest order
  const scriptsToLoad = [
    'src/utils/result.js',
    'src/parsers/NumberParser.js',
    'src/parsers/HeaderGridParser.js',
    'src/adapters/IUHCurriculumAdapter.js'
  ];

  scriptsToLoad.forEach(relPath => {
    const code = fs.readFileSync(path.join(__dirname, '../', relPath), 'utf8');
    win.eval(code);
  });

  const adapter = win.IUHGPA.adapters.IUHCurriculumAdapter;
  assert.ok(adapter, 'IUHCurriculumAdapter must be defined on window');

  // Load real sanitized curriculum fixture
  const fixturePath = path.join(__dirname, 'fixtures/curriculum.sanitized.html');
  const fixtureHtml = fs.readFileSync(fixturePath, 'utf8');

  const ctkDoc = new win.DOMParser().parseFromString(fixtureHtml, 'text/html');

  // This call previously crashed with "NumberParser.parseCredits is not a function" in browser runtime!
  const parseRes = adapter.parseCurriculum(ctkDoc);

  assert.equal(parseRes.ok, true, 'parseCurriculum must succeed without throwing');
  assert.ok(parseRes.data, 'parseCurriculum must return data');
  assert.ok(parseRes.data.courses.length > 0, 'Curriculum must contain courses');
  assert.ok(typeof parseRes.data.requiredCredits === 'number', 'requiredCredits must be parsed');
});
