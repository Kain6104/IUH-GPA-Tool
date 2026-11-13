# Nghiên cứu trang Kết quả học tập IUH

## 1. Phạm vi và nguồn bằng chứng

Tài liệu này được lập từ bản HTML lưu cục bộ `Kết quả học tập.html`, không truy cập hoặc crawl website đang chạy.

- URL được ghi trong comment `saved from`: `https://sv.iuh.edu.vn/ket-qua-hoc-tap.html`.
- SHA-256 của snapshot đã phân tích: `B9C90FF077C35F4A6A74277A55F2FCBCD61091B8B3D896B46C3786841E90E26C`.
- Snapshot chứa dữ liệu cá nhân và bảng điểm thật. Các quan sát bên dưới chỉ dùng số lượng/tên trường; không sao chép họ tên, mã định danh, ảnh hoặc danh sách môn của sinh viên.
- Thư mục tài nguyên đi kèm `Kết quả học tập_files/` không có trong repository. Snapshot tham chiếu 35 file CSS/JS/ảnh cục bộ nhưng cả 35 đều thiếu. Vì vậy các kết luận về DOM và inline CSS là chắc chắn; các kết luận về computed style/typography đầy đủ thì chưa thể xác nhận.

## 2. Cấu trúc trang liên quan

Đường đi tới bảng:

```text
body
└─ .wrapper
   └─ .main-content
      └─ #full-resize-table.container
         └─ #contnet.main-section-content
            └─ .box-df > .portlet > .portlet-body
               └─ #viewBangDiem.main-wrapper
                  └─ .table-wrapper.tbl-scrollable
                     └─ table#xemDiem_aaa
```

Bảng có các class `table-custom table table-bordered text-center freeze-table`, `width="100%"` và `border-collapse: separate`. Không có nested table bên trong bảng điểm.

Quan sát định lượng của snapshot:

| Thành phần | Số lượng |
|---|---:|
| Dòng header trong `thead` | 3 |
| Dòng trực tiếp trong `tbody` | 104 |
| Dòng tiêu đề học kỳ | 10 |
| Dòng môn học | 54 |
| Dòng tổng kết | 40 |
| Học kỳ có đủ 5 dòng tổng kết | 8 |
| Học kỳ không có dòng tổng kết | 2 |
| Cột logic của bảng | 27 |

Thứ tự học kỳ trong snapshot là tăng dần theo thời gian, nhưng adapter không được mặc định thứ tự này luôn đúng nếu chưa validate.

## 3. Header, rowspan và colspan

Header có ba tầng:

- Tầng 1 chứa 15 ô `th`.
- Các cột đơn dùng `rowspan="3"`.
- Nhóm `Thường xuyên` dùng `colspan="9"`.
- Nhóm `Thực hành` dùng `colspan="5"`.
- Tầng 2 có nhóm `LT Hệ số 1` với `colspan="9"`, cùng 5 cột thực hành dùng `rowspan="2"`.
- Tầng 3 đánh số 1–9 cho các cột thường xuyên.

Mapping 27 cột logic, đánh số từ 1:

