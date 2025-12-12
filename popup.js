document.getElementById('btnEnable').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (!tabs[0].url.includes("sv.iuh.edu.vn")) {
            alert("Vui lòng mở trang Kết quả học tập IUH!");
            return;
        }
        // Gửi lệnh kích hoạt chế độ sửa
        chrome.tabs.sendMessage(tabs[0].id, {action: "enable_edit_mode"});
    });
});

// Lắng nghe kết quả trả về liên tục từ content script
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "update_result") {
        document.getElementById('totalCredits').innerText = request.data.totalCredits;
        document.getElementById('gpa10').innerText = request.data.gpa10;
        document.getElementById('gpa4').innerText = request.data.gpa4;
    }
});