# IUH Curriculum Research (Chương trình khung)

> Tài liệu phân tích cấu trúc DOM, ngữ nghĩa dữ liệu và phương thức đồng bộ Chương trình khung (CTK) của Cổng thông tin sinh viên IUH (`sv.iuh.edu.vn`).
> Dựa trên nghiên cứu thực nghiệm trực tiếp từ snapshot `Chương trình khung.html` (URL live: `https://sv.iuh.edu.vn/chuong-trinh-khung.html`).

---

## 1. Root Container

- **ID Selector**: `#viewChuongTrinhKhung`
- **Vị trí**: Nằm bên trong thẻ `<div class="container">` / main content của trang `chuong-trinh-khung.html`.
- **Phạm vi an toàn**: Mọi thao tác truy vấn của `IUHCurriculumAdapter` **chỉ được thực thi bên trong root này** (`root.querySelector`), tuyệt đối không query mù quáng toàn bộ `document`.
- **Fail-safe**: Nếu trang không có phần tử `#viewChuongTrinhKhung`, adapter trả về `compatible: false` và mã lỗi `ROOT_NOT_FOUND`.

---

## 2. Table Structure

- **Thẻ**: `table.table-custom.table.table-bordered.text-center.no-footer.dtr-inline`
- **Cấu trúc**: Gồm một thẻ `<thead>` duy nhất (1 dòng tiêu đề với 10 cột) và thẻ `<tbody>` chứa các dòng học kỳ, nhóm môn và môn học.
- **Tổng số dòng**: Trong snapshot mẫu gồm 120 dòng (9 học kỳ, 13 nhóm bắt buộc/tự chọn, 92 dòng học phần, 1 dòng khoảng trắng giữa các kỳ, và 3 dòng tổng kết tín chỉ ở cuối).

---

## 3. Header Semantics (`<thead>`)

Bảng CTK IUH sử dụng thuộc tính `lang` trên thẻ `<th>` làm semantic marker chính:

| Cột (Index) | Thuộc tính `lang` | Tên cột (Text) | Ý nghĩa nghiệp vụ |
|---|---|---|---|
| 0 | `""` (trống) | STT | Số thứ tự trong nhóm môn |
| 1 | `ctk-tenmhhp` | Tên môn học/Học phần | Tên học phần theo chương trình khung |
| 2 | `ctk-mahp` | Mã Học phần | Mã học phần chuẩn 10 chữ số (vd: `4203002009`) |
| 3 | `""` (trống) | Học phần | Mã tiên quyết/học trước (vd: `003848(a)`) |
| 4 | `ctk-stc` | Số TC | Số tín chỉ của học phần |
| 5 | `ctk-sotietlt` | Số tiết LT | Số tiết lý thuyết (vd: `30`, `45`, `60`, `0`) |
| 6 | `ctk-sotietth` | Số tiết TH | Số tiết thực hành (vd: `0`, `30`, `60`) |
| 7 | `ctk-nhomtuchon` | Nhóm tự chọn | Mã nhóm tự chọn (vd: `0`, `1`, `2`, `3`) |
| 8 | `ctk-sotcnhombatbuoc` | Số TC bắt buộc của nhóm | Số tín chỉ tối thiểu phải tích lũy trong nhóm tự chọn |
| 9 | `ctk-pass` | Đạt | Chỉ thị môn đã đạt (`<div class="check"></div>`) |

**Quy tắc parser**:
- Dùng `th[lang="..."]` để xây dựng `ColumnMap`.
- Không sử dụng `nth-child` cứng nhắc nếu các semantic attributes này tồn tại.
- Nếu thiếu các cột cốt lõi (`ctk-mahp`, `ctk-tenmhhp`, `ctk-stc`), trả về lỗi cấu trúc.

---

## 4. Semester Structure (Học kỳ)

- **Nhận diện dòng học kỳ**: Thẻ `tr.row-head.row-head-hover`
- **Dữ liệu cell**:
  - Cell 0 (`td[colspan="4"].text-center`): Tên học kỳ (vd: `Học kỳ 1`, `Học kỳ 2`, ..., `Học kỳ 9`).
  - Cell 1 (`td.text-center`): Tổng số tín chỉ dự kiến của học kỳ (vd: `11`, `12`, `16`, `13`).
  - Cell 2 (`td[colspan="5"]`): Trống.
- **Quy tắc phân tích**: Parser duyệt động (dynamic), **không hardcode vòng lặp từ 1 đến 9**. Số lượng học kỳ được xác định linh hoạt dựa trên các dòng `tr.row-head.row-head-hover` xuất hiện trong bảng.

---

## 5. Required vs Elective Group Structure (Nhóm môn học)

Bên dưới mỗi dòng học kỳ là một hoặc nhiều dòng phân nhóm:

### 5.1. Nhóm Học phần bắt buộc
- **Nhận diện**: `tr.row-head` có text bắt đầu bằng `Học phần bắt buộc`.
- **Thuộc tính**:
  - Cell 0 (`td[colspan="4"]`): Ghi `Học phần bắt buộc`.
  - Cell 1: Số tín chỉ bắt buộc của kỳ (vd: `11`, `9`).
  - `requirementType`: `MANDATORY`.

### 5.2. Nhóm Học phần tự chọn
- **Nhận diện**: `tr.row-head` có text bắt đầu bằng `Học phần tự chọn`.
- **Thuộc tính**:
  - Cell 0 (`td[colspan="4"]`): Ghi `Học phần tự chọn` kèm số nhóm (vd: `Học phần tự chọn 1`, `Học phần tự chọn 9`).
  - Cell 1: Số tín chỉ tối thiểu sinh viên cần chọn trong nhóm này (vd: `3`, `6`, `9`).
  - `requirementType`: `ELECTIVE`.
  - `groupId`: Nhận diện theo tên/mã nhóm (vd: `group_1`, `group_9`).
  - `requiredCredits`: Số tín chỉ bắt buộc của nhóm tự chọn.

