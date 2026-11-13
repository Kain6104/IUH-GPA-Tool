# Design system cho module IUH GPA

## 1. Nguyên tắc

UI mới phải là một module đồng hành với trang IUH, không redesign trang và không giả làm dữ liệu chính thức của IUH.

- Dùng palette xanh IUH và nền trung tính quan sát được.
- Không dùng animated gradient tím/xanh, glassmorphism hoặc blob trang trí như popup hiện tại.
- Kết quả gốc và kết quả mô phỏng phải có nhãn, vùng hiển thị và trạng thái thị giác riêng.
- Không ghi đè text/màu/trạng thái trong bảng gốc.
- Ưu tiên rõ ràng, đọc nhanh, tương phản tốt và hoạt động trên viewport hẹp.

## 2. Mức độ bằng chứng

Do 13 stylesheet liên kết trong HTML snapshot đều trỏ tới thư mục không tồn tại, token được chia thành:

- **Observed:** xuất hiện trực tiếp trong HTML/inline CSS hoặc asset repository.
- **Proposed:** token extension đề xuất từ palette observed, không được gọi là token chính thức của IUH.
- **Unknown:** không đủ dữ liệu để xác nhận.

### Audit popup hiện tại

Popup hiện có width 380 px, min-height 480 px và dùng animated four-color gradient `#EE7752 → #E73C7E → #23A6D5 → #23D5AB`, glass panel, blob tím `#A855F7`, gradient xanh/lục cho button, gradient xanh/tím cho số GPA và animation icon nổi. Title còn ghi `VIP Edition`. Các lựa chọn này không xuất phát từ style trang IUH và tạo cảm giác một ứng dụng khác; chúng nên được thay ở phase UI, không phải trong audit này.

## 3. Màu observed

| Vai trò quan sát được | Giá trị | Nguồn / ghi chú |
|---|---|---|
| Brand blue | `#153898` | Màu opaque chủ đạo trong `icons/iuh.png` |
| Brand amber | `#F9B200` | Màu opaque nhấn trong `icons/iuh.png` |
| Default sticky table header | `#F3F7F9` | Inline CSS theme mặc định |
| Surface | `#FFFFFF` | Sticky cells, caption, dropdown |
| Soft surface | `#F9F9F9` | Dropdown content |
| Border cool | `#E7ECF0` | Hover border |
| Border neutral | `#DDDDDD` | Divider |
| Interactive blue | `#1DA1F2` | Hover của action trong inline CSS |
| Warning yellow | `#FFD43B` | Icon warning |
| Success green | `#2ECC71` | Có trong CSS nhưng đang comment; chỉ là bằng chứng yếu |
| Danger | keyword `red` | Điểm/cảnh báo; chưa có hex canonical |
| Heading candidate | `#0E2863` | Có trong comment CSS, không phải style active |
| Dialog text | `#0E5777` | Inline template script của trang |
| Overlay | `#607D8B2B` | Loading overlay trong script trang |
| Spinner blue | `#397FAE` | Loading spinner trong script trang |
| Shadow | `rgba(0, 0, 0, 0.2)` | Dropdown shadow |

Các màu `#384289`, `#705697`, `#39527B`, `#657580`, `#33B5E5` là các theme table thay thế được khai báo trong HTML. Marker theme cho thấy `dashboard-default` là lựa chọn current trong snapshot, nhưng stylesheet/script thiếu nên không xác nhận được computed theme cuối cùng.

## 4. Token đề xuất cho extension

```css
:host {
  --iuh-primary-700: #153898;
  --iuh-primary-600: #2349a6;
  --iuh-primary-100: #e8eefc;
  --iuh-accent-500: #f9b200;

  --iuh-surface-page: #f3f7f9;
  --iuh-surface-card: #ffffff;
  --iuh-surface-muted: #f9f9f9;

  --iuh-border: #d9e1e8;
  --iuh-border-strong: #c3ced8;
  --iuh-text: #172033;
  --iuh-text-muted: #5f6b7a;

  --iuh-success: #218739;
  --iuh-warning: #9a6700;
  --iuh-warning-bg: #fff5cc;
  --iuh-danger: #b42318;
  --iuh-danger-bg: #fff0ee;
  --iuh-info: #236fa1;

  --iuh-radius-sm: 4px;
  --iuh-radius-md: 8px;
  --iuh-radius-lg: 12px;
  --iuh-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
  --iuh-shadow-md: 0 8px 16px rgba(0, 0, 0, 0.12);
}
```

Các màu semantic được làm tối hơn màu raw quan sát được để dùng cho text trên nền sáng và cần được kiểm tra WCAG trong implementation. Brand amber dùng cho accent, không dùng làm body text trên nền trắng.

## 5. Typography

### Observed

- Snapshot chỉ có inline `font-size: 12px` cho action dropdown và `1em` cho icon.
- HTML dùng Font Awesome cho icon.
- Không có khai báo `font-family` trong inline CSS.
- Font thực tế nằm trong các stylesheet bị thiếu, vì vậy chưa xác định được typography chính thức.

### Proposed

- UI nhúng trong trang: `font-family: inherit` để hòa với IUH.
- Popup extension: `system-ui, -apple-system, "Segoe UI", Arial, sans-serif`.
- Base size 14 px; helper 12 px; label 13 px; section title 16 px; page/module title 20 px.
- Body line-height 1.5; label/button 1.3.
- Dùng weight 400/500/600; tránh toàn bộ giao diện in đậm hoặc uppercase.
- Số GPA dùng `font-variant-numeric: tabular-nums`.

## 6. Spacing, border, radius và shadow

Inline CSS quan sát được dùng `.25rem`, padding `12px 16px`, radius 3 px và shadow `0 8px 16px rgba(0,0,0,.2)`.

