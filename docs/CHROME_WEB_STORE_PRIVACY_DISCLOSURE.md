# CHROME WEB STORE PRIVACY DISCLOSURE (DRAFT)
**IUH GPA Tool – Developer Dashboard Privacy Practice Guide**

*Tài liệu hướng dẫn khai báo thông tin trên mục Privacy Practices của Chrome Web Store Developer Dashboard khi phát hành.*

---

### 1. Single Purpose (Mục đích duy nhất)
> **Mô tả ngắn gọn, chính xác (Single Purpose Statement):**  
> *"Hỗ trợ sinh viên IUH phân tích và mô phỏng kết quả học tập/GPA trực tiếp trên trang kết quả học tập mà họ đang xem."*

---

### 2. Permission Justification (Giải trình quyền hạn)

| Quyền / Match Pattern | Mục đích sử dụng | Lý do bắt buộc | Dữ liệu được truy cập | Có thể loại bỏ không? |
| :--- | :--- | :--- | :--- | :--- |
| **`activeTab`** | Cho phép popup (`popup.html`) kiểm tra tab hiện tại có phải trang điểm IUH không và gửi message lấy tóm tắt GPA. | Cần thiết khi người dùng bấm vào icon tiện ích trên thanh toolbar để popup giao tiếp với content script của tab hiện tại. | Chỉ URL và message ID của tab đang kích hoạt khi người dùng chủ động mở popup. Không truy cập tab nền hay lịch sử duyệt web. | **Không** (Cần thiết cho workflow của popup. Đã loại trừ mọi quyền host thừa). |
| **`content_scripts` match:**<br>`https://sv.iuh.edu.vn/ket-qua-hoc-tap.html*` | Tự động chèn giao diện thanh mô phỏng (CompanionBar) và các nút điều khiển điểm số ngay trên bảng điểm IUH. | Mục tiêu cốt lõi của tiện ích là tương tác trực quan với bảng điểm của sinh viên. | Chỉ nội dung bảng điểm trên trang `ket-qua-hoc-tap.html` thuộc domain `sv.iuh.edu.vn`. | **Không** (Đây là cơ chế hoạt động chính của extension). |
| **`host_permissions`:**<br>`https://sv.iuh.edu.vn/*` | Cho phép tiện ích gửi yêu cầu `GET` same-origin tới `/chuong-trinh-khung.html` để đồng bộ Chương trình khung phục vụ phân tích tiến độ. | Trang CTK nằm ở đường dẫn tách biệt (`/chuong-trinh-khung.html`) nhưng cùng origin `sv.iuh.edu.vn`. Host permission này giới hạn nghiêm ngặt chỉ trên domain IUH. | Chỉ đọc HTML cấu trúc môn học của trang CTK khi người dùng đang đăng nhập. Không truy cập bất kỳ domain nào khác. | **Không** (Cần thiết cho tính năng đối chiếu CTK và phân tích tiến độ). |

---

### 3. User Data Practices Questionnaire (Khai báo dữ liệu người dùng)

#### A. Data Collection & Transmission (Thu thập & Truyền tải dữ liệu)
- **Do you collect or transmit user data off-device?**  
  👉 **NO** (Extension không truyền tải bất kỳ dữ liệu nào ra khỏi thiết bị của người dùng tới máy chủ của nhà phát triển hoặc bên thứ ba).  
  *Ghi chú kỹ thuật*: Extension chỉ thực hiện duy nhất yêu cầu cùng nguồn (`same-origin GET`) tới `https://sv.iuh.edu.vn/chuong-trinh-khung.html` bằng phiên đăng nhập hiện tại của sinh viên để đồng bộ dữ liệu Chương trình khung. Toàn bộ quá trình bóc tách diễn ra trong bộ nhớ tạm (in-memory detached document) và không gửi dữ liệu đi bất kỳ đâu.
- **Is user data sold to third parties?**  
  👉 **NO**.
- **Is user data used for personalized advertising?**  
  👉 **NO**.
- **Is user data used to determine creditworthiness or for lending purposes?**  
  👉 **NO**.

#### B. Categories of Data Accessed (Danh mục dữ liệu truy cập cục bộ)
- **Personally Identifiable Information (Name, Student ID, Email, Phone, Address):**  
  👉 **NOT ACCESSED / NOT COLLECTED**. (Tiện ích không đọc hay lưu tên sinh viên hoặc MSSV).
- **Authentication Information (Passwords, Credentials, Cookies, Session Tokens):**  
  👉 **NOT ACCESSED / NOT COLLECTED**.
- **Web History / Browsing Activity:**  
  👉 **NOT ACCESSED / NOT COLLECTED**.
- **Financial and Payment Information:**  
  👉 **NOT ACCESSED / NOT COLLECTED**.
- **Health Information:**  
  👉 **NOT ACCESSED / NOT COLLECTED**.
- **User Activity / Analytics:**  
  👉 **NO ANALYTICS**.
- **Academic / Performance Data (Grades, Credits, Semesters):**  
  👉 **PROCESSED LOCALLY ONLY** (Chỉ đọc nội dung trên bảng điểm để tính toán GPA cục bộ trong RAM; không thu thập, không lưu vĩnh viễn, không gửi ra ngoài).

---

### 4. Limited Use Disclosure Certification
Khi submit lên Chrome Web Store, nhà phát triển cần tích chọn cam kết tuân thủ chính sách Sử dụng Giới hạn (Chrome Web Store Limited Use Policy):
1. Tiện ích chỉ sử dụng dữ liệu để cung cấp hoặc cải thiện tính năng chính hiển thị cho người dùng.
2. Tiện ích không chuyển giao dữ liệu cho bên thứ ba ngoại trừ trường hợp cần thiết để cung cấp tính năng chính và tuân thủ luật pháp.
3. Tiện ích không sử dụng hoặc chuyển giao dữ liệu để phân phát quảng cáo.
4. Tiện ích không cho phép con người đọc dữ liệu của người dùng.

---

### 5. Lưu ý cho Developer khi nộp hồ sơ
- Khi Google CWS Reviewer đặt câu hỏi về quyền `activeTab`, trích dẫn trực tiếp: *"activeTab is exclusively used by the extension popup to check if the current active tab is on https://sv.iuh.edu.vn/ket-qua-hoc-tap.html and to fetch the in-memory GPA summary from the content script."*
- URL chính sách bảo mật (Privacy Policy URL): Cần được host công khai (ví dụ trên GitHub Pages hoặc repo GitHub) trước khi dán link vào mục `Privacy policy` của Store Listing.
