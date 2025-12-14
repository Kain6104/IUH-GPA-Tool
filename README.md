# IUH GPA Calculator

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)  
[![Chrome Version](https://img.shields.io/badge/Chrome-Ready-green.svg)](https://www.google.com/chrome/)

**IUH GPA Calculator** là tiện ích Chrome giúp sinh viên **trích xuất điểm và tính điểm trung bình tích lũy (GPA) tự động** từ trang học tập của IUH ([https://sv.iuh.edu.vn](https://sv.iuh.edu.vn)) một cách nhanh chóng và chính xác.  

---

## 🔹 Tính năng nổi bật

- **Tự động đọc điểm** từ trang kết quả học tập IUH.  
- **Tính GPA và điểm trung bình tích lũy** theo công thức chuẩn IUH.  
- **Giao diện popup trực quan** ngay trên Chrome, không cần mở Excel hay công cụ khác.  
- **Xuất dữ liệu ra Excel** để lưu trữ hoặc in ấn.  
- Hoàn toàn **offline**, dữ liệu không rời khỏi trình duyệt.  

---

## 💻 Cài đặt

### **Cách 1: Load Unpacked trên Chrome**
1. Tải hoặc clone repository này về máy:  
git clone https://github.com/Kain6104/IUH-GPA-Tool.git
2. Mở Chrome → vào trang Extensions:
chrome://extensions/
3. Bật Developer Mode (góc phải trên).
4. Nhấn Load unpacked → chọn thư mục project IUH-GPA-Tool.
5. Biểu tượng tool sẽ xuất hiện trên thanh tiện ích Chrome.
### **Cách 2: Cài bằng file .zip**
1. Tải repository về dưới dạng .zip.
2. Giải nén → Load Unpacked theo hướng dẫn trên.
## ⚙️ Hướng dẫn sử dụng
1. Truy cập trang https://sv.iuh.edu.vn/ket-qua-hoc-tap.html
 và đăng nhập.
2. Nhấn vào biểu tượng IUH GPA Calculator trên thanh tiện ích Chrome.
3. Tool sẽ tự động đọc tất cả điểm, tính GPA, và hiển thị kết quả ngay popup.
4. (Tuỳ chọn) Xuất dữ liệu ra file Excel để lưu trữ.

##📝 Công nghệ
HTML, CSS, JavaScript: Giao diện popup tiện ích.
Chrome Extension API: Tương tác trực tiếp với trang web IUH.
XLSX.js (tùy chọn): Xuất dữ liệu ra Excel.