Scale đề xuất dựa trên bước 4 px:

| Token | Giá trị | Dùng cho |
|---|---:|---|
| `space-1` | 4 px | Khoảng icon/label nhỏ |
| `space-2` | 8 px | Khoảng control nội bộ |
| `space-3` | 12 px | Padding compact |
| `space-4` | 16 px | Padding card/control chuẩn |
| `space-5` | 20 px | Khoảng section |
| `space-6` | 24 px | Padding panel rộng |

Border mặc định 1 px. Radius 4 px cho input/button nhỏ, 8 px cho card/control, 12 px tối đa cho panel. Không dùng radius 20 px/circle tùy tiện. Shadow chỉ dùng cho panel nổi; table/card thường dùng border thay vì shadow lớn.

## 7. Components

### Module container

- Đặt trước hoặc cạnh bảng trong `#viewBangDiem`, không chèn cột vào bảng.
- Nền trắng, border `--iuh-border`, top accent 3 px `--iuh-primary-700`.
- Header gồm logo nhỏ, tên công cụ và badge `Mô phỏng cục bộ`.
- Có nút thu gọn trên mobile.

### Data provenance banner

Hai trạng thái bắt buộc:

- `Dữ liệu gốc từ trang IUH` — read-only, icon khóa.
- `Kịch bản mô phỏng` — editable, nền primary-100 hoặc warning-bg nhẹ.

Không dùng chỉ màu để phân biệt; luôn có text/icon.

### Button

- Primary: nền `--iuh-primary-700`, chữ trắng, không gradient.
- Secondary: nền trắng, border primary, chữ primary.
- Destructive/reset: nền trắng hoặc danger-bg, chữ danger; yêu cầu nhãn rõ.
- Min height 36 px; focus ring 2 px có offset; disabled không chỉ giảm opacity mà còn đổi cursor và giữ contrast.

### Input điểm

- Dùng `<input inputmode="decimal">`, không dùng `contentEditable` trên cell IUH.
- Width đủ cho `10,00`; số căn phải; label gắn bằng `for`/`id`.
- Hiển thị raw/original bên cạnh hoặc trong helper text, không thay thế giá trị gốc.
- Invalid input có message cụ thể; không tự clamp âm hoặc >10.

### Card thống kê

- Ưu tiên 2–4 số liệu chính, không dùng số cực lớn hoặc gradient text.
- Nhãn nêu rõ `Mô phỏng`; precision và đơn vị nhất quán.
- GPA hệ 10 và hệ 4 không dùng cùng một label mơ hồ.

### Table/semester section

- Nếu cần danh sách riêng, dùng sticky header ở panel extension, không tác động `.sticky-col` của IUH.
- Semester header dùng nền `#F3F7F9`, chữ primary-700, border dưới.
- Trên mobile chuyển mỗi môn thành row compact hoặc horizontal scroll có nhãn; không ép bảng IUH rộng hơn.

### Alert

- Info: giải thích local-only.
- Warning: công thức chưa được xác minh hoặc dữ liệu thiếu.
- Danger/fail-safe: dừng tính toán, không cung cấp con số cũ.
- Success: chỉ dùng cho thao tác local hoàn tất, không ngụ ý IUH đã lưu dữ liệu.

Thông báo fail-safe chuẩn:

> Không thể đọc chính xác cấu trúc bảng điểm hiện tại. Công cụ đã tạm dừng tính toán để tránh đưa ra kết quả sai.

## 8. Iconography và motion

- Tái sử dụng ngôn ngữ icon đơn sắc tương thích Font Awesome hoặc một bộ SVG nội bộ duy nhất.
- Không tải icon/font từ CDN.
- Icon chỉ hỗ trợ label, không thay label cho thao tác quan trọng.
- Chuyển động 120–180 ms cho hover/collapse; tôn trọng `prefers-reduced-motion`.
- Loại bỏ animation nền 15 giây và icon nổi liên tục của popup hiện tại.

## 9. Isolation với CSS trang IUH

Khuyến nghị dùng một host duy nhất, ví dụ `#iuh-gpa-tool-root`, kèm Shadow DOM để tránh Bootstrap/Kendo/global CSS làm vỡ UI. Token phải được khai báo rõ trong shadow root; typography có thể nhận `font-family: inherit` từ host.

Nếu không dùng Shadow DOM, mọi class phải prefix `iuh-gpa-`; không đặt rule global cho `table`, `button`, `input`, `body`, `.card`, `.header` hoặc `.container`.

Không chỉnh các class/site variable sau:

```text
.sticky-col
.header-sticky
.tbl-scrollable
.table-custom
--var-diemno-height
```

## 10. Accessibility và responsive checklist

- Contrast text tối thiểu 4.5:1; large text 3:1.
- Keyboard focus luôn nhìn thấy.
- Mọi input có accessible name và error liên kết bằng `aria-describedby`.
- Không biểu đạt đạt/rớt chỉ bằng đỏ/xanh.
- Panel không che table, menu hoặc popup IUH.
- Ở viewport hẹp, action xếp dọc; target ít nhất 36×36 px.
- Dùng live region `polite` cho kết quả mô phỏng; `assertive` chỉ cho fail-safe.
- Không tự động focus hoặc scroll người dùng ra khỏi vị trí hiện tại.

## 11. Những token chưa được xác nhận

- Font family/weight chính thức.
- Màu text primary/secondary từ stylesheet thật.
- Button/input styles thật của theme current.
- Radius/shadow chuẩn ngoài các inline component nhỏ.
- Breakpoint responsive chính thức.

Không được điền các token này bằng phỏng đoán rồi ghi là “IUH official”. Implementation nên dùng token proposed ở trên và cập nhật khi có bộ CSS local hợp lệ.
