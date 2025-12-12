let isEditMode = false;

// Danh sách môn tự động loại trừ (Checkbox sẽ tự bỏ tích)
const EXCLUDED_SUBJECTS = [
    "Giáo dục Quốc phòng", "Giáo dục thể chất", 
    "Tiếng Anh 1", "Tiếng Anh 2", "Chứng chỉ Tiếng Anh"
];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "enable_edit_mode") {
        if (!isEditMode) {
            initEditMode();
            isEditMode = true;
        }
        calculateAll(); 
    }
});

function initEditMode() {
    const table = document.getElementById("xemDiem_aaa");
    if (!table) return alert("Không tìm thấy bảng điểm!");

    // 1. Thêm cột Checkbox
    const theadRows = table.querySelectorAll("thead tr");
    theadRows.forEach((tr, index) => {
        const th = document.createElement("th");
        if (index === 0) {
            th.innerText = "Chọn";
            th.rowSpan = 3;
            th.style.background = "#ffffcc";
            th.style.color = "red";
            th.style.width = "40px";
            th.style.border = "1px solid #ccc";
            tr.insertBefore(th, tr.firstElementChild);
        }
    });

    const tbody = table.querySelector("tbody");
    const rows = tbody.querySelectorAll("tr");

    rows.forEach(row => {
        // Bỏ qua dòng tiêu đề HK
        if (row.classList.contains("row-head") || row.querySelector("span[lang^='kqht-tkhk']")) {
            const td = document.createElement("td");
            td.style.border = "1px solid #ddd"; // Thêm border cho đẹp
            row.insertBefore(td, row.firstElementChild);
            return;
        }

        // Tạo Checkbox
        const tdCheck = document.createElement("td");
        tdCheck.style.textAlign = "center";
        tdCheck.style.border = "1px solid #ddd";
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.classList.add("calc-checkbox");
        checkbox.style.transform = "scale(1.3)";

        // Logic tự động bỏ chọn môn không tính
        const subjectName = row.children[2]?.innerText || "";
        if (EXCLUDED_SUBJECTS.some(k => subjectName.includes(k))) {
            checkbox.checked = false;
            row.style.opacity = "0.5";
        }

        checkbox.addEventListener("change", () => {
            row.style.opacity = checkbox.checked ? "1" : "0.5";
            calculateAll();
        });

        tdCheck.appendChild(checkbox);
        row.insertBefore(tdCheck, row.firstElementChild);

        // Làm ô nhập liệu
        const editCells = row.querySelectorAll('td[title="DiemChuyenCan1"], td[title^="DiemHeSo1"], td[title^="DiemThucHanh"], td[title="DiemThi"]');
        editCells.forEach(cell => {
            cell.contentEditable = "true";
            cell.style.backgroundColor = "#e3f2fd";
            cell.style.border = "1px dashed #bbb"; // Viền nhẹ để biết ô nhập
            
            cell.addEventListener("input", () => {
                calculateRow(row); // Tính lại dòng hiện tại
                calculateAll();    // Tính lại toàn bộ bảng
            });
        });
        
        // Highlight ô kết quả
        const resCell = row.querySelector('td[title="DiemTongKet"]');
        if(resCell) {
            resCell.style.fontWeight = "bold";
            resCell.style.color = "red";
            resCell.style.backgroundColor = "#fff9c4";
        }
    });
}

// --- KIỂM TRA DỮ LIỆU ĐẦY ĐỦ ---
function isDataComplete(row) {
    // 1. Kiểm tra Giữa kỳ (E)
    const eText = row.querySelector('td[title="DiemChuyenCan1"]')?.innerText.trim();
    if (!eText) return false;

    // 2. Kiểm tra Cuối kỳ (L)
    const lText = row.querySelector('td[title="DiemThi"]')?.innerText.trim();
    if (!lText) return false;

    // 3. Kiểm tra Thường kỳ (F,G,H) - Phải có ít nhất 1 cột có điểm
    const regCells = row.querySelectorAll('td[title^="DiemHeSo1"]');
    let hasReg = false;
    regCells.forEach(c => { if(c.innerText.trim() !== "") hasReg = true; });
    if (!hasReg) return false;

    // 4. Kiểm tra Thực hành (Nếu có cột thực hành mà đang trống hết thì coi như lý thuyết, 
    // nhưng nếu có nhập 1 ô mà thiếu ô khác thì vẫn tính là có thực hành).
    // Ở đây ta dùng logic lỏng: Chỉ cần đủ Giữa kỳ, Cuối kỳ và Thường kỳ là hợp lệ để tính.
    
    return true;
}

