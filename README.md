# Tính Điểm IUH – Công Cụ Mô Phỏng Cho Sinh Viên

**IUH GPA Tool** là tiện ích Chrome dành cho sinh viên IUH để theo dõi kết quả học tập, phân tích GPA, thử các kịch bản điểm số và lên kế hoạch học tập.

[Cài đặt từ Chrome Web Store](https://iuh.link/tinhdiem) · [GitHub](https://github.com/Kain6104/IUH-GPA-Tool)

> Đã có hơn 600 người dùng.

IUH GPA Tool là dự án độc lập, không phải sản phẩm chính thức của IUH.

## Tính năng

- Đọc bảng điểm trên cổng sinh viên IUH; tính GPA hệ 4 và hệ 10.
- Mô phỏng điểm thành phần và điểm thi cuối kỳ; xem điểm cần đạt để qua môn hoặc đạt mức điểm mong muốn.
- Lập kế hoạch GPA và các học kỳ tương lai; theo dõi tín chỉ, học phần bắt buộc và nhóm tự chọn theo chương trình khung.
- Xem tổng kết học kỳ, biểu đồ tiến trình GPA và dự báo GPA.
- Tạo và so sánh các kịch bản; xuất báo cáo XLSX hoặc CSV.

## Cài đặt và sử dụng

### Chrome Web Store

Mở [trang cài đặt](https://iuh.link/tinhdiem) và chọn **Thêm vào Chrome**.

### Cài từ mã nguồn

1. Clone repository:

   ```bash
   git clone https://github.com/Kain6104/IUH-GPA-Tool.git
   ```

2. Mở `chrome://extensions`, bật **Developer mode** rồi chọn **Load unpacked**.
3. Chọn thư mục `IUH-GPA-Tool` vừa tải.
4. Đăng nhập cổng sinh viên IUH và mở trang Kết quả học tập để dùng tiện ích.

Điểm mô phỏng chỉ hiển thị trong tiện ích, không làm thay đổi điểm chính thức trên hệ thống IUH.

## Phát triển

Dự án dùng JavaScript, HTML, CSS và Chrome Extension Manifest V3. Bộ test chạy bằng Node.js và `node:test`.

```bash
npm ci
npm test
```

Đóng gói và kiểm tra bản phát hành:

```bash
node scripts/package-release.js
node scripts/verify-release.js
```

## Cấu trúc

- `src/`: bộ phân tích trang IUH, các engine GPA, lập kế hoạch, trạng thái và giao diện.
- `tests/`: kiểm thử và dữ liệu fixture đã làm sạch.
- `scripts/`: đóng gói và xác minh bản phát hành.
- `docs/`, `SECURITY_AUDIT.md`: tài liệu dự án và bảo mật.
- `release/`: bản production và gói phát hành.

## Quyền riêng tư và giấy phép

Tiện ích lưu trạng thái bật/tắt trong `chrome.storage.local`. Khi đồng bộ chương trình khung, tiện ích gửi yêu cầu cùng nguồn tới cổng IUH bằng phiên đăng nhập hiện có. Dữ liệu điểm và mô phỏng được giữ trong bộ nhớ phiên; tiện ích không đọc mật khẩu hay cookie.

Repository chưa có tệp `LICENSE`.
