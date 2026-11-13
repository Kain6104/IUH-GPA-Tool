# Architecture và implementation plan

## 1. Quyết định kiến trúc

Project hiện là Chrome Extension Manifest V3 rất nhỏ, không có build system, background worker, package manager hoặc test. Kiến trúc đề xuất giữ vanilla JavaScript và chỉ thêm mức module cần thiết để cô lập DOM, business rule, state và UI.

Không triển khai Required Score, GPA Target, Rescue, Scenario hoặc Forecast trong phase audit này.

## 2. Kiến trúc mục tiêu tối thiểu

```text
src/
├─ adapters/
│  └─ IUHPageAdapter.js
├─ parsers/
│  ├─ NumberParser.js
│  └─ HeaderGridParser.js
├─ core/
│  ├─ GPAEngine.js
│  └─ GradingRuleEngine.js
├─ state/
│  ├─ SimulationStore.js
│  └─ selectors.js
├─ storage/
│  └─ PreferencesRepository.js
├─ ui/
│  ├─ AppShell.js
│  ├─ SemesterView.js
│  ├─ CourseEditor.js
│  └─ styles.css
├─ messaging/
│  └─ protocol.js
├─ utils/
│  └─ result.js
└─ content-entry.js

popup/
├─ popup.html
├─ popup.js
└─ popup.css

tests/
├─ fixtures/
│  ├─ grade-page.sanitized.html
│  └─ incompatible-page.html
├─ adapter/
├─ core/
└─ state/

docs/
```

Nếu thêm bundler, chỉ bundle `content-entry.js` và popup; không thêm framework UI cho quy mô hiện tại. Nếu chưa thêm bundler, có thể giữ các module dưới một namespace nội bộ và liệt kê file theo thứ tự trong `content_scripts`, nhưng không để business logic gọi `document` trực tiếp.

## 3. Boundary và trách nhiệm

### `IUHPageAdapter`

Là module duy nhất được đọc DOM IUH.

```js
isCompatiblePage(): CompatibilityResult
detectColumns(table): Result<ColumnMap>
validateStructure(table, columnMap): ValidationResult
parseSemesters(table, columnMap): Result<SemesterOriginal[]>
parseCourse(row, columnMap): Result<CourseOriginal>
```

Adapter không tính GPA, không phân loại môn, không sửa DOM và không lưu storage.

### Parsers

- `HeaderGridParser`: giải `rowspan`/`colspan`, map `lang` sang leaf index.
- `NumberParser`: parse dấu phẩy/chấm nghiêm ngặt, phân biệt `missing`, `invalid`, `valid`.
- Không parser nào clamp hoặc thay missing bằng 0.

### Core

- `GPAEngine`: pure functions cho weighted average và tín chỉ.
- `GradingRuleEngine`: rule có `ruleId`, version, provenance và trạng thái verified/unverified.
- Điểm tổng kết gốc từ IUH được giữ như observed value; không tự dựng lại nếu chưa có rule đáng tin cho môn đó.
- Các engine không biết DOM, Chrome API hoặc storage.

Các engine tương lai như Required Score/Forecast/Risk/Scenario chỉ thêm sau khi adapter, state và grading rule đã ổn định.

### State

```js
state = {
  originalData,      // immutable, parse từ IUH một lần
  simulationData,    // delta người dùng nhập
  derivedData,       // kết quả tính lại từ hai nguồn trên
  compatibility,    // status + error codes không chứa PII
  ui
}
```

Invariant:

- `originalData` không bị overwrite.
- `simulationData` không chứa bản copy toàn bộ transcript nếu chỉ sửa vài field.
- `derivedData` luôn có provenance: `official-observed`, `simulated`, `unknown`.
- Reset simulation xóa delta, không reload và không đọc lại DOM trừ khi người dùng yêu cầu refresh.

Course instance key đề xuất:

```text
semesterKey + courseClassCode + occurrenceIndex
```

Không dùng tên môn làm primary key. `occurrenceIndex` xử lý duplicate/retake trong cùng một key space; adapter phải báo ambiguity nếu không tạo được key ổn định.

### Storage

Phase đầu chỉ lưu preference không nhạy cảm. Transcript snapshot mặc định ở memory.