// --- TÍNH TOÁN CẤP DÒNG (Đã bổ sung hiển thị Đạt/Rớt) ---
function calculateRow(row) {
    // 1. Kiểm tra dữ liệu đầu vào
    if (!isDataComplete(row)) {
        const cellTK = row.querySelector('td[title="DiemTongKet"]');
        if (cellTK) cellTK.innerText = "";
        
        setVal(row, 'title="DiemTinChi"', "");
        setVal(row, 'title="DiemChu"', "");
        setVal(row, 'title="XepLoai"', "");
        
        // Xóa trạng thái Đạt/Rớt nếu chưa đủ dữ liệu
        const cellGhiChu = row.querySelector('td[title="GhiChu"]');
        if (cellGhiChu) cellGhiChu.innerText = "";
        
        const cellDat = row.cells[row.cells.length - 1];
        if (cellDat) cellDat.innerHTML = "";
        
        return; 
    }

    // 2. Lấy dữ liệu và giới hạn 0-10
    const eRaw = parseNumber(row.querySelector('td[title="DiemChuyenCan1"]')?.innerText);
    const lRaw = parseNumber(row.querySelector('td[title="DiemThi"]')?.innerText);
    
    const e = clamp(eRaw);
    const l = clamp(lRaw);

    // 3. Tính trung bình thành phần
    const regCells = row.querySelectorAll('td[title^="DiemHeSo1"]');
    const fgh = calcAvg(regCells);

    const pracCells = row.querySelectorAll('td[title^="DiemThucHanh"]');
    const ijk = calcAvg(pracCells);
    const hasPractice = ijk.count > 0;

    // 4. Tính điểm Tổng kết
    let lyThuyet = (e * 0.3) + (fgh.val * 0.2) + (l * 0.5);
    let diemTK = hasPractice ? ((lyThuyet * 2) + ijk.val) / 3 : lyThuyet;

    diemTK = Math.min(Math.max(diemTK, 0), 10); 
    diemTK = Math.round(diemTK * 1000) / 1000; 

    // 5. Hiển thị điểm Tổng kết
    const cellTK = row.querySelector('td[title="DiemTongKet"]');
    if (cellTK) {
        cellTK.innerText = formatNum(diemTK, 1);
        if (diemTK < 4.0) {
            cellTK.style.backgroundColor = "red";
            cellTK.style.color = "white";
        } else {
            cellTK.style.backgroundColor = "#fff9c4";
            cellTK.style.color = "red";
        }
        
        // Xử lý viền đỏ nếu rớt (Logic cũ)
        if (l < 3 || e === 0) {
            cellTK.style.border = "2px solid red"; 
        } else {
            cellTK.style.border = "1px solid #ddd"; 
        }
    }

    // 6. Quy đổi điểm
    let res = convertScore(diemTK);

    // XỬ LÝ ĐIỂM LIỆT (Giữa kỳ = 0 hoặc Cuối kỳ < 3)
    if (l < 3 || e === 0) {
        res = { s4: "0.0", char: "F", rank: "Kém" };
    }

    // 7. Gán kết quả vào bảng
    setVal(row, 'title="DiemTinChi"', res.s4);
    setVal(row, 'title="DiemChu"', res.char);
    setVal(row, 'title="XepLoai"', res.rank);

    // --- PHẦN MỚI: XỬ LÝ CỘT GHI CHÚ & CỘT ĐẠT ---
    
    const isFail = (res.char === "F");

    // A. Cột Ghi chú (Thêm chữ "Rớt" màu đỏ)
    const cellGhiChu = row.querySelector('td[title="GhiChu"]');
    if (cellGhiChu) {
        if (isFail) {
            cellGhiChu.innerText = "Rớt";
            cellGhiChu.style.color = "red";
            cellGhiChu.style.fontWeight = "bold";
        } else {
            cellGhiChu.innerText = "";
        }
    }

    // B. Cột Đạt (Cột cuối cùng) - Thêm icon Check xanh hoặc X đỏ
    // Lấy ô cuối cùng trong dòng
    const cellDat = row.cells[row.cells.length - 1]; 
    
    if (cellDat) {
        // Xóa nội dung cũ
        cellDat.innerHTML = "";
        
        // Tạo container canh giữa
        const divWrapper = document.createElement("div");
        divWrapper.style.display = "flex";
        divWrapper.style.justifyContent = "center";
        divWrapper.style.alignItems = "center";
        divWrapper.style.height = "100%";

        if (isFail) {
            // RỚT: Icon X tròn màu đỏ (Dùng FontAwesome có sẵn trên web trường)
            divWrapper.innerHTML = '<i class="fa fa-times-circle" aria-hidden="true" style="color: red; font-size: 1.5em;"></i>';
        } else {
            // ĐẠT: Icon Check xanh (Sử dụng class .check gốc của trường)
            divWrapper.innerHTML = '<div class="check"></div>';
        }
        
        cellDat.appendChild(divWrapper);
    }
}