| # | Header / ý nghĩa | Marker DOM trong header | Marker DOM trong dòng môn |
|---:|---|---|---|
| 1 | STT | `th[lang="kqht-stt"]` | Không có marker semantic; xác định qua header grid |
| 2 | Mã lớp học phần | `th[lang="kqht-malhp"]` | Không có marker semantic; nội dung nằm trong `div` |
| 3 | Tên môn học/học phần | `th[lang="kqht-tenlhp"]` | Không có marker semantic; cell có `text-start sticky-col` |
| 4 | Số tín chỉ | `th[lang="kqht-stc"]` | Không có marker semantic; xác định qua header grid |
| 5 | Giữa kỳ | `th[lang="kqht-qucd-row_1_2"]` | `td[title="DiemChuyenCan1"]` |
| 6–10 | Thường xuyên 1–5 | `kqht-qucd-diemheso11` … `15` | `DiemHeSo11` … `DiemHeSo15` |
| 11–14 | Thường xuyên 6–9 | `kqht-qucd-diemthuongky6` … `9` | `DiemThuongKy6` … `DiemThuongKy9` |
| 15–19 | Thực hành 1–5 | `kqht-qucd-diemthuchanh1` … `5` | `DiemThucHanh1` … `DiemThucHanh5` |
| 20 | Cuối kỳ | `th[lang="kqht-qucd-row_1_8"]` | `td[title="DiemThi"]` |
| 21 | Điểm tổng kết hệ 10 | `th[lang="kqht-qucd-row_1_10"]` | `td[title="DiemTongKet"]` |
| 22 | Thang điểm 4 | `th[lang="kqht-qucd-diemtinchi"]` | `td[title="DiemTinChi"]` |
| 23 | Điểm chữ | `th[lang="kqht-qucd-diemchu"]` | `td[title="DiemChu"]` |
| 24 | Xếp loại | `th[lang="kqht-qucd-xeploai"]` | `td[title="XepLoai"]` |
| 25 | Ghi chú | `th[lang="kqht-qucd-ghichu"]` | `td[title="GhiChu"]` |
| 26 | TBQT | `th[lang="kqht-qucd-diemtbquatrinh"]` | `td[title="DiemTBQuaTrinh"]` |
| 27 | Đạt | `th[lang="kqht-qucd-isdat"]` | Cell body không có `title`; chứa `.check` khi đạt |

Tên `DiemChuyenCan1` không trùng với nhãn hiển thị `Giữa kỳ`. Adapter phải giữ cả `sourceField` và `displayMeaning`, không tự đổi nghĩa dựa trên tên kỹ thuật.

## 4. Dòng học kỳ, môn học và tổng kết

### 4.1. Dòng học kỳ

Marker ổn định nhất trong snapshot là một cell trực tiếp `td.text-start.row-head`. Cell này có `colspan="27"` và text dạng `HK1 (2022 - 2023)`.

Mỗi dòng học kỳ còn có 26 `td.hidden` rỗng. Đây là filler do HTML phía IUH sinh ra; không được dùng số lượng node con làm nguồn chân lý về số cột.

Selector đề xuất:

```js
const semesterCell = row.querySelector(':scope > td.row-head');
```

Regex text chỉ dùng để parse `semesterKey` sau khi đã nhận diện bằng class, không dùng thay cho marker DOM.

### 4.2. Dòng môn học

Mỗi dòng môn trong snapshot có 27 `td` trực tiếp và cùng một chuỗi 22 thuộc tính `title` từ `DiemChuyenCan1` đến `DiemTBQuaTrinh`.

Nhận diện an toàn:

```js
const isCourseRow = Boolean(
  row.querySelector(':scope > td[title="DiemTongKet"]') &&
  row.querySelector(':scope > td[title="DiemThi"]') &&
  row.querySelector(':scope > td[title="DiemTinChi"]')
);
```

Không nên dùng `row.children.length > 5` vì summary/filler row cũng có nhiều cell.

Đối với STT, mã lớp học phần, tên môn và tín chỉ, body không có `title`, `id` hoặc `data-*`. Cần dựng header grid từ `rowspan`/`colspan`, map các `th[lang]` sang chỉ số logic rồi mới đọc cell tương ứng. Chỉ số cố định là một validation invariant của snapshot, không phải selector chính.

### 4.3. Dòng tổng kết

Mỗi học kỳ có tổng kết sẽ có 5 dòng, mỗi dòng chứa hai cặp label/value. Label có `lang` semantic:

| Dữ liệu | Selector label |
|---|---|
| GPA học kỳ hệ 10 | `[lang="kqht-tkhk-diemtbhocluc"]` |
| GPA học kỳ hệ 4 | `[lang="kqht-tkhk-diemtbtinchi"]` |
| GPA tích lũy hệ 10 | `[lang="kqht-tkhk-diemtbhocluctichluy"]` |
| GPA tích lũy hệ 4 | `[lang="kqht-tkhk-diemtbtinchitichluy"]` |
| Tổng tín chỉ đăng ký | `[lang="kqht-tkhk-tongsotcdangky"]` |
| Tổng tín chỉ tích lũy | `[lang="kqht-tkhk-sotctichluy"]` |
| Tín chỉ đạt học kỳ | `[lang="kqht-tkhk-stcdathocky"]` |
| Tín chỉ không đạt | `[lang="kqht-tkhk-sotckhongdat"]` |
| Xếp loại tích lũy | `[lang="kqht-tkhk-xeploaihocluctichluy"]` |
| Xếp loại học kỳ | `[lang="kqht-tkhk-xeploaihocluc"]` |

