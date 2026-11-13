/**
 * package-release.js — Phase 6B Production Packager & Auditor
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const RELEASE_DIR = path.resolve(ROOT_DIR, 'release');
const PRODUCTION_DIR = path.resolve(RELEASE_DIR, 'production');
const STORE_DIR = path.resolve(RELEASE_DIR, 'store');

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

function runPackaging() {
  console.log('=== PHASE 6B: PRODUCTION PACKAGING & AUDIT ===\n');

  // 1. Read and validate manifest.json
  const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestRaw);
  const version = manifest.version;
  console.log(`[Manifest] Name: ${manifest.name}`);
  console.log(`[Manifest] Version: ${version}`);
  console.log(`[Manifest] Manifest Version: ${manifest.manifest_version}`);

  // 2. Clean & recreate staging directory
  if (fs.existsSync(PRODUCTION_DIR)) {
    fs.rmSync(PRODUCTION_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(PRODUCTION_DIR, { recursive: true });

  if (fs.existsSync(STORE_DIR)) {
    fs.rmSync(STORE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STORE_DIR, { recursive: true });

  // 3. Copy allowlist files
  console.log('\n[Staging] Copying allowlisted production files to release/production...');
  let totalBytes = 0;
  for (const relPath of PRODUCTION_ALLOWLIST) {
    const srcFile = path.join(ROOT_DIR, relPath);
    if (!fs.existsSync(srcFile)) {
      throw new Error(`CRITICAL: Allowlist file does not exist: ${relPath}`);
    }
    const destFile = path.join(PRODUCTION_DIR, relPath);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
    const stat = fs.statSync(destFile);
    totalBytes += stat.size;
  }
  console.log(`[Staging] Successfully copied ${PRODUCTION_ALLOWLIST.length} files (${(totalBytes / 1024).toFixed(2)} KB uncompressed).`);

  // 4. Verify all manifest references exist in staging
  console.log('\n[Validation] Verifying manifest references inside release/production...');
  const prodManifest = JSON.parse(fs.readFileSync(path.join(PRODUCTION_DIR, 'manifest.json'), 'utf8'));

  // Icons
  for (const [size, iconRel] of Object.entries(prodManifest.icons || {})) {
    const iconPath = path.join(PRODUCTION_DIR, iconRel);
    if (!fs.existsSync(iconPath)) throw new Error(`Missing icon: ${iconRel}`);
  }

  // Popup
  if (prodManifest.action && prodManifest.action.default_popup) {
    const popupPath = path.join(PRODUCTION_DIR, prodManifest.action.default_popup);
    if (!fs.existsSync(popupPath)) throw new Error(`Missing popup: ${prodManifest.action.default_popup}`);
  }

  // Content scripts
  for (const cs of prodManifest.content_scripts || []) {
    for (const cssRel of cs.css || []) {
      if (!fs.existsSync(path.join(PRODUCTION_DIR, cssRel))) {
        throw new Error(`Missing content css: ${cssRel}`);
      }
    }
    for (const jsRel of cs.js || []) {
      if (!fs.existsSync(path.join(PRODUCTION_DIR, jsRel))) {
        throw new Error(`Missing content js: ${jsRel}`);
      }
    }
  }
  console.log('[Validation] All manifest references resolved cleanly.');

  // 5. Syntax check on all staged JS files
  console.log('\n[Validation] Performing node syntax check (vm.Script) on staged JS files...');
  let jsCount = 0;
  for (const relPath of PRODUCTION_ALLOWLIST) {
    if (relPath.endsWith('.js')) {
      const fullPath = path.join(PRODUCTION_DIR, relPath);
      const code = fs.readFileSync(fullPath, 'utf8');
      new vm.Script(code, { filename: relPath });
      jsCount++;
    }
  }
  console.log(`[Validation] ${jsCount} JS files parsed with 0 syntax errors.`);

  // 6. Security & Secret Scan on staged files
  console.log('\n[Security] Scanning staged files for secrets and forbidden sinks...');
  const FORBIDDEN_SINKS = [
    { pattern: /\beval\s*\(/, name: 'eval()' },
    { pattern: /\bnew\s+Function\s*\(/, name: 'new Function()' },
    { pattern: /\bdocument\.write\s*\(/, name: 'document.write()' },
    { pattern: /https?:\/\/.*fonts\.googleapis\.com/i, name: 'Remote Google Fonts' },
    { pattern: /https?:\/\/.*cdnjs\.cloudflare\.com/i, name: 'Remote CDN (cdnjs)' },
    { pattern: /https?:\/\/.*unpkg\.com/i, name: 'Remote CDN (unpkg)' },
    { pattern: /https?:\/\/.*jsdelivr\.net/i, name: 'Remote CDN (jsdelivr)' },
  ];

  const SECRET_PATTERNS = [
    { pattern: /(?:AIzaSy[0-9A-Za-z-_]{33})/, name: 'Google API Key' },
    { pattern: /-----BEGIN PRIVATE KEY-----/, name: 'Private Key' },
    { pattern: /-----BEGIN RSA PRIVATE KEY-----/, name: 'RSA Private Key' },
    { pattern: /Bearer\s+[A-Za-z0-9\-_]{20,}/, name: 'Bearer Token' },
  ];

  for (const relPath of PRODUCTION_ALLOWLIST) {
    if (relPath.endsWith('.png')) continue;
    const content = fs.readFileSync(path.join(PRODUCTION_DIR, relPath), 'utf8');

    for (const sink of FORBIDDEN_SINKS) {
      if (sink.pattern.test(content)) {
        throw new Error(`FORBIDDEN SINK DETECTED in ${relPath}: ${sink.name}`);
      }
    }

    for (const sec of SECRET_PATTERNS) {
      if (sec.pattern.test(content)) {
        throw new Error(`SECRET DETECTED in ${relPath}: ${sec.name}`);
      }
    }
  }
  console.log('[Security] 0 forbidden sinks, 0 remote CDNs, 0 secrets detected.');

  // 7. Write release-file-list.txt
  const fileListContent = [
    `IUH GPA Tool - Production File Inventory`,
    `Version: ${version}`,
    `Generated: ${new Date().toISOString()}`,
    `Total Files: ${PRODUCTION_ALLOWLIST.length}`,
    `Total Uncompressed Size: ${(totalBytes / 1024).toFixed(2)} KB (${totalBytes} bytes)`,
    ``,
    `Files:`,
    ...PRODUCTION_ALLOWLIST.map((f, idx) => `  ${(idx + 1).toString().padStart(2, ' ')}. ${f}`),
  ].join('\n');
  fs.writeFileSync(path.join(RELEASE_DIR, 'release-file-list.txt'), fileListContent, 'utf8');
  console.log(`\n[Inventory] Written release/release-file-list.txt`);

  // 8. Generate Store Materials in release/store/
  console.log('\n[Store Materials] Generating Chrome Web Store submission documents in release/store/...');

  // 8.1 PRIVACY_DISCLOSURE.txt
  const privacyText = `CHROME WEB STORE PRIVACY DISCLOSURE
Extension Name: Tính Điểm IUH – Công Cụ Mô Phỏng Cho Sinh Viên
Version: ${version}

1. DATA COLLECTION & TRANSMISSION:
- The extension does NOT collect, store, or transmit any student personal information (such as student ID, name, email, phone number, address, or password) to developer servers or any third-party servers.
- The extension does NOT use any telemetry, analytics, tracking, or remote error reporting services.
- All simulation computations, GPA targets, forecasts, and grade scenarios are computed locally in the user's browser memory.

2. CURRICULUM SYNCHRONIZATION (CTK):
- When synchronizing the student's curriculum (Chương trình khung), the browser makes a direct same-origin GET request to https://sv.iuh.edu.vn/chuong-trinh-khung.html using the student's active, authenticated browser session.
- No login credentials, cookies, or auth tokens are read, intercepted, or persisted.
- The retrieved curriculum is parsed locally in memory; no raw HTML is stored or uploaded.

3. PERMISSIONS RATIONALE:
- "storage": Used solely to persist non-sensitive user settings, specifically the extension's enabled/disabled toggle state (iuhGpaEnabled).
- Host Permission "https://sv.iuh.edu.vn/*": Scoped strictly to the Industrial University of Ho Chi Minh City (IUH) student portal for content script injection on the grade results page and fetching the curriculum page.

4. USER-INITIATED EXTERNAL NAVIGATION:
- The popup contains an optional developer-credit link that opens a Facebook profile only when clicked by the user. This normal browser navigation may disclose standard connection/request metadata to Facebook; the extension does not attach or send grades, GPA, curriculum data, or simulation scenarios.
`;
  fs.writeFileSync(path.join(STORE_DIR, 'PRIVACY_DISCLOSURE.txt'), privacyText, 'utf8');

  // 8.2 STORE_DESCRIPTION.txt
  const storeDescText = `Tính Điểm IUH – Công Cụ Mô Phỏng Cho Sinh Viên
(IUH GPA Simulator & Study Assistant)

Tiện ích học tập độc lập dành cho sinh viên Trường Đại học Công nghiệp TP.HCM (IUH), hỗ trợ theo dõi kết quả học tập, mô phỏng điểm số thi kết thúc học phần và lập kế hoạch GPA an toàn, chuẩn xác ngay trên cổng thông tin sinh viên.

CÁC TÍNH NĂNG CHÍNH:
1. Mô phỏng điểm số thông minh:
- Nhập điểm thi kết thúc học phần dự kiến để tính điểm tổng kết, điểm hệ 4, hệ 10 và điểm chữ theo đúng quy chế đào tạo IUH.
- Hiển thị trực quan môn Đạt / Không đạt và cảnh báo điểm liệt (dưới 4,0 điểm hệ 10).
- Bảo toàn 100% dữ liệu gốc: Các ô điểm chính thức của nhà trường được giữ nguyên vẹn, tách biệt hoàn toàn với điểm số mô phỏng.

2. Đồng bộ Chương trình khung (CTK):
- Tự động đối chiếu các học phần đã học, đang học và chưa học trong chương trình đào tạo của từng chuyên ngành.
- Nhận diện chính xác môn tự chọn, môn bắt buộc, môn loại trừ không tính GPA và phân bổ tín chỉ.

3. Lập kế hoạch học kỳ tương lai & Mục tiêu GPA:
- Dự báo GPA tích lũy khi hoàn thành các học kỳ tiếp theo.
- Tính toán điểm số trung bình tối thiểu cần đạt để đạt mục tiêu tốt nghiệp (Xuất sắc, Giỏi, Khá).
- Hỗ trợ kế hoạch học cải thiện / học lại môn học.

4. Biểu đồ tiến trình & Xuất dữ liệu:
- Biểu đồ xu hướng GPA qua từng học kỳ trực quan, chuẩn xác.
- Xuất bảng mô phỏng ra định dạng bảng tính CSV an toàn với chuẩn UTF-8 BOM.

5. Quyền riêng tư & An toàn bảo mật:
- Hoạt động 100% cục bộ trên trình duyệt của sinh viên.
- Không gửi bất kỳ dữ liệu học tập nào tới máy chủ của nhà phát triển hoặc bên thứ ba.
- Không đọc, không lưu mật khẩu hay thông tin cá nhân của sinh viên.
- Dễ dàng Bật / Tắt tiện ích từ biểu tượng popup trên thanh công cụ.

LƯU Ý QUAN TRỌNG:
Tiện ích là công cụ hỗ trợ học tập phi thương mại do sinh viên phát triển, không phải ứng dụng chính thức của Trường Đại học Công nghiệp TP.HCM. Bảng điểm chính thức luôn căn cứ trên dữ liệu gốc tại cổng sv.iuh.edu.vn.
`;
  fs.writeFileSync(path.join(STORE_DIR, 'STORE_DESCRIPTION.txt'), storeDescText, 'utf8');

  // 8.3 REVIEWER_NOTES.txt
  const reviewerNotesText = `CHROME WEB STORE REVIEWER NOTES
Extension: Tính Điểm IUH – Công Cụ Mô Phỏng Cho Sinh Viên
Version: ${version}

1. SINGLE PURPOSE & SUPPORTED PAGES:
This extension serves a single, dedicated academic purpose: assisting students of Industrial University of Ho Chi Minh City (IUH) in visualizing, simulating, and planning their GPA directly on their academic portal.
- Main injected page: https://sv.iuh.edu.vn/ket-qua-hoc-tap.html* (IUH Student Grade Results)

2. PERMISSION JUSTIFICATIONS:
- "storage":
  Required to store a single non-sensitive boolean setting: whether the extension is toggled ON or OFF (key: "iuhGpaEnabled"). No grade data, credentials, or PII are stored.
- Host Permission "https://sv.iuh.edu.vn/*":
  Required because:
  a) The content script injects exclusively into https://sv.iuh.edu.vn/ket-qua-hoc-tap.html*
  b) The extension performs a same-origin fetch to https://sv.iuh.edu.vn/chuong-trinh-khung.html to read the student's curriculum structure in memory during active sessions.
  No broad patterns like <all_urls> or *://*/* are used.
  Note: "activeTab" is NOT requested to adhere to absolute least-privilege principles.

