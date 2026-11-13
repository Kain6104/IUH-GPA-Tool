# Security baseline

## 1. Mô hình bảo mật

Extension là công cụ mô phỏng cục bộ:

- **Local-first:** parse và tính toán trong trình duyệt.
- **Privacy-by-design:** không thu thập hoặc truyền bảng điểm/định danh.
- **Least-privilege:** chỉ chạy trên trang kết quả học tập cần thiết.
- **Fail-safe:** cấu trúc không chắc chắn thì dừng, không đoán cột/công thức.

Không có chức năng đăng nhập, tự động đăng nhập, đọc credential, bypass CAPTCHA/auth/rate limit, dò API, crawling hoặc sửa dữ liệu IUH.

## 2. Manifest hiện tại

| Mục | Hiện tại | Đánh giá |
|---|---|---|
| Manifest | V3 | Phù hợp |
| `permissions` | `activeTab` | Quyền tương đối hẹp; đang dùng để đọc URL tab active sau user gesture |
| `host_permissions` | Không có | Tốt; không cấp host permission riêng |
| `content_scripts.matches` | `*://sv.iuh.edu.vn/*` | Rộng hơn nhu cầu; gồm HTTP và mọi path |
| Background/service worker | Không có | Tốt cho bề mặt tấn công hiện tại |
| `web_accessible_resources` | Không có | Tốt |
| Storage permission | Không có | Tốt; source hiện không persist dữ liệu |

Khuyến nghị ở phase implementation:

```json
"content_scripts": [
  {
    "matches": ["https://sv.iuh.edu.vn/ket-qua-hoc-tap.html*"],
    "js": ["content.js"],
    "run_at": "document_end"
  }
]
```

Giữ `activeTab` chỉ nếu popup tiếp tục cần kiểm tra URL active và điều hướng theo thao tác người dùng. Không thêm `cookies`, `history`, `debugger`, `webRequest`, `management`, `clipboardRead`, `<all_urls>` hoặc quyền `tabs` rộng nếu chưa có use case bắt buộc.

## 3. Network audit

### 3.1. Request do extension tạo

Không tìm thấy `fetch`, `XMLHttpRequest`, `$.ajax`, Axios, WebSocket, EventSource, `sendBeacon`, telemetry, analytics hoặc upload trong `content.js`, `popup.js`, `popup.html`.

Danh sách tương tác có thể chạm mạng:

| Nguồn | Hành vi | Dữ liệu do extension gửi |
|---|---|---|
| `popup.js` | `chrome.tabs.update` điều hướng tab tới `https://sv.iuh.edu.vn/ket-qua-hoc-tap.html` sau click | Không tạo payload ứng dụng; browser tải trang IUH bình thường |
| `popup.html` | Link Facebook khi người dùng click | Điều hướng user-initiated; không gửi transcript từ code extension |
| `popup.html` | `mailto:` khi người dùng click | Mở mail client; không tự gửi |
| `content.js` | `chrome.runtime.sendMessage` gửi tổng tín chỉ/GPA tới popup | IPC nội bộ extension, không phải network request |

Kết luận: source extension hiện tại không exfiltrate MSSV, họ tên, GPA, bảng điểm, HTML, cookie hoặc token.

### 3.2. Request có trong HTML snapshot nhưng không thuộc extension

HTML được lưu chứa JavaScript của chính trang IUH với các endpoint tương đối sau:

- `GET/POST /sinh-vien/doi-mat-khau.html`
- `POST /SinhVien/CapNhatNgonNguGiaoDien`
- `POST /SinhVienDangKy/HuyDangKyHocPhanDeHocLai`
- `POST /SinhVienDiem/GetKhaoSatDanhGiaXemDiem`
- `POST /SinhVienDiem/ChiTietKetQuaHocTapMon`
- `POST /SinhVienDiem/SinhVienXetThuTotNghiep`
- `POST /SinhVienDiem/XemKetQuaChuanDauRa`