Giá trị nằm trong sibling `span` kế tiếp label ở snapshot. Summary row có 33 `td` trực tiếp do kết hợp `colspan` và nhiều cell `.hidden`; không được dựa vào child index hoặc tổng số cell.

Hai học kỳ hè trong snapshot không có summary row. Thiếu summary không đồng nghĩa thiếu môn hoặc lỗi parser.

## 5. Hidden fields, data attributes và class

Ngoài bảng có hai input ẩn:

- `#UID`
- `#CurrentLanguage`

Extension không cần và không được đọc `#UID`. `CurrentLanguage` cũng không cần cho parser vì marker `lang` đã ổn định hơn text hiển thị.

Trong bảng:

- `data-root` xuất hiện trên 21 header cell, giá trị `1` cho leaf/root cố định và `0` cho header nhóm.
- Không có `id` nào bên trong bảng ngoài chính `#xemDiem_aaa`.
- Có 1.460 `td.hidden` filler trong snapshot.
- `cl-red` xuất hiện trên một số ô điểm, là presentation/state hint; không dùng để xác định loại điểm hoặc đậu/rớt.
- Bốn cột đầu dùng `sticky-col`; tên môn còn có `text-start`.

## 6. Responsive behavior quan sát được

- Wrapper `.tbl-scrollable` có `overflow-x: auto`, `white-space: nowrap`, `max-height: 70vh`.
- `thead.header-sticky` được sticky theo biến `--var-diemno-height`.
- Script trang gọi `freezeTable(4)`, làm sticky bốn cột đầu và tính `left` theo width thực tế.
- Khi resize, trang chạy lại `freezeTable(4)`.
- Nếu tổng chiều rộng sticky đạt ít nhất 84% viewport, script gỡ `sticky-col` để tránh chiếm hết màn hình.
- Mỗi `th`/`td` của `.table-custom` có `min-width: 48px` trong inline CSS. Bốn cột đầu có width inline lần lượt khoảng 100/200/200/100 px trong snapshot.

UI extension không nên chèn cột trực tiếp vào bảng vì sẽ làm sai logic sticky, `colspan`, filler cell và phép đo width của trang IUH.

### Quan sát bố cục bằng text

Trang đặt tiêu đề `Kết quả học tập` trong `.portlet`, bảng nằm ngay bên dưới trong một vùng cuộn ngang. Header bảng bám trên khi cuộn; bốn cột nhận diện môn bám trái trên màn hình đủ rộng. Mỗi học kỳ bắt đầu bằng một dải `row-head` chiếm toàn chiều rộng logic, tiếp theo là các dòng môn, rồi tối đa năm dòng thống kê hai cột. Snapshot không cung cấp screenshot raster và thiếu stylesheet đi kèm, nên không ghi nhận màu/kích thước computed ngoài các inline rule đã nêu.

## 7. Mức độ có dữ liệu trong snapshot

Trong 54 dòng môn:

- 54 có cuối kỳ, tổng kết, hệ 4, điểm chữ và xếp loại.
- 50 có giữa kỳ và ít nhất hai điểm thường xuyên đầu.
- 18 có điểm thường xuyên thứ ba.
- Không dòng nào dùng thường xuyên 4–9 trong snapshot, nhưng các cột vẫn tồn tại.
- 26 có ba điểm thực hành đầu; không dòng nào dùng thực hành 4–5.
- `DiemTBQuaTrinh` và `GhiChu` đều trống trong snapshot.
- Có một dòng tín chỉ bằng 0.

Không được suy ra các cột đang trống là vô nghĩa; dữ liệu tương lai có thể sử dụng chúng.

## 8. Logic hiện tại của extension

### 8.1. Cách đọc và sửa dữ liệu

`content.js` tìm bảng bằng `document.getElementById("xemDiem_aaa")`, sau đó:

- Chèn cột checkbox và dropdown loại môn vào chính bảng IUH.
- Biến các ô giữa kỳ, `DiemHeSo1*`, thực hành và cuối kỳ thành `contentEditable`.
- Ghi đè `DiemTongKet`, `DiemTinChi`, `DiemChu`, `XepLoai`, `GhiChu`, cell trạng thái đạt và các summary của IUH.
- Không giữ bản sao immutable của dữ liệu gốc.

Điều này chưa đáp ứng nguyên tắc `originalData`/`simulationData`.

### 8.2. Loại môn và hard-code tên môn

Bốn loại nội bộ:

- `theory`
- `practice`
- `combined`
- `special`

Từ khóa nhận diện `special` là so khớp substring, phân biệt hoa/thường:

```text
Khóa luận; Thực tập; Đồ án; Kiến tập; Giáo dục thể chất
```

Danh sách tự động bỏ chọn:

```text
Giáo dục Quốc phòng; Giáo dục thể chất;
Tiếng Anh 1; Tiếng Anh 2; Chứng chỉ Tiếng Anh
```

Snapshot có 6 dòng khớp danh sách loại trừ. Việc loại trừ dựa vào tên là không đủ an toàn để coi là quy tắc học vụ.

Nếu không khớp từ khóa:

- Có thực hành và thiếu giữa kỳ hoặc thường xuyên → `practice`.
- Có thực hành và có giữa kỳ hoặc thường xuyên → `combined`.
- Còn lại → `theory`.

### 8.3. Công thức hard-code

Ký hiệu:

- `M`: giữa kỳ (`DiemChuyenCan1`), giá trị thiếu bị biến thành 0.
- `R`: trung bình các ô không rỗng `DiemHeSo11…15`.
- `P`: trung bình các ô không rỗng `DiemThucHanh1…5`.
- `F`: cuối kỳ (`DiemThi`), giá trị thiếu bị biến thành 0.

Công thức hiện tại:

```text
special:  total = F
practice: total = P
theory:   total = 0.30*M + 0.20*R + 0.50*F
combined: theoryPart = 0.30*M + 0.20*R + 0.50*F
          total = (2*theoryPart + P) / 3
```

Kết quả bị clamp vào `[0, 10]`, làm tròn 3 chữ số thập phân, rồi hiển thị 1 chữ số thập phân.

Lưu ý quan trọng:

- Code bỏ qua hoàn toàn `DiemThuongKy6…9` dù DOM có các cột này.
- HTML không chứa metadata trọng số theo từng môn.
- Với heuristic hiện tại, công thức cho kết quả cách tổng kết hiển thị không quá 0,15 ở 53/54 dòng snapshot; 51/54 dòng cách không quá 0,051. Đây chỉ là tính nhất quán với mẫu đã lưu, không phải bằng chứng quy chế chính thức hoặc công thức áp dụng cho mọi môn.
- Một dòng chứng chỉ tín chỉ 0 bị nhận nhầm là `theory`, khiến công thức mô phỏng chỉ bằng khoảng một nửa tổng kết gốc.

### 8.4. Quy đổi điểm và điều kiện rớt

`convertScore` đang hard-code:

| Điều kiện trong code | Hệ 4 | Chữ | Xếp loại |
|---|---:|---|---|
| `s >= 8.9500001` | 4.0 | A+ | Xuất sắc |
| `s >= 8.4500001` | 3.8 | A | Giỏi |
| `s >= 7.9500001` | 3.5 | B+ | Khá |
| `s >= 6.9500001` | 3.0 | B | Khá |
| `s >= 5.9500001` | 2.5 | C+ | Trung bình |
| `s >= 5.4500001` | 2.0 | C | Trung bình |
| `s >= 4.9500001` | 1.5 | D+ | TB Yếu |
| `s >= 3.9500001` | 1.0 | D | Yếu |
| Còn lại | 0.0 | F | Kém |

Các epsilon khiến đúng `8.95`, `8.45`, ... không đạt nhánh phía trên. Snapshot chỉ quan sát được tổng kết một chữ số thập phân và không có mẫu D+/F, nên không thể xác nhận đầy đủ boundary chính thức.

