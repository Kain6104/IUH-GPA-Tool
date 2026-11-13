const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Vietnamese Encoding: Kiểm tra chính tả tiếng Việt UTF-8 và chống tuyệt đối lỗi Mojibake', () => {
  const uiFiles = [
    'src/ui/CompanionBar.js',
    'src/ui/AppController.js',
    'src/core/GradingRuleEngine.js',
    'src/ui/styles.css'
  ];

  // 1. Kiểm tra không chứa ký tự hỏng UTF-8 (U+FFFD hoặc chuỗi mojibake)
  const forbiddenMojibake = [
    '\uFFFD',
    'Th\uFFFDm',
    'h?c',
    'k?',
    'm\uFFFD ph?ng',
    'Ch?n',
    'T?m',
    'ki?m',
    'B?t',
    'bu?c',
    'Ch?a',
    '??t',
    'L? thuy?t',
    'Th?c hnh',
    'K?t h?p'
  ];

  uiFiles.forEach(relPath => {
    const fullPath = path.join(__dirname, '../', relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    forbiddenMojibake.forEach(badStr => {
      assert.equal(
        content.includes(badStr),
        false,
        `File ${relPath} must NOT contain mojibake string "${badStr}"`
      );
    });
  });

  // 2. Kiểm tra CompanionBar.js chứa đầy đủ các nhãn Unicode tiếng Việt chuẩn xác
  const companionContent = fs.readFileSync(path.join(__dirname, '../src/ui/CompanionBar.js'), 'utf8');

  const requiredUnicodeStrings = [
    'Thêm học kỳ mô phỏng',
    'Chọn học kỳ mô phỏng',
    'Chọn học phần đưa vào kế hoạch',
    'Tìm kiếm theo tên môn học hoặc mã học phần...',
    'Bắt buộc còn lại',
    'Tự chọn còn thiếu',
    'Chưa học',
    'Chưa đạt',
    'Đã chọn',
    'Đã chọn 0 môn · 0 tín chỉ',
    'Hủy',
    'Thêm học kỳ',
    'Tiến độ theo dữ liệu Chương trình khung',
    'Quản lý Kịch bản mô phỏng',
    'Cảnh báo đối chiếu'
  ];

  requiredUnicodeStrings.forEach(expectedStr => {
    assert.ok(
      companionContent.includes(expectedStr),
      `CompanionBar.js must contain exact Unicode string: "${expectedStr}"`
    );
  });

  // 3. Kiểm tra AppController.js chứa các nhãn bảng điểm chuẩn xác
  const appCtrlContent = fs.readFileSync(path.join(__dirname, '../src/ui/AppController.js'), 'utf8');
  const requiredAppCtrlStrings = [
    'Mô phỏng',
    '+ Thêm môn',
    'Xóa học kỳ',
    'Lý thuyết',
    'Thực hành',
    'Kết hợp',
    'Tự động',
    'Điểm mô phỏng',
    'Tổng TC kế hoạch:',
    'TC tính GPA:'
  ];

  requiredAppCtrlStrings.forEach(expectedStr => {
    assert.ok(
      appCtrlContent.includes(expectedStr),
      `AppController.js must contain exact Unicode string: "${expectedStr}"`
    );
  });
});