**Nguyên tắc tối thượng**: Không biến mọi môn học trong nhóm tự chọn thành môn bắt buộc phải học.

---

## 6. Course Rows (Dòng môn học)

Dòng môn học là các dòng `tr` không chứa `td[colspan]` và không mang class `row-head`:
- `td[0]`: Số thứ tự trong nhóm (1, 2, 3...)
- `td[1]` (`ctk-tenmhhp`): Tên học phần.
- `td[2]` (`ctk-mahp`): Mã học phần (10 chữ số).
- `td[3]`: Môn tiên quyết.
- `td[4]` (`ctk-stc`): Số tín chỉ.
- `td[5]` (`ctk-sotietlt`): Số tiết lý thuyết.
- `td[6]` (`ctk-sotietth`): Số tiết thực hành.
- `td[7]` (`ctk-nhomtuchon`): Mã nhóm tự chọn.
- `td[8]` (`ctk-sotcnhombatbuoc`): Tín chỉ yêu cầu của nhóm tự chọn.
- `td[9]` (`ctk-pass`): Trạng thái đạt.

---

## 7. Status Markers (Trạng thái học tập & Đạt)

### 7.1. Trạng thái Đạt / Chưa đạt (`passState`)
- **Đạt (`PASSED`)**: Cột `td[9]` (`ctk-pass`) chứa phần tử `<div class="check"></div>`.
- **Chưa đạt / Chưa hoàn thành (`NOT_PASSED` / `PENDING`)**: Cột `td[9]` rỗng, không chứa phần tử `.check`.

### 7.2. Trạng thái Đã học / Chưa đăng ký (`studiedState`)
- **Đã/Đang học (`STUDIED` / `ENROLLED`)**: Thẻ `<tr>` có chứa class `colorSTLichHoc`. Đây là class do hệ thống IUH gắn cho các môn sinh viên đã xếp thời khóa biểu/đã có lịch học hoặc đã từng học.
- **Chưa đăng ký (`UNREGISTERED`)**: Thẻ `<tr>` **không** có class `colorSTLichHoc`.

---

## 8. Non-GPA Marker (Học phần không tính vào TBTL)

- **Căn cứ pháp lý từ văn bản IUH**:
  Tại dòng cuối bảng điểm có ghi chú rõ:
  `<p lang="ctk-warningGhiChu"><i>Ghi chú: Những môn học/Học phần có dấu <span style="color:red;font-weight:bold">*</span> không được tính vào Trung bình chung tích lũy</i></p>`
- **Nhận diện tại dòng môn học**:
  Tên môn học trong cột `ctk-tenmhhp` có kết thúc hoặc chứa ký tự `*` (ví dụ: `Giáo dục Quốc phòng và An ninh 1 *`, `Giáo dục thể chất 1 *`, `Chứng chỉ Tiếng Anh *`, `Tiếng Anh 1 *`).
- **Xử lý kỹ thuật**:
  - `countsTowardCumulativeGPA = false`
  - `provenance: 'CURRICULUM_EXPLICIT_NON_GPA'`
  - **Mức ưu tiên cao hơn** mọi heuristic dựa trên tên môn thông thường.

---

## 9. Course Type Inference từ Tiết LT / TH

Số tiết lý thuyết (`theoryHours`) và thực hành (`practiceHours`) trong CTK cho phép suy luận loại môn chính xác:

| Điều kiện | Loại môn suy luận (`inferredCourseType`) | Quy tắc áp dụng |
|---|---|---|
| `theoryHours > 0 && practiceHours == 0` | `THEORY` | 30% KT/GK, 20% Thường kỳ, 50% Cuối kỳ |
| `theoryHours == 0 && practiceHours > 0` | `PRACTICE` | 100% Đánh giá quá trình thực hành |
| `theoryHours > 0 && practiceHours > 0` | `COMBINED` | Kết hợp LT (trọng số 2/3) + TH (trọng số 1/3) |
| `theoryHours == 0 && practiceHours == 0` | `UNKNOWN` / `SPECIAL_CANDIDATE` | Cần thêm bằng chứng (Khóa luận, Đồ án) |

---

## 10. Totals Section (Tổng số tín chỉ CTK)

Ở cuối bảng (các dòng `tr` sau học kỳ cuối):
- `Tổng TC yêu cầu`: ví dụ `144`
- `Tổng TC bắt buộc`: ví dụ `118`
- `Tổng TC tự chọn`: ví dụ `26`

**Nguyên tắc**: Adapter trích xuất trực tiếp số liệu từ DOM của CTK, **không hardcode** bất kỳ con số nào vì mỗi khóa/ngành học có khối lượng tín chỉ khác nhau.

---

## 11. Quan hệ Mã học phần (Grade Page vs CTK)

- **Trang Kết quả học tập**: Dùng **Mã lớp học phần** (12 hoặc 13 chữ số, ví dụ `420300200902`).
- **Trang Chương trình khung**: Dùng **Mã học phần** (10 chữ số, ví dụ `4203002009`).
- **Quy tắc quan hệ thực tế**:
  `Mã lớp học phần = [Mã học phần] + [Mã lớp/nhóm 2-3 chữ số]`
  Khảo sát trên toàn bộ 54 môn snapshot:
  - 100% các môn đều có tiền tố khớp chính xác với Mã học phần trong CTK.
  - Tên môn học chuẩn hóa (`cleanName`) khớp xác nhận 100% với tên môn trong CTK.