`PreferencesRepository` là interface để sau này thay implementation mà không đưa `chrome.storage` vào core. Không tạo `SnapshotStore` persistent trước khi có UX opt-in, retention và delete.

### UI

- Một extension-owned root, ưu tiên Shadow DOM.
- Render panel độc lập trước/cạnh bảng; không chèn cột hoặc sửa cell IUH.
- UI nhận state qua selector/action, không query DOM IUH.
- Mọi kết quả mô phỏng có nhãn rõ và fail-safe xóa kết quả stale.

### Messaging

Message có schema/version và allow-list action:

```js
{ version: 1, type: 'SIMULATION_SUMMARY_UPDATED', payload: { ... } }
```

Chỉ gửi aggregate tối thiểu cho popup. Không gửi raw course list/DOM nếu popup không cần.

## 4. Kiểu dữ liệu đề xuất

```js
CourseOriginal = {
  id,
  semesterKey,
  ordinal,
  courseClassCode,
  courseName,
  credits: ParsedNumber,
  assessments: {
    midterm,
    regular: Array<{ slot, sourceField, value }>,
    practice: Array<{ slot, sourceField, value }>,
    finalExam
  },
  officialResult: {
    total10,
    score4,
    letter,
    classification,
    note,
    passed
  },
  provenance: 'iuh-dom'
}

CourseSimulationDelta = {
  courseId,
  included?,
  courseTypeOverride?,
  assessmentOverrides?,
  gradingRuleId?
}
```

Không đưa hidden `UID`, profile, ảnh hoặc page HTML vào model.

## 5. Phase triển khai tiếp theo

### Phase 0 — Audit/research (prompt hiện tại)

- Inventory toàn bộ project.
- Map DOM từ HTML thật.
- Audit formula, UI, permission, network và privacy.
- Ghi bốn tài liệu trong `docs/`.
- Chạy baseline syntax/build/lint/test có thể thực hiện.

Exit criteria: tài liệu hoàn chỉnh, không thêm feature lớn, không sửa runtime source.

### Phase 1 — Fixture hygiene và security shell

- Tạo fixture đã sanitize nhưng giữ nguyên cấu trúc bảng.
- Đưa raw snapshot ra khỏi build/package allow-list; thêm ignore phù hợp.
- Thu hẹp `content_scripts.matches` về exact HTTPS path.
- Harden URL check và external links.
- Thêm fail-safe shell và error codes không chứa PII.
- Ghi automated scan đảm bảo artifact không chứa raw snapshot/identifier.

Exit criteria: extension không chạy ngoài trang mục tiêu, fixture public không có dữ liệu thật.

### Phase 2 — Adapter/parser

- Implement `HeaderGridParser` cho rowspan/colspan.
- Implement `IUHPageAdapter` theo selector contract.
- Implement strict number parser.
- Test 27-column fixture, học kỳ thiếu summary, field 6–9, malformed/duplicate marker.
- Thêm compatibility report cho người dùng.

Exit criteria: mọi DOM access nằm trong adapter; incompatible fixture luôn dừng tính.

### Phase 3 — State separation

- Tạo immutable `originalData`.
- Tạo `SimulationStore` delta-only.
- Loại bỏ `contentEditable` và mọi write vào cell/summary IUH.
- Thêm reset/refresh có semantics rõ.
- Test rằng object gốc và DOM gốc không đổi sau simulation.

Exit criteria: không overwrite dữ liệu IUH; reset không cần reload.

### Phase 4 — Core GPA/rule engine

- Chuyển GPA weighted average thành pure function.
- Mô hình hóa exclusion/rule bằng cấu hình có provenance, không hard-code substring trong engine.
- Giữ official total/grade như observed baseline.
- Chỉ bật recalculation theo component khi rule được xác minh hoặc người dùng chủ động chọn một rule mô phỏng có nhãn.
- Test missing data, zero credit, fail/pass, precision và retake ambiguity.

Exit criteria: không có công thức “official” nếu chưa có bằng chứng; output luôn ghi provenance.

### Phase 5 — UI phù hợp IUH