Ngoài ra có một request kiểm tra tin tức nằm trong code comment. Extension không gọi các endpoint này và audit không thực thi HTML snapshot.

## 4. Storage audit

Source hiện tại không dùng:

- `chrome.storage`
- `localStorage` / `sessionStorage`
- IndexedDB
- file export
- remote storage

Kết quả chỉ tồn tại trong DOM trang và popup đang mở. Tuy nhiên, content script đang sửa trực tiếp DOM gốc, nên “không persist” không đồng nghĩa “không phá vỡ provenance trong phiên hiện tại”.

Baseline tương lai:

- Mặc định chỉ giữ `originalData` và `simulationData` trong memory.
- Chỉ persist preference không nhạy cảm nếu thực sự cần.
- Snapshot bảng điểm phải opt-in rõ ràng, có nút xóa và không sync cloud mặc định.
- Không ghi raw DOM, họ tên, MSSV, ảnh, token-like value hoặc URL query vào log/storage.
- Không dùng `chrome.storage.sync` cho transcript.

## 5. Privacy findings

### High — HTML snapshot chứa dữ liệu nhạy cảm

`Kết quả học tập.html` là file untracked nhưng chứa bảng điểm thật, tên người dùng, ảnh nhúng base64, numeric identifiers và một query parameter dạng opaque trên link SSO. Không khẳng định parameter đó còn hiệu lực, nhưng phải xử lý như secret/token-like data.

Rủi ro:

- Bị commit/push nhầm.
- Bị đóng gói cùng extension nếu zip toàn bộ thư mục.
- Bị đưa vào fixture/test report hoặc log CI.

Khuyến nghị:

- Không publish hoặc đóng gói file này.
- Thêm quy tắc ignore và allow-list file build trong phase implementation.
- Tạo fixture đã sanitize: bỏ header/profile/navigation, ảnh base64, identifier, URL query và thay dữ liệu môn/điểm bằng dữ liệu giả nhưng giữ nguyên cấu trúc DOM.
- Sau khi fixture đã được xác nhận tương đương, di chuyển bản gốc ra kho source hoặc lưu ở vị trí local được bảo vệ.

### Medium — Không tách dữ liệu gốc và mô phỏng

`content.js` thay đổi trực tiếp tổng kết, điểm chữ, xếp loại, ghi chú, icon đạt và summary trong trang IUH. Người dùng có thể nhầm kết quả mô phỏng là dữ liệu chính thức trong phiên hiện tại.

Khuyến nghị: parse một lần thành immutable `originalData`; chỉ render simulation trong root của extension; không overwrite node IUH.

### Medium — Scope content script rộng

Content script tự động được inject vào mọi path của `sv.iuh.edu.vn` và cả HTTP. Dù code hiện chỉ chờ message, đây vẫn là quyền đọc DOM rộng hơn chức năng yêu cầu.

Khuyến nghị: chỉ HTTPS và exact path kết quả học tập.

### Medium — Fail-open khi DOM hoặc input không đúng

- Không có `validateStructure`.
- Thiếu table chỉ hiện alert; thiếu `tbody`/cột có thể throw hoặc dùng index sai.
- `parseFloat` chấp nhận chuỗi có suffix; `Infinity` có thể bị clamp thành 10.
- Giá trị thiếu bị đổi thành 0 trong nhiều nhánh.
- Error gửi message bị nuốt bởi `catch {}`.

Khuyến nghị: strict parser, typed validation result, dừng toàn bộ phép tính và xóa kết quả mô phỏng cũ khi incompatible.

### Medium — Kết quả mô phỏng có thể bị hiểu là dữ liệu IUH

Code đổi trực tiếp điểm, ghi chú, icon đạt và summary nhưng không có watermark/provenance bền vững. Dù không gửi request sửa server, ảnh chụp màn hình hoặc người dùng khác nhìn vào phiên hiện tại có thể hiểu sai đây là kết quả chính thức.