Điều kiện rớt bổ sung:

- Tổng kết `< 4.0`.
- `theory` hoặc `combined` có cuối kỳ `< 3`.
- Riêng `theory` có giữa kỳ bằng 0.

Các điều kiện này không được chứng minh bởi metadata trong HTML snapshot.

### 8.5. GPA kỳ và tích lũy

Với môn được chọn và được coi là đủ dữ liệu:

```text
GPA10 = sum(total10 * credits) / sum(credits)
GPA4  = sum(score4 * credits) / sum(credits)
```

- Môn có tín chỉ `<= 0` không được cộng.
- Môn rớt vẫn ở mẫu số GPA; tín chỉ đạt/rớt phân loại bằng `score4 > 0`.
- Tích lũy là cộng tuần tự tất cả dòng đang chọn trong DOM; không có logic học lại, thay thế điểm, pass/fail, miễn học hoặc quy tắc đặc thù.
- Tên môn trong danh sách loại trừ bị bỏ khỏi cả GPA kỳ lẫn tích lũy.
- Code ghi đè summary của IUH; nếu không tìm thấy summary trong vài sibling kế tiếp thì chèn summary giả.

Quan sát snapshot cho thấy trung bình trọng số từ điểm tổng kết đã làm tròn thường lệch nhẹ so với summary IUH, và có ít nhất một học kỳ lệch lớn. Nguyên nhân có thể là độ chính xác nội bộ, môn học lại hoặc quy tắc học vụ không có trong DOM; chưa đủ bằng chứng để kết luận nguyên nhân. Đây là lý do không được ghi đè hoặc gắn nhãn kết quả mô phỏng là kết quả IUH.

### 8.6. Kiểm tra đủ dữ liệu hiện tại

Nếu `DiemTongKet` gốc không rỗng, `isDataComplete` trả về `true` ngay. Sau đó, nếu người dùng xóa một thành phần, parser biến ô thiếu thành 0 và vẫn tính lại. Với dòng chưa có tổng kết:

- `theory` chỉ yêu cầu giữa kỳ và cuối kỳ, không yêu cầu thường xuyên.
- `combined` yêu cầu giữa kỳ, cuối kỳ và ít nhất một thực hành, không yêu cầu thường xuyên.
- `practice` chỉ cần ít nhất một thực hành.
- `special` chỉ cần cuối kỳ.

Đây là hành vi fail-open, có nguy cơ tạo kết quả giả khi dữ liệu thiếu.

### 8.7. Các rủi ro tính đúng đã xác định

- Selector điểm thường xuyên chỉ lấy `DiemHeSo1*`, bỏ sót `DiemThuongKy6…9`.
- Tên môn và tín chỉ được đọc bằng child index sau khi code tự chèn cột; thay đổi DOM nhỏ có thể làm lệch mapping.
- `children.length > 5` không phải điều kiện semantic để nhận diện course row.
- Scan summary theo số sibling cố định không dừng tại semester boundary; cấu trúc học kỳ ngắn có thể làm summary của kỳ sau bị nhận nhầm.
- `parseFloat` chấp nhận input chỉ có prefix là số, còn input thiếu bị quy thành 0 ở nhiều nhánh.
- Grade boundary và rank boundary dùng epsilon lạ (`8.9500001`, `3.59500001`, ...), gây hành vi bất ngờ tại đúng biên.
- GPA dùng điểm đã hiển thị/làm tròn, trong khi IUH có thể tính từ precision hoặc rule khác.
- Không xử lý học lại, thay thế điểm, miễn học, pass/fail hoặc course equivalence.
- Auto-exclusion dựa trên substring tên môn, phân biệt hoa/thường và không có provenance quy chế.
- Sau mô phỏng, ghi chú gốc có thể bị xóa và summary chính thức bị thay bằng số mô phỏng.
- README gọi công thức là “chuẩn IUH” và quảng bá export Excel, nhưng source/snapshot không chứng minh tuyên bố thứ nhất và code hiện không có chức năng thứ hai.

## 9. Selector contract đề xuất cho `IUHPageAdapter`

Selector ưu tiên:

```js
const SELECTORS = {
  table: '#xemDiem_aaa',
  headerRows: ':scope > thead > tr',
  headerCells: ':scope > th[lang]',
  bodyRows: ':scope > tbody > tr',
  semesterCell: ':scope > td.row-head',
  midterm: ':scope > td[title="DiemChuyenCan1"]',
  finalExam: ':scope > td[title="DiemThi"]',
  total10: ':scope > td[title="DiemTongKet"]',
  score4: ':scope > td[title="DiemTinChi"]',
  letter: ':scope > td[title="DiemChu"]',
  classification: ':scope > td[title="XepLoai"]',
  note: ':scope > td[title="GhiChu"]',
  processAverage: ':scope > td[title="DiemTBQuaTrinh"]'
};
```

Các nhóm điểm phải dùng allow-list cụ thể:

```text
DiemHeSo11…15
DiemThuongKy6…9
DiemThucHanh1…5
```

Không dùng selector prefix duy nhất rồi giả định mọi member có cùng quy tắc. Không dùng `:nth-child(...)` cho business mapping.

## 10. Thiết kế adapter và fail-safe

```text
IUHPageAdapter
├─ isCompatiblePage()
├─ detectColumns()
├─ validateStructure()
├─ parseSemesters()
└─ parseCourse(row, columnMap)
```

### `isCompatiblePage()`

- Parse URL bằng `new URL(location.href)`.
- Yêu cầu `protocol === "https:"`, `hostname === "sv.iuh.edu.vn"`, `pathname === "/ket-qua-hoc-tap.html"`.
- Yêu cầu đúng một `#xemDiem_aaa` có `thead` và `tbody`.

### `detectColumns()`

- Dựng ma trận leaf-column từ cả 3 header row, tôn trọng `rowspan`/`colspan`.
- Map cột bằng `lang` exact.
- Xác nhận 27 leaf columns trong fixture hiện tại, nhưng trả lỗi compatibility thay vì tự ép nếu số cột thay đổi.
- Cross-check `title` của các score cell trong ít nhất một dòng môn và sau đó mọi dòng môn.

### `parseSemesters()`

- Duyệt direct child row theo state machine.
- `td.row-head` mở học kỳ mới.
- Course row phải nằm trong một học kỳ đã mở.
- Summary gắn bằng các `lang` exact.
- Dòng visible không nhận diện được là lỗi cấu trúc; filler `.hidden` có thể bỏ qua sau validation.

### `parseCourse()`

- Đọc text bằng `textContent`, normalize whitespace, giữ cả `rawText` và parsed value.
- Số phải match toàn bộ chuỗi, ví dụ `^(?:10|\d)(?:[,.]\d+)?$`; không dùng `parseFloat` permissive.
- Không clamp input sai thành giá trị hợp lệ. Trả lỗi `INVALID_SCORE`, `MISSING_REQUIRED_FIELD` hoặc `AMBIGUOUS_COLUMN`.
- Không suy ra loại môn từ tên trong adapter. Adapter chỉ trả dữ liệu quan sát; grading rule xử lý ở tầng khác.

### `validateStructure()`

Validation phải kiểm tra:

- Các header marker bắt buộc tồn tại đúng một lần.
- Header grid không overlap và mapping body nhất quán.
- Course row có các marker kết quả cốt lõi đúng một lần.
- Tín chỉ/điểm hợp lệ hoặc được đánh dấu missing; không tự đổi missing thành 0.
- Không có hai học kỳ cùng key mà không có chiến lược disambiguation.
- Không có dòng môn nằm ngoài semester.
- Summary thiếu được ghi nhận là `missing`, không tự tìm xuyên sang học kỳ kế tiếp.

Nếu bất kỳ invariant bắt buộc nào không đạt, dừng toàn bộ tính toán và hiển thị nguyên văn:

> Không thể đọc chính xác cấu trúc bảng điểm hiện tại. Công cụ đã tạm dừng tính toán để tránh đưa ra kết quả sai.

Diagnostics chỉ ghi mã lỗi/cấu trúc, tuyệt đối không log tên sinh viên, mã sinh viên, tên môn hoặc điểm.