// --- TÍNH TOÁN TOÀN BỘ (WATERFALL) ---
function calculateAll() {
    // Xóa các dòng custom cũ trước khi tính lại
    document.querySelectorAll(".custom-summary-row").forEach(e => e.remove());

    const tbody = document.querySelector("#xemDiem_aaa tbody");
    const allRows = Array.from(tbody.querySelectorAll("tr"));

    // Biến Tích lũy (Global)
    let g_Credits = 0;
    let g_Score10_W = 0;
    let g_Score4_W = 0;
    let g_Credits_Passed = 0;
    let g_Credits_Failed = 0;

    // Biến Học kỳ (Semester)
    let s_Credits = 0;
    let s_Score10_W = 0;
    let s_Score4_W = 0;
    let s_Credits_Passed = 0;
    let s_Credits_Failed = 0;

    let currentSemesterRows = [];

    // Hàm cập nhật giá trị vào DOM có sẵn của nhà trường (Giữ nguyên logic này)
    const updateNativeRow = (labelLang, value, startRow) => {
        let sibling = startRow.nextElementSibling;
        let limit = 10;
        while (sibling && limit > 0) {
            const labelSpan = sibling.querySelector(`span[lang="${labelLang}"]`);
            if (labelSpan) {
                const valueSpan = labelSpan.nextElementSibling;
                if (valueSpan) {
                    valueSpan.innerText = " " + value;
                    valueSpan.style.color = "red"; // Tô đỏ cho nổi bật giống bản gốc
                    valueSpan.style.fontWeight = "bold";
                }
                return true;
            }
            sibling = sibling.nextElementSibling;
            limit--;
        }
        return false;
    };

    // Hàm tạo 1 dòng tổng kết "Fake" giống hệt "Real"
    const createFakeRow = (label1, val1, label2, val2) => {
        const tr = document.createElement("tr");
        tr.className = "custom-summary-row"; // Class để dễ xóa khi tính lại

        // Style chung copy từ CSS nhà trường
        const cellStyle = "vertical-align:top !important; text-align:left !important;";

        // Cột 1 (colspan 2)
        const td1 = document.createElement("td");
        td1.colSpan = 2;
        td1.style.cssText = cellStyle;
        td1.innerHTML = `<span>${label1}:</span> <span style="font-weight:bold; color:red;"> ${val1}</span>`;

        // Cột 2 (colspan 2)
        const td2 = document.createElement("td");
        td2.colSpan = 2;
        td2.style.cssText = cellStyle;
        td2.innerHTML = `<span>${label2}:</span> <span style="font-weight:bold; color:red;"> ${val2}</span>`;

        // Cột lấp đầy khoảng trống còn lại (colspan to để đẩy về bên trái)
        const tdFill = document.createElement("td");
        tdFill.colSpan = 35; 

        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(tdFill);
        
        return tr;
    };

    const finishSemester = (lastRow) => {
        if (currentSemesterRows.length === 0) return;

        const s_GPA10 = s_Credits > 0 ? (s_Score10_W / s_Credits) : 0;
        const s_GPA4  = s_Credits > 0 ? (s_Score4_W / s_Credits) : 0;
        const c_GPA10 = g_Credits > 0 ? (g_Score10_W / g_Credits) : 0;
        const c_GPA4  = g_Credits > 0 ? (g_Score4_W / g_Credits) : 0;

        // KIỂM TRA: Có bảng gốc của trường chưa?
        let nextRow = lastRow.nextElementSibling;
        let hasNativeSummary = false;
        if (nextRow && nextRow.querySelector('[lang="kqht-tkhk-diemtbhocluc"]')) {
            hasNativeSummary = true;
        }

        if (hasNativeSummary) {
            // --- CÓ SẴN -> GHI ĐÈ SỐ LIỆU ---
            updateNativeRow("kqht-tkhk-diemtbhocluc", formatNum(s_GPA10, 2), lastRow);
            updateNativeRow("kqht-tkhk-diemtbtinchi", formatNum(s_GPA4, 2), lastRow);
            updateNativeRow("kqht-tkhk-xeploaihocluc", getRank(s_GPA4), lastRow);
            updateNativeRow("kqht-tkhk-stcdathocky", s_Credits_Passed, lastRow);
            
            updateNativeRow("kqht-tkhk-diemtbhocluctichluy", formatNum(c_GPA10, 2), lastRow);
            updateNativeRow("kqht-tkhk-diemtbtinchitichluy", formatNum(c_GPA4, 2), lastRow);
            updateNativeRow("kqht-tkhk-xeploaihocluctichluy", getRank(c_GPA4), lastRow);
            updateNativeRow("kqht-tkhk-sotctichluy", g_Credits_Passed, lastRow);
            updateNativeRow("kqht-tkhk-sotckhongdat", g_Credits_Failed, lastRow);
        } else {
            // --- CHƯA CÓ -> CHÈN 5 DÒNG GIẢ LẬP ---
            const frag = document.createDocumentFragment();

            // Dòng 1: ĐTB Học kỳ
            frag.appendChild(createFakeRow(
                "Điểm trung bình học kỳ hệ 10", formatNum(s_GPA10, 2),
                "Điểm trung bình học kỳ hệ 4", formatNum(s_GPA4, 2)
            ));
            
            // Dòng 2: ĐTB Tích lũy
            frag.appendChild(createFakeRow(
                "Điểm trung bình tích lũy", formatNum(c_GPA10, 2),
                "Điểm trung bình tích lũy (hệ 4)", formatNum(c_GPA4, 2)
            ));

            // Dòng 3: Số TC Đăng ký / Tích lũy
            frag.appendChild(createFakeRow(
                "Tổng số tín chỉ đã đăng ký", s_Credits, // Lưu ý: Logic gốc là s_Credits_Reg nhưng ở đây dùng tạm s_Credits để hiển thị
                "Tổng số tín chỉ tích lũy", g_Credits_Passed
            ));

            // Dòng 4: Số TC Đạt / Nợ
            frag.appendChild(createFakeRow(
                "Tổng số tín chỉ đạt", s_Credits_Passed,
                "Tổng số tín chỉ nợ tính đến hiện tại", g_Credits_Failed
            ));

            // Dòng 5: Xếp loại
            frag.appendChild(createFakeRow(
                "Xếp loại học lực tích lũy", getRank(c_GPA4),
                "Xếp loại học lực học kỳ", getRank(s_GPA4)
            ));

            // Chèn cụm 5 dòng này vào sau môn cuối cùng
            lastRow.parentNode.insertBefore(frag, lastRow.nextSibling);
        }

        // Reset biến
        s_Credits = 0; s_Score10_W = 0; s_Score4_W = 0;
        s_Credits_Passed = 0; s_Credits_Failed = 0;
        currentSemesterRows = [];
    };

    allRows.forEach((row) => {
        // Bỏ qua dòng header HK hoặc các dòng tổng kết
        if (row.classList.contains("row-head") || row.querySelector("span[lang^='kqht-tkhk']")) {
            if (currentSemesterRows.length > 0) {
                finishSemester(currentSemesterRows[currentSemesterRows.length - 1]);
            }
            return;
        }

        const checkbox = row.querySelector("input.calc-checkbox");
        // Kiểm tra xem có phải dòng môn học không (dựa vào số lượng cột > 5)
        const isSubjectRow = row.children.length > 5;

        if (isSubjectRow) {
            currentSemesterRows.push(row);

            if (checkbox && checkbox.checked && isDataComplete(row)) {
                const credEl = row.children[4]; // Cột tín chỉ (index 4 vì có cột checkbox)
                const score10El = row.querySelector('td[title="DiemTongKet"]');
                const score4El = row.querySelector('td[title="DiemTinChi"]');

                if (credEl && score10El && score4El) {
                    let cr = parseNumber(credEl.innerText);
                    let s10 = parseNumber(score10El.innerText);
                    let s4 = parseNumber(score4El.innerText);

                    if (cr > 0 && !isNaN(s10)) { 
                        s_Credits += cr;
                        s_Score10_W += (s10 * cr);
                        s_Score4_W += (s4 * cr);
                        
                        if (s4 > 0) s_Credits_Passed += cr;
                        else s_Credits_Failed += cr;

                        g_Credits += cr;
                        g_Score10_W += (s10 * cr);
                        g_Score4_W += (s4 * cr);
                        
                        if (s4 > 0) g_Credits_Passed += cr;
                        else g_Credits_Failed += cr;
                    }
                }
            }
        }
    });

    if (currentSemesterRows.length > 0) {
        finishSemester(currentSemesterRows[currentSemesterRows.length - 1]);
    }

    const finalRes = {
        totalCredits: g_Credits,
        gpa10: g_Credits ? (g_Score10_W / g_Credits).toFixed(2) : "0.00",
        gpa4: g_Credits ? (g_Score4_W / g_Credits).toFixed(2) : "0.00"
    };
    try { chrome.runtime.sendMessage({action: "update_result", data: finalRes}); } catch(e) {}
}

