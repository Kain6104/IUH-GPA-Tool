# CHÍNH SÁCH QUYỀN RIÊNG TƯ (DRAFT)
**IUH GPA Tool – Tiện Ích Mô Phỏng Điểm Cho Sinh Viên IUH**

*Ngày cập nhật: 04/10/2026*

---

### 1. Giới thiệu tổng quan
IUH GPA Tool là tiện ích mở rộng trình duyệt (Chrome Extension Manifest V3) được thiết kế nhằm hỗ trợ sinh viên Trường Đại học Công nghiệp TP.HCM (IUH) theo dõi, phân tích và mô phỏng điểm số học tập một cách an toàn và tiện lợi ngay trên trang kết quả học tập cá nhân ([https://sv.iuh.edu.vn/ket-qua-hoc-tap.html](https://sv.iuh.edu.vn/ket-qua-hoc-tap.html)).

Chúng tôi cam kết tôn trọng và bảo vệ quyền riêng tư của người dùng với nguyên tắc **Cục bộ tối đa (Local-First)** và **Thu thập tối thiểu (Zero Data Collection)**.

---

### 2. Dữ liệu extension xử lý
Để thực hiện các chức năng phân tích và mô phỏng GPA, tiện ích chỉ đọc và xử lý các thông tin học tập cần thiết hiển thị trên bảng điểm đang mở, bao gồm:
- Danh sách học kỳ và năm học.
- Mã môn học và tên môn học.
- Số tín chỉ của từng học phần.
- Các cột điểm thành phần (Điểm quá trình, thường xuyên, giữa kỳ, thực hành, thi kết thúc học phần).
- Điểm tổng kết môn, điểm hệ 4, điểm chữ và trạng thái đạt/không đạt.
- Dữ liệu Chương trình khung: Tiện ích thực hiện truy vấn `GET` cùng nguồn (same-origin) tới `https://sv.iuh.edu.vn/chuong-trinh-khung.html` để trích xuất danh mục môn học, số tín chỉ bắt buộc/tự chọn và quy tắc môn điều kiện. Dữ liệu này chỉ được lưu trữ tạm thời trong RAM và không bao giờ gửi ra khỏi máy tính.

**Những dữ liệu KHÔNG xử lý hoặc bị loại bỏ mặc định:**
- Thông tin định danh cá nhân (PII): Họ và tên sinh viên, Mã số sinh viên (MSSV), Lớp học, Ngày sinh, Giới tính, Quê quán, Số điện thoại, Địa chỉ Email, Ảnh chân dung.
- Thông tin xác thực: Mật khẩu, mã OTP, Cookies xác thực phiên đăng nhập, Session tokens.

---

### 3. Cách dữ liệu được xử lý
- **Xử lý 100% tại thiết bị người dùng (Client-side Execution)**: Toàn bộ quá trình phân tích dữ liệu, tính toán GPA (hệ 10 và hệ 4), dự báo tín chỉ, xếp hạng cải thiện điểm và tạo đồ thị SVG đều do các thuật toán JavaScript chạy trực tiếp trong trình duyệt trên máy của bạn thực hiện.
- **Không can thiệp cơ sở dữ liệu**: Tiện ích không sửa đổi hay ghi đè dữ liệu gốc của trang web trường hoặc hệ thống máy chủ IUH.

---

### 4. Truyền tải mạng & Dữ liệu có được gửi ra ngoài không?
- **Tải dữ liệu Chương trình khung**: Extension có thể tải trang Chương trình khung trực tiếp từ `sv.iuh.edu.vn` bằng phiên đăng nhập hiện tại để cung cấp tính năng phân tích và lập kế hoạch học tập.
- **Extension không gửi bảng điểm hoặc dữ liệu Chương trình khung tới máy chủ của nhà phát triển hoặc bên thứ ba.**
- **Luồng dữ liệu (Data Flow)**:
  `Trình duyệt/Người dùng` ➔ `sv.iuh.edu.vn` ➔ `Trang Chương trình khung (/chuong-trinh-khung.html)` ➔ `Extension local parser (DOMParser tách rời trong RAM)` ➔ `Mô hình dữ liệu chuẩn hoá trong bộ nhớ tạm (in-memory)`.
- **Tuyệt đối không đi tới**:
  - Không đi tới máy chủ của nhà phát triển.
  - Không đi tới dịch vụ phân tích dữ liệu (Analytics/Telemetry).
  - Không đi tới dịch vụ trí tuệ nhân tạo (AI) bên thứ ba.
  - Không chia sẻ với bất kỳ tổ chức hay cá nhân bên thứ ba nào khác.

---

### 5. Dữ liệu có được lưu trữ lâu dài không?
- **Phiên làm việc tạm thời (Session-only / In-memory)**: Dữ liệu mô phỏng, điểm giả lập và các kịch bản tùy chỉnh được lưu trữ tạm thời trong bộ nhớ RAM của trang web (`SimulationStore`).
- Tiện ích không lưu dữ liệu học tập vào `chrome.storage`, `localStorage` của website hay `IndexedDB`. Khi bạn đóng tab hoặc tải lại trang web (F5), dữ liệu mô phỏng tạm thời sẽ tự động được giải phóng.

---

### 6. Xuất dữ liệu (Data Export)
- Chức năng xuất dữ liệu (Export CSV) hoàn toàn do người dùng chủ động kích hoạt (User-initiated).
- Tệp CSV được tạo trực tiếp thông qua đối tượng `Blob` trên máy tính của bạn và tải về thiết bị cá nhân.
- Nội dung tệp xuất mặc định chỉ bao gồm thông tin môn học, số tín chỉ và điểm số mô phỏng; không chứa PII của sinh viên.
- Dữ liệu trước khi xuất được xử lý chống tấn công thực thi công thức bảng tính (CSV/Spreadsheet Formula Injection).
- Người dùng tự chịu trách nhiệm về việc lưu trữ và chia sẻ tệp dữ liệu đã tải về.

---

### 7. Quyền truy cập extension yêu cầu
Tiện ích tuân thủ chính sách quyền tối thiểu (Narrowest Permissions) của Chrome Web Store:
- **`activeTab`**: Được sử dụng để cho phép giao diện popup (`popup.html`) kiểm tra xem tab hiện tại có phải là bảng điểm IUH hay không và gửi thông điệp yêu cầu tóm tắt GPA hiển thị trên popup khi người dùng bấm vào biểu tượng tiện ích.
- **Không yêu cầu**: `cookies`, `storage`, `webRequest`, `downloads`, hay các quyền can thiệp lịch sử duyệt web.

---

### 8. Bên thứ ba & Mã nguồn từ xa
- Tiện ích **không tích hợp dịch vụ bên thứ ba**, không sử dụng mạng lưới quảng cáo, không liên kết theo dõi người dùng.
- Tiện ích **không sử dụng bất kỳ công cụ phân tích hành vi nào** (Không Google Analytics, Firebase, Sentry, Mixpanel, Amplitude).
- Tiện ích **không tải mã thực thi từ xa (No remotely hosted code)**: Toàn bộ mã nguồn, logic xử lý và biểu tượng SVG đều được đóng gói sẵn cục bộ trong tiện ích mở rộng.

---

### 9. Tiếp cận an toàn & Bảo mật
- Triển khai mô hình lập trình hàm thuần túy (pure functions) cho các engine tính toán.
- Áp dụng kỹ thuật render chuỗi an toàn (`textContent`, `createElementNS`), phòng ngừa các lỗ hổng chèn mã độc (XSS).
- Ngăn chặn triệt để CSV Formula Injection khi người dùng xuất file sang bảng tính Excel / Google Sheets.

---

### 10. Quyền kiểm soát của người dùng
- Người dùng có thể khôi phục lại bảng điểm về trạng thái dữ liệu gốc bất kỳ lúc nào bằng nút **"Khôi phục tất cả mô phỏng"** trên thanh công cụ hoặc trong popup.
- Người dùng có toàn quyền gỡ cài đặt tiện ích khỏi trình duyệt bất cứ khi nào mà không để lại bất kỳ dữ liệu tồn dư nào trên máy tính.

---

### 11. Tuyên bố từ chối trách nhiệm (Disclaimer)
- IUH GPA Tool là dự án độc lập, mã nguồn mở phục vụ mục đích hỗ trợ học tập cá nhân của sinh viên, **không phải là sản phẩm hay cổng thông tin chính thức của Trường Đại học Công nghiệp TP.HCM (IUH)**.
- Mọi kết quả tính toán, dự báo GPA hay phân tích cảnh báo học phần đều là mô phỏng toán học hỗ trợ tham khảo và không thay thế bảng điểm hoặc quy chế đào tạo chính thức của nhà trường.

---

### 12. Thông tin liên hệ
Mọi thắc mắc, đóng góp ý kiến hoặc phản hồi liên quan đến chính sách quyền riêng tư, vui lòng liên hệ:
- **Tác giả phát triển**: Nguyễn Thành Phát
- **Email**: htphat.fit@gmail.com
- **Mã nguồn**: [https://github.com/Kain6104/IUH-GPA-Tool](https://github.com/Kain6104/IUH-GPA-Tool)