## 11. Edge cases cần test

- Học kỳ không có summary.
- Môn tín chỉ 0.
- Môn chỉ có cuối kỳ; chỉ có thực hành; có cả lý thuyết/thực hành.
- Điểm thường xuyên 6–9 có dữ liệu.
- Ít hơn hoặc nhiều hơn số assessment thường thấy.
- Ô trống, dấu phẩy thập phân, khoảng trắng, `0`, `10`, input không hợp lệ.
- D+/F và đúng boundary quy đổi.
- Cuối kỳ dưới ngưỡng nhưng tổng kết trên ngưỡng.
- Môn trùng mã/tên giữa các học kỳ hoặc học lại.
- Summary dùng precision cao hơn điểm hiển thị.
- Header đổi ngôn ngữ hiển thị nhưng giữ `lang`.
- Header thêm/bớt/đổi `rowspan` hoặc `colspan`.
- Nhiều bảng hoặc marker duplicate.
- Dòng khảo sát/hành động được chèn vào giữa các môn.
- Re-render bảng bởi script IUH sau khi extension đã khởi tạo.

## 12. Những phần chưa xác định chắc chắn

- Công thức chính thức và trọng số riêng của từng môn.
- Quy tắc thay thế điểm khi học lại, miễn học, pass/fail và môn không tính GPA.
- Boundary quy đổi đầy đủ, đặc biệt D+/F và điều kiện điểm liệt.
- Precision gốc IUH dùng để tính summary.
- Typography, spacing và component style đầy đủ do toàn bộ CSS liên kết bị thiếu.
- Độ ổn định dài hạn của `title`, `lang`, `#xemDiem_aaa` trên các phiên bản IUH khác.
- Ý nghĩa nghiệp vụ chính xác của `DiemTBQuaTrinh` khi có dữ liệu.

Các điểm chưa chắc chắn phải được giải quyết bằng fixture bổ sung hoặc tài liệu học vụ có thẩm quyền trước khi biến thành rule mặc định.


## 13. Semester Summary Rendering Contract (Phase 6A.5.3)

### 13.1. Nguồn gốc cấu trúc và vấn đề Root Cause trong bảng IUH
Trong bảng Kết quả học tập gốc của IUH (table `#xemDiem_aaa`), mỗi học kỳ chính kết thúc bằng 5 dòng tổng kết (summary rows), mỗi dòng có cấu trúc gồm:
- Ô 1 (`td[colspan="2"]`): Chứa nhãn và giá trị của chỉ số thứ nhất (ví dụ: `[lang="kqht-tkhk-diemtbhocluc"]`).
- Ô 2 (`td[colspan="2"]`): Chứa nhãn và giá trị của chỉ số thứ hai (ví dụ: `[lang="kqht-tkhk-diemtbtinchi"]`).
- Ô 3 (`td.hidden[colspan="23"]`): Filler cell để đủ 27 cột theo thead gốc.

Khi extension chèn thêm 2 cột điều khiển vào thead:
1. **Cột 1**: Chọn (`.iuh-gpa-col-select`, width 70px, `position: sticky; left: 0`, `z-index: 15`)
2. **Cột 2**: Loại môn (`.iuh-gpa-col-type`, width 180px, `position: sticky; left: 70px`, `z-index: 15`)
3. **Cột 5**: Tên môn học (`.iuh-gpa-col-course-name`, width 310px, `position: sticky; left: 250px`, `z-index: 15`)

**Nguyên nhân gốc rễ (Root Cause Audit):**
- Ô 1 của summary row chiếm 2 cột đầu (0px - 250px).
- Ô 2 của summary row bắt đầu từ 250px (cột thứ 3 trong dòng summary).
- Cột 5 của thead và các hàng môn học (Tên môn) được neo cố định (`position: sticky; left: 250px; z-index: 15; background: #fff`).
- Hậu quả: Toàn bộ Ô 2 của cả 5 dòng summary (chứa GPA hệ 4, GPA tích lũy hệ 4, TC tích lũy, TC nợ, Xếp loại học kỳ) bị cột Tên môn đè lên và che khuất khi render hoặc cuộn ngang.
- Khi áp nhầm các class sticky môn học (`.iuh-gpa-cell-select`, `.iuh-gpa-cell-type`, `.iuh-gpa-cell-name`) vào dòng summary, cấu trúc bảng bị vỡ.