// --- TIỆN ÍCH ---
function parseNumber(str) {
    if (!str) return NaN; // Trả về NaN để dễ kiểm tra
    let clean = str.trim().replace(',', '.');
    if (clean === "") return NaN;
    return parseFloat(clean);
}

function formatNum(num, digits) {
    return num.toFixed(digits).replace('.', ',');
}

// Hàm phụ trợ: Giới hạn số trong khoảng 0 đến 10
function clamp(num) {
    if (isNaN(num)) return 0;
    return Math.min(10, Math.max(0, num));
}

function calcAvg(nodeList) {
    let sum = 0, count = 0;
    nodeList.forEach(c => {
        let t = c.innerText.trim();
        if(t !== "") {
            let v = parseNumber(t);
            if (!isNaN(v)) {
                v = clamp(v); // <--- Áp dụng giới hạn 0-10
                sum += v; 
                count++;
            }
        }
    });
    return { val: count ? sum/count : 0, count };
}

function setVal(row, selector, val) {
    const el = row.querySelector(`td[${selector}]`);
    if(el) {
        el.innerText = val;
        el.style.color = "blue";
        el.style.fontWeight = "bold";
    }
}

// BẢNG QUY ĐỔI
function convertScore(s) {
    if (s >= 8.9500001) return { s4: "4.0", char: "A+", rank: "Xuất sắc" };
    if (s >= 8.4500001) return { s4: "3.8", char: "A", rank: "Giỏi" };
    if (s >= 7.9500001) return { s4: "3.5", char: "B+", rank: "Khá giỏi" };
    if (s >= 6.9500001) return { s4: "3.0", char: "B", rank: "Khá" };
    if (s >= 5.9500001) return { s4: "2.5", char: "C+", rank: "TB Khá" };
    if (s >= 5.4500001) return { s4: "2.0", char: "C", rank: "Trung bình" };
    if (s >= 4.9500001) return { s4: "1.5", char: "D+", rank: "TB Yếu" };
    if (s >= 3.9500001) return { s4: "1.0", char: "D", rank: "Yếu" };
    return { s4: "0.0", char: "F", rank: "Kém" };
}

function getRank(gpa4) {
    if (gpa4 >= 3.59500001) return "Xuất sắc";
    if (gpa4 >= 3.19500001) return "Giỏi";
    if (gpa4 >= 2.45000001) return "Khá";
    if (gpa4 >= 1.95000001) return "Trung bình";
    if (gpa4 >= 0.95000001) return "Yếu";
    return "Kém";
}