3. NETWORK ISOLATION:
- The only extension-initiated data fetch is the same-origin IUH curriculum request described above. An optional developer-credit link opens Facebook only after a user click; that normal browser navigation may disclose standard connection/request metadata, but sends no academic data from the extension.
- No developer server, telemetry, tracking, or external CDNs/remote executable code are used.
- All dependencies, styles, and SVG icons are 100% offline and packaged locally.

4. HOW TO TEST THE EXTENSION:
- Step 1: In chrome://extensions, enable "Developer mode" and click "Load unpacked", selecting the "release/production" directory.
- Step 2: Click the extension icon in the Chrome toolbar to open the popup. Observe the academic status, ON/OFF switch, GPA metrics cards, and developer link.
- Step 3: When navigating to an IUH grade results page (https://sv.iuh.edu.vn/ket-qua-hoc-tap.html), the Companion Bar and simulation controls appear cleanly above the grade table.
- Step 4: Toggling the extension OFF via the popup unmounts all extension elements and restores the pristine state.
`;
  fs.writeFileSync(path.join(STORE_DIR, 'REVIEWER_NOTES.txt'), reviewerNotesText, 'utf8');

  // 8.4 RELEASE_NOTES.txt
  const releaseNotesText = `RELEASE NOTES — VERSION ${version}

What's New in Version ${version}:
- Export bảng điểm và phân tích chi tiết ra Excel; tiếp tục hỗ trợ CSV.
- Cải thiện mô phỏng học kỳ tương lai, gồm lựa chọn loại môn và nhập điểm cuối kỳ cho môn thực tập/khóa luận.
- Đối chiếu tiến độ tín chỉ CTK với tín chỉ tích lũy chính thức và hiển thị đúng nhãn học kỳ trên biểu đồ tiến trình.
- Chặn chuyển hướng đồng bộ Chương trình khung ra ngoài tên miền IUH.
`;
  fs.writeFileSync(path.join(STORE_DIR, 'RELEASE_NOTES.txt'), releaseNotesText, 'utf8');
  console.log('[Store Materials] Generated 4 store documents in release/store/');

  // 9. Create Production ZIP using .NET ZipFile (guarantees root-level structure)
  const zipFileName = `IUH-GPA-Tool-v${version}-production.zip`;
  const zipFilePath = path.join(RELEASE_DIR, zipFileName);
  console.log(`\n[Packaging] Creating ${zipFileName}...`);

  if (fs.existsSync(zipFilePath)) {
    fs.unlinkSync(zipFilePath);
  }

  // Create zip using PowerShell .NET API with includeBaseDirectory = $false
  const psZipCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${PRODUCTION_DIR.replace(/'/g, "''")}', '${zipFilePath.replace(/'/g, "''")}', [System.IO.Compression.CompressionLevel]::Optimal, $false)`;
  execSync(`powershell -NoProfile -Command "${psZipCmd}"`, { stdio: 'inherit' });

  const zipStat = fs.statSync(zipFilePath);
  console.log(`[Packaging] ZIP created successfully!`);
  console.log(`  Path: ${zipFilePath}`);
  console.log(`  Size: ${(zipStat.size / 1024).toFixed(2)} KB (${zipStat.size} bytes)`);

  // 10. Validate ZIP contents
  console.log('\n[ZIP Audit] Inspecting ZIP structure with PowerShell .NET API...');
  const psInspectCmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${zipFilePath.replace(/'/g, "''")}'); $zip.Entries | ForEach-Object { $_.FullName }; $zip.Dispose()`;
  const zipEntriesOutput = execSync(`powershell -NoProfile -Command "${psInspectCmd}"`, { encoding: 'utf8' });
  const zipFileNames = zipEntriesOutput
    .split(/\r?\n/)
    .map(line => line.trim().replace(/\\/g, '/'))
    .filter(Boolean);

  console.log(`[ZIP Audit] Total entries in ZIP: ${zipFileNames.length}`);

  // Assert manifest at root
  if (!zipFileNames.includes('manifest.json')) {
    throw new Error('CRITICAL RELEASE BLOCKER: manifest.json is NOT at the root of the ZIP!');
  }
  console.log('  [PASS] manifest.json located at ROOT of ZIP.');

  // Assert all allowlist files present
  for (const rel of PRODUCTION_ALLOWLIST) {
    if (!zipFileNames.includes(rel)) {
      throw new Error(`CRITICAL RELEASE BLOCKER: Allowlisted file missing from ZIP: ${rel}`);
    }
  }
  console.log(`  [PASS] All ${PRODUCTION_ALLOWLIST.length} allowlisted files confirmed inside ZIP.`);

  // Assert no forbidden files
  const FORBIDDEN_NAMES = [
    'node_modules',
    'tests',
    'docs',
    'scripts',
    '.git',
    '.github',
    'package.json',
    'package-lock.json',
    'README.md',
    'SECURITY_AUDIT.md',
    'Kết quả học tập.html',
    'Chương trình khung.html',
    'fixtures',
  ];
  for (const entry of zipFileNames) {
    for (const forbidden of FORBIDDEN_NAMES) {
      if (entry === forbidden || entry.startsWith(forbidden + '/') || entry.endsWith('.test.js') || entry.endsWith('.log')) {
        throw new Error(`CRITICAL RELEASE BLOCKER: Forbidden file found in ZIP: ${entry}`);
      }
    }
  }
  console.log('  [PASS] Zero forbidden files, zero HTML snapshots, zero test files found in ZIP.');

  console.log('\n=== RELEASE PACKAGING & AUDIT: ALL GATES PASSED (100% READY) ===\n');
}

try {
  runPackaging();
} catch (err) {
  console.error('\n*** PACKAGING FAILED ***\n', err);
  process.exit(1);
}