### 13.2. Chuẩn Rendering Contract cho Semester Summary (Actual & Future)

#### Cấu trúc DOM chuẩn hóa cho học kỳ tương lai (Future Semester Summary):
Mỗi học kỳ tương lai có đúng 5 dòng tổng kết chuẩn, loại bỏ hoàn toàn dòng custom summary một dòng cũ:
```html
<tr class="iuh-gpa-future-row iuh-gpa-semester-summary-row iuh-gpa-extension" data-iuh-gpa-extension="true">
  <td colspan="29" class="iuh-gpa-semester-summary-host">
     <div class="iuh-gpa-semester-summary-sticky">
        <div class="iuh-gpa-summary-pair">
           <div class="iuh-gpa-summary-item">
              <span class="iuh-gpa-summary-label">Điểm trung bình học kỳ hệ 10:</span>
              <span class="iuh-gpa-future-summary-value">6,7667</span>
           </div>
           <div class="iuh-gpa-summary-item">
              <span class="iuh-gpa-summary-label">Điểm trung bình học kỳ hệ 4:</span>
              <span class="iuh-gpa-future-summary-value">2,3333</span>
           </div>
        </div>
     </div>
  </td>
</tr>
```

#### Bảng đối chiếu 5 dòng tổng kết giữa Actual và Future:
| Dòng | Chỉ số 1 (Trái) | Chỉ số 2 (Phải) |
|---|---|---|
| **Dòng 1** | Actual: Điểm trung bình học kỳ hệ 10<br>Future: Điểm trung bình học kỳ hệ 10: | Actual: Điểm trung bình học kỳ hệ 4<br>Future: Điểm trung bình học kỳ hệ 4: |
| **Dòng 2** | Actual: Điểm trung bình tích lũy<br>Future: Điểm trung bình tích lũy dự kiến: | Actual: Điểm trung bình tích lũy (hệ 4)<br>Future: Điểm trung bình tích lũy dự kiến (hệ 4): |
| **Dòng 3** | Actual: Tổng số tín chỉ đã đăng ký<br>Future: Tổng số tín chỉ kế hoạch: | Actual: Tổng số tín chỉ tích lũy<br>Future: Tổng số tín chỉ tích lũy dự kiến: |
| **Dòng 4** | Actual: Tổng số tín chỉ đạt<br>Future: Tổng số tín chỉ đạt dự kiến: | Actual: Tổng số tín chỉ nợ tính đến hiện tại<br>Future: Tổng số tín chỉ chưa đạt dự kiến: |
| **Dòng 5** | Actual: Xếp loại học lực tích lũy<br>Future: Xếp loại học lực tích lũy dự kiến: | Actual: Xếp loại học lực học kỳ<br>Future: Xếp loại học lực học kỳ dự kiến: |

### 13.3. Quy tắc Stacking và Horizontal Scroll
1. `.iuh-gpa-semester-summary-sticky` có:
   - `position: sticky; left: 0;`
   - `z-index: 16;` (cao hơn các cell sticky môn học có `z-index: 15`, nhưng thấp hơn CompanionBar có `z-index: 950` và Modal có `z-index: 1000`).
   - `background-color: #FFFFFF !important;` (đục tuyệt đối, chống xuyên thấu).
   - Layout grid: `grid-template-columns: minmax(280px, auto) minmax(300px, auto);` đảm bảo nhãn và giá trị không bị wrap vô lý.
2. Dòng học kỳ thực tế: Được bổ sung các class `.iuh-gpa-actual-summary-cell-1` (`left: 0; z-index: 16`) và `.iuh-gpa-actual-summary-cell-2` (`left: 290px; z-index: 16`) để thoát khỏi vùng đè của cột Tên môn và bảo lưu chính xác giá trị text gốc.
3. Độ chính xác số học: Mọi giá trị GPA mô phỏng hiển thị 4 chữ số thập phân (formatAverage4), giữ nguyên raw float trong tính toán.