- Áp dụng `DESIGN_SYSTEM_IUH.md`.
- Panel extension-owned, responsive, accessible.
- Phân biệt `Dữ liệu gốc` và `Mô phỏng`.
- Thay popup gradient/glass bằng palette IUH.
- Thêm status local-only và privacy notice ngắn.

Exit criteria: không phá sticky/responsive table IUH; keyboard/focus/contrast đạt yêu cầu.

### Phase 6 — Storage tùy chọn

- Chỉ triển khai nếu có yêu cầu sản phẩm rõ.
- Preference local tối thiểu.
- Snapshot simulation phải opt-in, có retention/delete/export rõ và không sync mặc định.
- Threat model lại trước khi xin permission mới.

Exit criteria: không có dữ liệu nhạy cảm persist ngoài lựa chọn rõ ràng của người dùng.

### Phase 7 — Các feature phân tích nâng cao

Required Score, GPA Target, Rescue, Scenario, Forecast và Risk chỉ bắt đầu sau Phase 1–5. Mỗi engine phải là pure module, dùng state/provenance chung và không mở rộng permission/network.

## 6. Test strategy

### Adapter contract tests

- Snapshot sanitized chuẩn parse đúng 10 học kỳ/54 row ở fixture tương đương.
- Đổi thứ tự cột nhưng giữ `lang`/`title`: adapter map đúng qua header grid.
- Mất/duplicate marker: fail-safe.
- Thêm cột lạ: chỉ tiếp tục nếu mapping không ambiguous và policy cho phép; mặc định dừng.
- Summary của học kỳ sau không bị gắn nhầm vào học kỳ trước.

### Core tests

- Weighted average với dấu phẩy/chấm và precision.
- Missing khác 0.
- Tín chỉ 0 không làm sai mẫu số.
- Boundary grade dùng table-driven tests sau khi rule được xác minh.
- Không mutate input object.

### State tests

- Apply delta không đổi `originalData`.
- Reset xóa đúng delta.
- Refresh tạo snapshot mới có version.
- Derived result bị invalidated khi compatibility lỗi.

### Security tests

- Static grep cấm network sink/analytics/forbidden Chrome permissions.
- Build artifact allow-list.
- Không có raw HTML snapshot trong package.
- Message schema reject action/payload lạ.
- Không log field nhạy cảm.

### UI tests

- Desktop/mobile, horizontal scroll và sticky table không bị tác động.
- Keyboard-only, focus visible, reduced motion.
- Fail-safe không hiển thị result stale.

## 7. Build/tooling đề xuất

Chưa cần framework. Khi bắt đầu implementation:

- Thêm `package.json` tối thiểu với script `build`, `lint`, `test`, `check`.
- Dùng một bundler nhẹ nếu cần ES modules trong content script.
- Dùng ESLint với rule cấm implicit globals và unsanitized DOM sink.
- Dùng test runner có DOM environment cho adapter; fixture phải sanitize.
- Build ra `dist/` bằng allow-list rõ ràng thay vì zip toàn repository.

Không thêm dependency runtime/network nếu native DOM API đáp ứng được.

## 8. Thứ tự migration an toàn từ code hiện tại

1. Khóa behavior bằng tests từ fixture sanitized.
2. Tách adapter read-only nhưng vẫn dùng UI cũ tạm thời.
3. Tạo immutable state và so sánh output với baseline.
4. Tách pure GPA/rule engine.
5. Thay DOM mutation bằng panel UI riêng.
6. Thu hẹp manifest và đóng gói allow-list.
7. Chỉ sau đó mới thêm feature mới.

Trong migration, không gọi endpoint IUH và không dùng live account cho automated test.

## 9. Open decisions cần bằng chứng bổ sung

- Nguồn quy chế chính thức cho trọng số/grade boundary/điểm liệt.
- Rule học lại và cách IUH chọn tín chỉ tích lũy.
- Có cho phép người dùng tự chọn grading rule hay chỉ mô phỏng theo template.
- Có cần persist scenario hay memory-only là đủ.
- Bộ CSS đầy đủ của snapshot để xác nhận typography/token.

Mọi quyết định trên phải được ghi thành ADR ngắn trước khi triển khai rule hoặc xin thêm permission.
