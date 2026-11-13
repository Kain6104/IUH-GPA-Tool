# BÁO CÁO KIỂM TOÁN AN NINH & BẢO MẬT (SECURITY AUDIT REPORT)
**Dự án: IUH GPA Tool — Phiên bản 1.1.1**

*Ngày kiểm toán cập nhật: 06/10/2026*

---

### 1. Mô hình đe dọa (Threat Model)

| Mối đe dọa tiềm tàng | Mức độ rủi ro | Cơ chế phòng thủ & Biện pháp giảm thiểu hiện tại | Trạng thái |
| :--- | :---: | :--- | :---: |
| **DOM-based XSS qua dữ liệu bảng điểm** | Cao | Không sử dụng `eval`, `new Function`, `document.write`. Toàn bộ chuỗi dữ liệu bảng điểm (tên môn, mã môn, tên kịch bản) được chèn qua `textContent` hoặc DOM element attributes đã validate. | **ĐÃ GIẢM THIỂU** |
| **CSV / Spreadsheet Formula Injection** | Cao | Tiện ích tích hợp `sanitizeSpreadsheetCell` trong `ExportEngine.js`. Tự động prefix dấu nháy đơn `'` cho các chuỗi bắt đầu bằng `=`, `+`, `-`, `@`, `\t`, `\r`. | **ĐÃ GIẢM THIỂU** |
| **Rò rỉ dữ liệu học tập ra bên ngoài** | Nghiêm trọng | GPA, bảng điểm, CTK và mô phỏng được xử lý cục bộ; chỉ gửi GET cùng nguồn IUH để lấy CTK, không kèm dữ liệu học tập do extension tạo. Popup có liên kết Facebook tùy chọn, chỉ mở sau thao tác bấm của người dùng; điều hướng thông thường có thể gửi metadata kết nối tới Facebook nhưng không gửi dữ liệu học tập. | **ĐÃ GIẢM THIỂU** |
| **Đánh cắp thông tin xác thực / Cookies** | Nghiêm trọng | Extension không yêu cầu quyền `cookies`. Không đọc mật khẩu, OTP hay session token của sinh viên. | **ĐÃ GIẢM THIỂU** |
| **Chèn mã từ xa (Remotely Hosted Code)** | Nghiêm trọng | Toàn bộ mã nguồn, logic tính toán, icon SVG đều được đóng gói cục bộ trong extension package. Không sử dụng CDN hay external JS/WASM. | **ĐÃ GIẢM THIỂU** |
| **Lạm dụng quyền trình duyệt** | Trung bình | Chỉ dùng permission `storage` cho công tắc bật/tắt; host permission giới hạn ở `https://sv.iuh.edu.vn/*` để chạy trên trang điểm và tải CTK. Không yêu cầu `activeTab`, `downloads`, `webRequest` hay `<all_urls>`. | **ĐÃ GIẢM THIỂU** |

---

### 2. Kiểm tra các hàm chìm không an toàn (Sink Audit)

Kết quả rà soát tĩnh (Static Scan) trên toàn bộ thư mục `src/`, `content.js`, và `popup.js`:
- `eval()`: **0 phát hiện**.
- `new Function()`: **0 phát hiện**.
- `document.write()`: **0 phát hiện**.
- `window.setTimeout(string)` / `setInterval(string)`: **0 phát hiện**.
- `innerHTML`: Được rà soát thủ công. Các vị trí sử dụng chỉ chứa HTML template tĩnh hoặc số thực đã được ép kiểu qua `.toFixed()` / `.replace()` an toàn, không chứa biến chuỗi người dùng thô chưa validate. HTML tải về từ CTK được xử lý hoàn toàn trong detached document bằng `DOMParser`, không bao giờ gán trực tiếp vào live DOM.

---

### 3. Kiểm tra mạng & Dữ liệu ngoại vi (Network Audit)
- **Tải Chương trình khung nội bộ (Same-Origin Fetch)**: `AppController.syncCurriculum()` thực hiện `fetch('/chuong-trinh-khung.html')` trực tiếp trên host `sv.iuh.edu.vn` bằng chính phiên đăng nhập hiện tại để đồng bộ danh mục học phần. Tối đa 1 lần auto-sync/session, có timeout 15s (`AbortController`), không retry vòng lặp.

