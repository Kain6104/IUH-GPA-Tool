/**
 * release-files.js — Release Packaging Specification & Exclusion Guard
 *
 * Chuẩn bị cho Phase 6B: Định nghĩa tường minh các file được phép ship vào production package
 * và các file/folder bắt buộc phải bị loại trừ (Exclusions).
 */
'use strict';

/**
 * Danh sách các file / thư mục được phép đưa vào production bundle của Chrome Web Store
 */
const PRODUCTION_ALLOWLIST = [
  'manifest.json',
  'content.js',
  'popup.html',
  'popup.js',
  'icons/iuh.png',
  'src/utils/result.js',
  'src/parsers/NumberParser.js',
  'src/parsers/HeaderGridParser.js',
  'src/adapters/IUHPageAdapter.js',
  'src/adapters/IUHCurriculumAdapter.js',
  'src/core/GradingRuleEngine.js',
  'src/core/GPAEngine.js',
  'src/core/RequiredScoreEngine.js',
  'src/core/GPATargetEngine.js',
  'src/core/ForecastEngine.js',
  'src/core/GPARescueEngine.js',
  'src/core/ScenarioEngine.js',
  'src/core/CourseIdentityMatcher.js',
  'src/core/RiskEngine.js',
  'src/core/SemesterSummaryEngine.js',
  'src/core/TimelineEngine.js',
  'src/core/ExportEngine.js',
  'src/core/FutureSemesterEngine.js',
  'src/core/DataProvenance.js',
  'src/core/CurriculumProgressEngine.js',
  'src/core/PlanCoverageEngine.js',
  'src/core/CurriculumGapEngine.js',
  'src/state/SimulationStore.js',
  'src/state/selectors.js',
  'src/ui/CompanionBar.js',
  'src/ui/CourseSimulationPanel.js',
  'src/ui/AppController.js',
  'src/ui/styles.css',
];

/**
 * Danh sách các file/folder TUYỆT ĐỐI KHÔNG được đóng gói vào production release
 */
const PRODUCTION_EXCLUSIONS = [
  'Kết quả học tập.html',
  'Kết quả học tập_files/**',
  'Chương trình khung.html',
  'Chương trình khung_files/**',
  'docs/**',
  'tests/**',
  'scripts/**',
  'node_modules/**',
  'package.json',
  'package-lock.json',
  '.git/**',
  '.gitignore',
  '*.log',
  'SECURITY_AUDIT.md',
];

function isProductionFile(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  // Không được chứa bất kỳ pattern exclusion nào
  if (normalized.includes('Kết quả học tập') || normalized.startsWith('tests/') || normalized.startsWith('docs/')) {
    return false;
  }
  return PRODUCTION_ALLOWLIST.includes(normalized);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PRODUCTION_ALLOWLIST,
    PRODUCTION_EXCLUSIONS,
    isProductionFile,
  };
}
