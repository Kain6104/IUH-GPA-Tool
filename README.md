# Tính Điểm IUH – Công Cụ Mô Phỏng Cho Sinh Viên

**IUH GPA Tool** là tiện ích Chrome giúp sinh viên IUH xem phân tích điểm, thử các kịch bản điểm số và lập kế hoạch học tập trên trang Kết quả học tập. Tiện ích hỗ trợ tham khảo cá nhân; đây không phải sản phẩm chính thức của IUH.

[Cài tiện ích](https://iuh.link/tinhdiem) · [Mã nguồn trên GitHub](https://github.com/Kain6104/IUH-GPA-Tool)

> Tiện ích hiện đã có hơn 600 người dùng theo thống kê do chủ dự án cung cấp. Số liệu có thể thay đổi theo thời gian.

## Mục lục

- [Tổng quan](#tổng-quan)
- [Tính năng](#tính-năng)
- [Cài đặt và sử dụng](#cài-đặt-và-sử-dụng)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Phát triển và kiểm thử](#phát-triển-và-kiểm-thử)
- [Quyền truy cập và quyền riêng tư](#quyền-truy-cập-và-quyền-riêng-tư)
- [Bảo mật](#bảo-mật)
- [Tuyên bố miễn trừ](#tuyên-bố-miễn-trừ)
- [Giấy phép và đóng góp](#giấy-phép-và-đóng-góp)

## Tổng quan

- **Đối tượng:** sinh viên Trường Đại học Công nghiệp TP.HCM (IUH).
- **Môi trường:** Chrome Extension Manifest V3, hoạt động trên trang `https://sv.iuh.edu.vn/ket-qua-hoc-tap.html`.
- **Phiên bản:** `1.1.1` (đọc từ `manifest.json`).
- **Công nghệ:** JavaScript, HTML, CSS; các engine tính toán được đóng gói trong tiện ích.

## Tính năng

Các tính năng dưới đây được đối chiếu với mã nguồn hiện có:

| Nhóm | Tính năng |
| --- | --- |
| GPA và điểm số | Đọc bảng điểm IUH; tính GPA hệ 4 và hệ 10; mô phỏng điểm thành phần/điểm cuối kỳ và tính điểm cuối kỳ cần đạt. |
| Phân tích | Tổng kết theo học kỳ, biểu đồ tiến trình GPA, dự báo GPA, mục tiêu GPA và mô phỏng tác động cải thiện điểm. |
| Kế hoạch | Đồng bộ dữ liệu chương trình khung IUH, theo dõi tiến độ tín chỉ và nhóm học phần, chọn môn và mô phỏng các học kỳ tương lai. |
| Kịch bản và xuất | Tạo, sao chép và so sánh kịch bản; xuất báo cáo XLSX hoặc CSV. |
| Điều khiển | Bật/tắt tiện ích, hoàn tác hoặc khôi phục các mô phỏng. |

Giá trị tính toán phụ thuộc vào dữ liệu đọc được từ trang IUH và các giả định người dùng nhập. Hãy đối chiếu kết quả với thông tin chính thức của nhà trường.

## Cài đặt và sử dụng

### Cài đặt từ Chrome Web Store

Mở [liên kết cài đặt chính thức](https://iuh.link/tinhdiem) và làm theo hướng dẫn trên Chrome Web Store.

### Cài đặt bản mã nguồn (Load unpacked)

1. Tải hoặc clone repository:

   ```bash
   git clone https://github.com/Kain6104/IUH-GPA-Tool.git
   ```

2. Mở `chrome://extensions` trên Chrome và bật **Developer mode**.
3. Chọn **Load unpacked** và mở thư mục `IUH-GPA-Tool` vừa tải.
4. Đăng nhập cổng sinh viên IUH, sau đó mở trang [Kết quả học tập](https://sv.iuh.edu.vn/ket-qua-hoc-tap.html).
5. Dùng bảng điều khiển của tiện ích để xem phân tích và thử các giả định. Điểm mô phỏng không ghi vào kết quả chính thức.

## Cấu trúc dự án

| Đường dẫn | Nội dung |
| --- | --- |
| `manifest.json`, `content.js`, `popup.html`, `popup.js`, `icons/` | Khai báo và giao diện Chrome Extension. |
| `src/adapters/`, `src/parsers/` | Đọc và phân tích trang điểm, chương trình khung IUH. |
| `src/core/`, `src/state/`, `src/ui/`, `src/utils/` | Tính toán, trạng thái mô phỏng, giao diện và tiện ích dùng chung. |
| `tests/` | Kiểm thử tự động và fixture HTML đã được làm sạch. |
| `scripts/` | Kiểm tra và đóng gói bản phát hành. |
| `docs/` | Tài liệu thiết kế, triển khai, nghiên cứu và bản nháp chính sách. |
| `SECURITY_AUDIT.md` | Báo cáo kiểm toán bảo mật của dự án. |
| `release/` | Bản production, tài liệu Chrome Web Store và các gói phát hành đã tạo. |

## Phát triển và kiểm thử

Yêu cầu Node.js tương thích với `package-lock.json` và npm.

```bash
npm ci
npm test
```

`npm test` chạy bộ kiểm thử Node.js trong `tests/`. Các script phát hành hiện có là `node scripts/package-release.js` để tạo gói và `node scripts/verify-release.js` để xác minh bản production/ZIP; chúng thao tác với thư mục và gói trong `release/`.

## Quyền truy cập và quyền riêng tư

- `storage`: lưu trạng thái bật/tắt của tiện ích trong `chrome.storage.local`.
- `https://sv.iuh.edu.vn/*`: cho phép chạy trên cổng IUH và đọc trang chương trình khung bằng yêu cầu `fetch` cùng nguồn khi đồng bộ.
- Content script chỉ được khớp với trang kết quả học tập IUH theo `manifest.json`.
- Mã nguồn giữ dữ liệu mô phỏng trong bộ nhớ phiên làm việc và không ghi bảng điểm vào `chrome.storage`. Việc đồng bộ chương trình khung gửi yêu cầu trực tiếp tới IUH bằng phiên đăng nhập trình duyệt; tiện ích không đọc mật khẩu hay cookie.
- Popup có liên kết Facebook của nhà phát triển; chỉ mở khi người dùng chọn liên kết đó.

Xem thêm [báo cáo kiểm toán bảo mật](SECURITY_AUDIT.md), [tài liệu quyền riêng tư](docs/PRIVACY_POLICY_DRAFT.md) và [khai báo quyền riêng tư cho Chrome Web Store](docs/CHROME_WEB_STORE_PRIVACY_DISCLOSURE.md). Một số tài liệu trong `docs/` được ghi rõ là bản nháp hoặc tài liệu nghiên cứu.

## Bảo mật

Các biện pháp được mô tả trong source gồm giới hạn host tới cổng IUH, không yêu cầu quyền `cookies`/`downloads`/`webRequest`, tạo báo cáo qua Blob trong trình duyệt và dùng API DOM an toàn để hiển thị nội dung. Chi tiết phạm vi và giới hạn kiểm tra nằm trong [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Báo cáo phản ánh lần rà soát được ghi trong tài liệu, không phải cam kết rằng không thể phát sinh lỗ hổng.

## Tuyên bố miễn trừ

IUH GPA Tool là công cụ hỗ trợ học tập độc lập, không phải hệ thống chính thức của IUH. Kết quả mô phỏng chỉ nhằm tham khảo và không thay thế bảng điểm, quy chế hay quyết định của nhà trường. Tiện ích hỗ trợ hiển thị và mô phỏng trên trang; không có chức năng gửi điểm mô phỏng để thay đổi điểm chính thức.

## Giấy phép và đóng góp

Repository hiện chưa có tệp `LICENSE`, vì vậy giấy phép sử dụng lại mã nguồn chưa được chỉ định trong repository. `package.json` có trường license `ISC`, nhưng không có căn cứ để coi đó là giấy phép cho toàn bộ repository. Vui lòng liên hệ chủ dự án trước khi tái sử dụng hoặc phân phối mã nguồn. Chưa có hướng dẫn đóng góp chính thức trong repository.