**Network Inventory:**
- **Destination:** `sv.iuh.edu.vn`
- **Endpoint:** `/chuong-trinh-khung.html`
- **Method:** `GET`
- **Trigger:** once per page session or explicit user refresh
- **Data sent:** normal browser request/session managed by IUH/browser
- **Extension-added academic payload:** `NONE`
- **Developer server:** `NONE`
- **Third-party behavior:** The popup's optional developer-credit link opens Facebook after an explicit user click. Standard navigation metadata may be sent by the browser; no academic data is attached.
- Cross-origin redirects from the authenticated CTK request are rejected before the response body is read.

- `XMLHttpRequest`: **0 phát hiện trong runtime**.
- `WebSocket`: **0 phát hiện trong runtime**.
- `sendBeacon()`: **0 phát hiện trong runtime**.
- `axios` / HTTP libraries: **Không sử dụng**.
- **Kết luận**: Không phát hiện hành vi truyền tải dữ liệu học tập, GPA, danh mục CTK hay kịch bản mô phỏng tới máy chủ nhà phát triển hoặc bên thứ ba. Liên kết Facebook là điều hướng tùy chọn của người dùng và không đính kèm dữ liệu học tập. Toàn bộ mô hình CTK được bóc tách và duy trì cục bộ trong RAM.

---

### 4. Kiểm tra quyền hạn & Manifest V3 (Permission Audit)
- `manifest_version`: **3** (Tuân thủ chuẩn Manifest V3).
- `permissions`: Duy nhất `["storage"]`.
- `host_permissions`: Duy nhất `["https://sv.iuh.edu.vn/*"]`, cần cho content script và fetch CTK cùng nguồn.
- `content_scripts.matches`: Giới hạn nghiêm ngặt tại `["https://sv.iuh.edu.vn/ket-qua-hoc-tap.html*"]`.
- `web_accessible_resources`: **Không khai báo**.
- `externally_connectable`: **Không khai báo**.

---

### 5. Kiểm tra lưu trữ (Storage Audit)
- `chrome.storage.local`: Chỉ lưu boolean `iuhGpaEnabled` để ghi nhớ trạng thái bật/tắt extension.
- `localStorage` của cổng trường: **Không sử dụng để lưu bảng điểm hay scenario (0)**.
- `IndexedDB`: **Không sử dụng (0)**.
- **Kết luận**: Bảng điểm, kịch bản và điểm mô phỏng chỉ nằm trong RAM của phiên làm việc; chúng không được ghi vào `chrome.storage`.

---

### 6. Kiểm tra khóa bí mật & Thông tin nhạy cảm (Secrets Scan)
- Quét các mẫu: `API_KEY`, `client_secret`, `access_token`, `refresh_token`, `BEGIN RSA`, `BEGIN OPENSSH`, `PRIVATE KEY`, `Bearer`.
- **Kết luận release 1.1.1**: Không phát hiện mẫu secret trong các file production được đóng gói; đây không phải kết luận quét mọi file trong repository hoặc dependencies phát triển.

---

### 7. Kiểm tra phụ thuộc (Dependency Audit)
- Không chạy `npm audit` trong lần phát hành này; không khẳng định trạng thái lỗ hổng cho dependency phát triển.
- Phụ thuộc runtime (Dependencies): **0** (Thuần Vanilla JavaScript, không phụ thuộc package bên ngoài).
- Phụ thuộc môi trường phát triển (DevDependencies): `jsdom` (chỉ dùng cho môi trường unit test mô phỏng DOM của Node.js).

---

### 8. Các hạn chế kỹ thuật đã biết (Known Limitations)
1. **Dữ liệu trong phiên**: Kịch bản mô phỏng và điểm giả lập không được lưu trữ vĩnh viễn giữa các lần tắt mở trình duyệt. Đây là quyết định có chủ đích nhằm tối thiểu hóa quyền hạn và bảo vệ quyền riêng tư cho sinh viên theo kiến trúc local-first.
2. **Quy chế đào tạo chính thức**: Các cảnh báo mức cần chú ý và gợi ý cải thiện GPA là mô phỏng toán học hỗ trợ sinh viên, không thay thế quyết định học vụ chính thức của IUH.


## Release 1.1.1 Verification (06/10/2026)
- `permissions`: `storage`; `host_permissions`: `https://sv.iuh.edu.vn/*`; no `activeTab`.
- `GET /chuong-trinh-khung.html` is same-origin, uses the current IUH browser session, and rejects cross-origin redirects before reading the response body.
- The popup's developer-credit link navigates to Facebook only after user activation; it does not include academic data.
- Production package scan: 33 files; no secrets, remote executable code, development URLs, tests, fixtures, `.env`, or `node_modules`.
- Regression suite: 269 tests passed.