Khuyến nghị: module riêng, nhãn `Mô phỏng cục bộ`, không mutate bảng IUH và không dùng style trạng thái chính thức của trang cho kết quả giả lập.

### Low/Medium — URL validation bằng substring

Popup dùng `tab.url.includes("sv.iuh.edu.vn/ket-qua-hoc-tap")`. Đây không phải origin/path validation chính xác.

Khuyến nghị: dùng `new URL`, so sánh exact protocol/hostname/pathname. Nếu URL không đọc được, hiển thị hướng dẫn thay vì suy đoán.

### Low — HTML sink

`innerHTML` hiện chỉ nhận template constant hoặc giá trị số/rank do code tạo, nên chưa thấy đường input attacker trực tiếp. Tuy vậy đây là pattern dễ trở thành DOM XSS khi mở rộng.

Khuyến nghị: dùng `replaceChildren`, `createElement`, `textContent`; không interpolate raw page/user data vào HTML.

### Low — External link hardening

Link Facebook dùng `target="_blank"` nhưng chưa khai báo `rel="noopener noreferrer"`. Thêm `rel` trong phase UI tiếp theo. Có thể cân nhắc bỏ link ngoài khỏi popup để giảm network surface.

## 6. Security findings khác

- Không đọc `document.cookie`, password, OTP, access/refresh/session token.
- Không dùng API cookie/history/debugger/webRequest/management/clipboard.
- Không có remote code trong extension.
- Không có CSP tùy chỉnh; Manifest V3 default CSP áp dụng cho extension page.
- Không validate sender/message schema. Web page bình thường không gọi được `chrome.runtime` khi không có `externally_connectable`, nhưng handler vẫn nên allow-list action và payload.
- Listener `tabs.onUpdated` có thể tồn tại nếu tab không hoàn tất hoặc bị đóng; nên timeout/cleanup để tránh state treo.
- UI dùng `contentEditable` trên DOM của website. Input component riêng sẽ giảm nguy cơ paste markup và xung đột script trang.
- README tuyên bố export Excel nhưng source không có chức năng này; tài liệu bảo mật/chức năng cần phản ánh đúng code để người dùng không có kỳ vọng sai.

## 7. Data-flow baseline đề xuất

```text
IUH DOM (read-only)
    │
    ▼
IUHPageAdapter ──validate──► immutable originalData
                                  │
User input ───────────────────────┼──► simulationData (delta only)
                                  │
                                  ▼
                           pure calculation engines
                                  │
                                  ▼
                     Extension-owned UI / local IPC

Không có network sink và không ghi ngược IUH DOM.
```

`originalData` không chứa profile/header của trang, chỉ dữ liệu tối thiểu cần tính. `simulationData` tham chiếu course instance key và field delta; reset chỉ xóa delta.

## 8. Security acceptance criteria

Một release chỉ đạt baseline khi:

- Content script match exact HTTPS page.
- Không có network call ngoài user-initiated navigation đã công bố.
- Không có quyền bị cấm hoặc `<all_urls>`.
- Không đọc hidden `#UID`, cookie, storage/token của trang.
- DOM parser fail-safe trên fixture bị đổi cột.
- Không ghi đè bảng/summary IUH.
- Original data immutable; simulation reset khôi phục bằng state, không bằng reload trang.
- Không log/telemetry transcript hoặc identifier.
- Build artifact không chứa HTML snapshot thật.
- Static scan và test xác nhận không xuất hiện endpoint/analytics mới.

## 9. Baseline hiện tại

- Không có package manager, build script, lint config hoặc test runner.
- Manifest parse hợp lệ.
- JavaScript cần được syntax-check bằng Node ở bước baseline cuối của audit.
- Worktree đã có thay đổi trước audit ở `content.js`, `manifest.json`, `popup.js`; audit không sửa các file này.
