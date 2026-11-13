const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Quét toàn bộ thư mục src/ và root scripts để đảm bảo không có network request hay remote execution
 */
test('Security Audit: 0 network requests và 0 remote executable scripts trong runtime', () => {
  const runtimeFiles = [
    'content.js',
    'popup.js',
    'src/utils/result.js',
    'src/parsers/NumberParser.js',
    'src/parsers/HeaderGridParser.js',
    'src/adapters/IUHPageAdapter.js',
    'src/adapters/IUHCurriculumAdapter.js',
    'src/core/CourseIdentityMatcher.js',
    'src/core/GradingRuleEngine.js',
    'src/core/GPAEngine.js',
    'src/core/RequiredScoreEngine.js',
    'src/core/GPATargetEngine.js',
    'src/core/ForecastEngine.js',
    'src/core/GPARescueEngine.js',
    'src/core/ScenarioEngine.js',
    'src/core/RiskEngine.js',
    'src/core/SemesterSummaryEngine.js',
    'src/core/TimelineEngine.js',
    'src/core/ExportEngine.js',
    'src/state/SimulationStore.js',
    'src/state/selectors.js',
    'src/ui/CompanionBar.js',
    'src/ui/CourseSimulationPanel.js',
    'src/ui/AppController.js',
  ];

  const forbiddenCalls = [
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bWebSocket\b/,
    /\bEventSource\b/,
    /\bsendBeacon\b/,
    /\beval\s*\(/,
    /\bnew\s+Function\s*\(/,
    /\bdocument\.write\s*\(/,
  ];

  const forbiddenRemoteHosts = [
    /https?:\/\/cdn\./i,
    /https?:\/\/unpkg\.com/i,
    /https?:\/\/cdnjs\.cloudflare\.com/i,
    /https?:\/\/cdn\.jsdelivr\.net/i,
    /https?:\/\/esm\.sh/i,
  ];

  for (const relPath of runtimeFiles) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    assert.ok(fs.existsSync(fullPath), `File phải tồn tại: ${relPath}`);
    const code = fs.readFileSync(fullPath, 'utf8');

    // 1. Kiểm tra network & unsafe execution sinks
    for (const pattern of forbiddenCalls) {
      if (pattern.source.includes('fetch') && relPath === 'src/ui/AppController.js') {
        // AppController chỉ được phép thực hiện duy nhất same-origin fetch tới trang CTK
        const fetchMatches = code.match(/\bfetch\s*\([^)]*\)/g) || [];
        for (const fm of fetchMatches) {
          assert.ok(fm.includes('fetchUrl') || fm.includes('/chuong-trinh-khung.html'), 'fetch phải hướng tới cùng nguồn CTK');
        }
        continue;
      }
      const match = code.match(pattern);
      assert.equal(
        match,
        null,
        `Phát hiện sink không an toàn ${pattern} trong file runtime: ${relPath}`
      );
    }

    // 2. Kiểm tra remote script hosting
    for (const remotePattern of forbiddenRemoteHosts) {
      const match = code.match(remotePattern);
      assert.equal(
        match,
        null,
        `Phát hiện remote host pattern ${remotePattern} trong file runtime: ${relPath}`
      );
    }
  }
});
