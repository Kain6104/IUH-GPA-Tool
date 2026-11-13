/**
 * gen-fixture.js
 * Run: node tests/fixtures/gen-fixture.js
 * Generates tests/fixtures/grade-page.sanitized.html
 */
'use strict';
const fs = require('fs');
const path = require('path');

function cell(title, v) {
  if (v === undefined) return '';
  const content = (v === null || v === '') ? '' : v;
  return `<td title="${title}">${content}</td>`;
}

function mkRow(n, code, name, tc, mid, h11, h12, h13, tk6, tk7, tk8, tk9, th1, th2, th3, fin, total, s4, chu, xl, ghichu) {
  const passed = (total !== '' && total !== null);
  return `<tr>
  <td>${n}</td><td><div>${code}</div></td>
  <td class="text-start sticky-col">${name}</td>
  <td>${tc}</td>
  ${cell('DiemChuyenCan1', mid)}
  ${cell('DiemHeSo11', h11)}${cell('DiemHeSo12', h12)}${cell('DiemHeSo13', h13)}
  ${cell('DiemHeSo14', '')}${cell('DiemHeSo15', '')}
  ${cell('DiemThuongKy6', tk6)}${cell('DiemThuongKy7', tk7)}
  ${cell('DiemThuongKy8', tk8)}${cell('DiemThuongKy9', tk9)}
  ${cell('DiemThucHanh1', th1)}${cell('DiemThucHanh2', th2)}${cell('DiemThucHanh3', th3)}
  ${cell('DiemThucHanh4', '')}${cell('DiemThucHanh5', '')}
  ${cell('DiemThi', fin)}
  ${cell('DiemTongKet', total)}
  ${cell('DiemTinChi', s4)}
  ${cell('DiemChu', chu)}
  ${cell('XepLoai', xl)}
  ${cell('GhiChu', ghichu)}
  ${cell('DiemTBQuaTrinh', '')}
  <td>${passed ? '<div class="check"></div>' : ''}</td>
</tr>`;
}

function mkSemHeader(label) {
  return `<tr><td class="text-start row-head" colspan="27">${label}</td>${'<td class="hidden"></td>'.repeat(26)}</tr>`;
}

function mkSummaryRow(lang1, v1, lang2, v2) {
  return `<tr><td colspan="2"><span lang="${lang1}">x</span> <span>${v1}</span></td><td colspan="2"><span lang="${lang2}">x</span> <span>${v2}</span></td><td colspan="23" class="hidden"></td></tr>`;
}

function mkSummary(gpa10, gpa4, cGpa10, cGpa4, reg, cum, earned, failed, cumlRank, semRank) {
  return [
    mkSummaryRow('kqht-tkhk-diemtbhocluc', gpa10, 'kqht-tkhk-diemtbtinchi', gpa4),
    mkSummaryRow('kqht-tkhk-diemtbhocluctichluy', cGpa10, 'kqht-tkhk-diemtbtinchitichluy', cGpa4),
    mkSummaryRow('kqht-tkhk-tongsotcdangky', reg, 'kqht-tkhk-sotctichluy', cum),
    mkSummaryRow('kqht-tkhk-stcdathocky', earned, 'kqht-tkhk-sotckhongdat', failed),
    mkSummaryRow('kqht-tkhk-xeploaihocluctichluy', cumlRank, 'kqht-tkhk-xeploaihocluc', semRank),
  ].join('\n');
}

const thead = `<thead class="header-sticky">
<tr>
  <th lang="kqht-stt" rowspan="3" style="min-width:48px">STT</th>
  <th lang="kqht-malhp" rowspan="3" style="min-width:200px">Ma lop</th>
  <th lang="kqht-tenlhp" rowspan="3" class="text-start sticky-col" style="min-width:200px">Ten mon</th>
  <th lang="kqht-stc" rowspan="3" style="min-width:48px">So TC</th>
  <th lang="kqht-qucd-row_1_2" rowspan="3" style="min-width:48px">Giua ky</th>
  <th colspan="9">Thuong xuyen</th>
  <th colspan="5">Thuc hanh</th>
  <th lang="kqht-qucd-row_1_8" rowspan="3" style="min-width:48px">Cuoi ky</th>
  <th lang="kqht-qucd-row_1_10" rowspan="3" style="min-width:48px">Diem TK</th>
  <th lang="kqht-qucd-diemtinchi" rowspan="3" style="min-width:48px">He 4</th>
  <th lang="kqht-qucd-diemchu" rowspan="3" style="min-width:48px">Chu</th>
  <th lang="kqht-qucd-xeploai" rowspan="3" style="min-width:48px">Xep loai</th>
  <th lang="kqht-qucd-ghichu" rowspan="3" style="min-width:48px">Ghi chu</th>
  <th lang="kqht-qucd-diemtbquatrinh" rowspan="3" style="min-width:48px">TBQT</th>
  <th lang="kqht-qucd-isdat" rowspan="3" style="min-width:48px">Dat</th>
</tr>
<tr>
  <th colspan="9" data-root="0">LT He so 1</th>
  <th lang="kqht-qucd-diemthuchanh1" rowspan="2" data-root="1" style="min-width:48px">1</th>
  <th lang="kqht-qucd-diemthuchanh2" rowspan="2" data-root="1" style="min-width:48px">2</th>
  <th lang="kqht-qucd-diemthuchanh3" rowspan="2" data-root="1" style="min-width:48px">3</th>
  <th lang="kqht-qucd-diemthuchanh4" rowspan="2" data-root="1" style="min-width:48px">4</th>
  <th lang="kqht-qucd-diemthuchanh5" rowspan="2" data-root="1" style="min-width:48px">5</th>
</tr>
<tr>
  <th lang="kqht-qucd-diemheso11" data-root="1" style="min-width:48px">1</th>
  <th lang="kqht-qucd-diemheso12" data-root="1" style="min-width:48px">2</th>
  <th lang="kqht-qucd-diemheso13" data-root="1" style="min-width:48px">3</th>
  <th lang="kqht-qucd-diemheso14" data-root="1" style="min-width:48px">4</th>
  <th lang="kqht-qucd-diemheso15" data-root="1" style="min-width:48px">5</th>
  <th lang="kqht-qucd-diemthuongky6" data-root="1" style="min-width:48px">6</th>
  <th lang="kqht-qucd-diemthuongky7" data-root="1" style="min-width:48px">7</th>
  <th lang="kqht-qucd-diemthuongky8" data-root="1" style="min-width:48px">8</th>
  <th lang="kqht-qucd-diemthuongky9" data-root="1" style="min-width:48px">9</th>
</tr>
</thead>`;

// Courses: [n, code, name, tc, mid, h11, h12, h13, tk6, tk7, tk8, tk9, th1, th2, th3, final, total, s4, chu, xl, ghichu]
const E = ''; // empty / missing
const semesters = [
  {
    label: 'HK1 (2020 - 2021)', hasSum: true,
    courses: [
      [1,'FAKE001_01','Toan giai tich A (Gia)',3,'7,0','8,0','7,5',E,E,E,E,E,E,E,E,'6,5','6,8','3.0','B','Kha',E],
      [2,'FAKE002_01','Vat ly dai cuong A (Gia)',3,'6,0','7,0','6,0',E,E,E,E,E,'7,0','6,5','7,0','5,5','6,3','2.5','C+','Trung binh',E],
      [3,'FAKE003_01','Lap trinh co ban (Gia)',3,'8,5','9,0','8,5','8,0',E,E,E,E,'9,0','8,5','9,0','8,0','8,5','3.8','A','Gioi',E],
      [4,'FAKE004_01','Giao duc Quoc phong (Gia)',4,E,E,E,E,E,E,E,E,E,E,E,'7,0','7,0','3.0','B','Kha',E],
      [5,'FAKE005_01','Giao duc the chat 1 (Gia)',1,E,E,E,E,E,E,E,E,'8,0','8,5',E,E,'8,3','3.8','A','Gioi',E],
      [6,'FAKE006_01','Chung chi Tieng Anh (Gia)',0,E,E,E,E,E,E,E,E,E,E,E,'9,0','9,0','4.0','A+','Xuat sac',E],
    ],
    sumData: ['6,87','2.95','6,87','2.95','14','10','10','0','Trung binh','Trung binh'],
  },
  {
    label: 'HK2 (2020 - 2021)', hasSum: true,
    courses: [
      [7,'FAKE007_01','Dai so tuyen tinh (Gia)',3,'7,5','8,0','7,0',E,E,E,E,E,E,E,E,'7,0','7,3','3.0','B','Kha',E],
      [8,'FAKE008_01','Lap trinh huong doi tuong (Gia)',3,'8,0','8,5','8,0','9,0',E,E,E,E,'8,0','9,0','8,5','8,5','8,4','3.5','B+','Kha',E],
      [9,'FAKE009_01','Co so du lieu (Gia)',3,'6,5','7,0','6,5',E,E,E,E,E,'7,5','7,0','7,5','6,0','6,7','3.0','B','Kha',E],
      [10,'FAKE010_01','Tieng Anh 1 (Gia)',3,'7,0','8,0',E,E,E,E,E,E,E,E,E,'6,5','6,9','3.0','B','Kha',E],
      [11,'FAKE011_01','Ky nang mem (Gia)',2,'9,0','9,5','9,0',E,E,E,E,E,E,E,E,'9,0','9,1','4.0','A+','Xuat sac',E],
      [12,'FAKE012_01','Xac suat thong ke (Gia)',3,'5,0','6,0','5,5',E,E,E,E,E,E,E,E,'2,5','4,3','1.0','D','Yeu','Hoc lai'],
    ],
    sumData: ['7,13','3.08','7,01','3.02','17','24','14','3','Trung binh','Kha'],
  },
  {
    label: 'HKH (2020 - 2021)', hasSum: false,
    courses: [
      [13,'FAKE013_01','Kien truc may tinh (Gia)',3,'7,0','7,5','7,0',E,E,E,E,E,E,E,E,'7,5','7,3','3.0','B','Kha',E],
      [14,'FAKE014_01','Mang may tinh (Gia)',3,'6,0','6,5',E,E,E,E,E,E,E,E,E,'6,0','6,1','2.5','C+','Trung binh',E],
      [15,'FAKE015_01','He dieu hanh (Gia)',3,'8,0','8,5','8,0',E,E,E,E,E,E,E,E,'8,0','8,1','3.5','B+','Kha',E],
    ],
    sumData: null,
  },
  {
    label: 'HK1 (2021 - 2022)', hasSum: true,
    courses: [
      [16,'FAKE016_01','Tri tue nhan tao (Gia)',3,'8,5','9,0','8,5','9,0',E,E,E,E,E,E,E,'9,0','8,9','3.8','A','Gioi',E],
      [17,'FAKE017_01','Machine Learning (Gia)',3,'7,0','7,5','7,0',E,E,E,E,E,E,E,E,'7,5','7,5','3.5','B+','Kha',E],
      [18,'FAKE018_01','Thi giac may tinh (Gia)',3,'8,0','8,5','8,0',E,E,E,E,E,'9,0','8,5','9,0','8,5','8,6','3.8','A','Gioi',E],
      [19,'FAKE019_01','Xu ly ngon ngu tu nhien (Gia)',3,'6,5','7,0','6,5',E,E,E,E,E,E,E,E,'6,0','6,3','2.5','C+','Trung binh',E],
      [20,'FAKE020_01','Tieng Anh 2 (Gia)',3,'7,5','8,0',E,E,E,E,E,E,E,E,E,'7,0','7,3','3.0','B','Kha',E],
      [21,'FAKE021_01','An toan thong tin (Gia)',3,'9,0','9,5','9,0','9,5',E,E,E,E,E,E,E,'9,5','9,4','4.0','A+','Xuat sac',E],
    ],
    sumData: ['8,00','3.47','7,43','3.20','18','42','18','0','Kha','Gioi'],
  },
  {
    label: 'HK2 (2021 - 2022)', hasSum: true,
    courses: [
      // Course 22: DiemThuongKy6-9 ALL have data – critical edge case for parser
      [22,'FAKE022_01','Phat trien PM Agile (Gia)',3,'8,0','8,0','8,5','7,5','7,5','8,0','8,5','7,0',E,E,E,'8,0','8,1','3.5','B+','Kha',E],
      [23,'FAKE023_01','Kiem thu phan mem (Gia)',3,'7,5','8,0','7,5','8,0',E,E,E,E,'8,5','8,0','8,5','8,0','8,2','3.5','B+','Kha',E],
      [24,'FAKE024_01','Cong nghe web (Gia)',3,'6,0','7,0','6,5',E,E,E,E,E,'7,0','7,5','7,0','5,5','6,5','3.0','B','Kha',E],
      // Course 25: midterm = 0 (numeric zero, NOT missing)
      [25,'FAKE025_01','Dien toan dam may (Gia)',3,'0','5,0','5,5',E,E,E,E,E,E,E,E,'6,0','4,5','1.5','D+','TB Yeu',E],
      [26,'FAKE026_01','Do hoa may tinh (Gia)',3,'7,0','7,5','7,0',E,E,E,E,E,'8,0','7,5','8,0','7,0','7,4','3.0','B','Kha',E],
      [27,'FAKE027_01','Phan tich thiet ke HT (Gia)',3,'8,5','9,0','8,5',E,E,E,E,E,E,E,E,'8,5','8,6','3.8','A','Gioi',E],
    ],
    sumData: ['7,55','3.22','7,55','3.26','18','60','18','0','Kha','Kha'],
  },
  {
    label: 'HKH (2021 - 2022)', hasSum: false,
    courses: [
      [28,'FAKE028_01','IoT va He thong nhung (Gia)',3,'7,5','8,0','7,5',E,E,E,E,E,'8,0','7,5',E,'7,0','7,5','3.5','B+','Kha',E],
      [29,'FAKE029_01','Blockchain co ban (Gia)',3,'6,0','6,5','6,0',E,E,E,E,E,E,E,E,'5,5','5,8','2.0','C','Trung binh',E],
      [30,'FAKE030_01','Quan tri du an CNTT (Gia)',3,'8,0','8,5','8,0',E,E,E,E,E,E,E,E,'8,0','8,1','3.5','B+','Kha',E],
    ],
    sumData: null,
  },
  {
    label: 'HK1 (2022 - 2023)', hasSum: true,
    courses: [
      [31,'FAKE031_01','Phan tich du lieu lon (Gia)',3,'8,5','9,0','8,5','9,0',E,E,E,E,E,E,E,'8,5','8,6','3.8','A','Gioi',E],
      [32,'FAKE032_01','Khai pha du lieu (Gia)',3,'7,0','7,5','7,0',E,E,E,E,E,E,E,E,'7,0','7,1','3.0','B','Kha',E],
      [33,'FAKE033_01','Hoc sau (Gia)',3,'9,0','9,5','9,0','9,5',E,E,E,E,'9,5','9,0','9,5','9,0','9,3','4.0','A+','Xuat sac',E],
      [34,'FAKE034_01','Do an mon hoc (Gia - Thuc tap)',3,E,E,E,E,E,E,E,E,E,E,E,'8,5','8,5','3.8','A','Gioi',E],
      [35,'FAKE035_01','Thiet ke UI UX (Gia)',3,'7,5','8,0','7,5',E,E,E,E,E,'8,5','8,0','8,5','7,0','7,8','3.5','B+','Kha',E],
      [36,'FAKE036_01','Phan tich HTTT (Gia)',3,'6,5','7,0','6,5',E,E,E,E,E,E,E,E,'6,0','6,3','2.5','C+','Trung binh',E],
    ],
    sumData: ['7,93','3.43','7,68','3.29','18','78','18','0','Kha','Gioi'],
  },
  {
    label: 'HK2 (2022 - 2023)', hasSum: true,
    courses: [
      [37,'FAKE037_01','Lap trinh di dong (Gia)',3,'8,0','8,5','8,0','8,5',E,E,E,E,'9,0','8,5','9,0','8,0','8,4','3.5','B+','Kha',E],
      [38,'FAKE038_01','DevOps va CICD (Gia)',3,'7,5','8,0','7,5',E,E,E,E,E,'8,0','7,5','8,0','7,5','7,8','3.5','B+','Kha',E],
      [39,'FAKE039_01','Quan tri CSDL (Gia)',3,'6,0','6,5','6,0',E,E,E,E,E,E,E,E,'5,5','5,9','2.5','C+','Trung binh',E],
      [40,'FAKE040_01','Khoa luan tot nghiep (Gia)',9,E,E,E,E,E,E,E,E,E,E,E,'8,7','8,7','3.8','A','Gioi',E],
      [41,'FAKE041_01','Nhap mon Khoa hoc du lieu (Gia)',3,'8,5','9,0','8,5',E,E,E,E,E,E,E,E,'9,0','8,9','3.8','A','Gioi',E],
      [42,'FAKE042_01','He thong phan tan (Gia)',3,'7,0','7,5','7,0',E,E,E,E,E,E,E,E,'7,0','7,1','3.0','B','Kha',E],
    ],
    sumData: ['8,03','3.44','7,79','3.33','24','102','24','0','Kha','Gioi'],
  },
  {
    label: 'HK1 (2023 - 2024)', hasSum: true,
    courses: [
      [43,'FAKE043_01','Dao duc CNTT (Gia)',2,'8,0','8,5','8,0',E,E,E,E,E,E,E,E,'8,0','8,1','3.5','B+','Kha',E],
      [44,'FAKE044_01','Khoi nghiep sang tao (Gia)',2,'9,0','9,5','9,0',E,E,E,E,E,E,E,E,'9,5','9,4','4.0','A+','Xuat sac',E],
      [45,'FAKE045_01','Kinh te vi mo (Gia)',3,'6,0','6,5','6,0',E,E,E,E,E,E,E,E,'5,5','5,8','2.0','C','Trung binh',E],
      [46,'FAKE046_01','Phap luat dai cuong (Gia)',2,'7,0','7,5','7,0',E,E,E,E,E,E,E,E,'7,0','7,1','3.0','B','Kha',E],
      [47,'FAKE047_01','Tu tuong HCM (Gia)',2,'8,5','9,0','8,5',E,E,E,E,E,E,E,E,'8,0','8,2','3.5','B+','Kha',E],
      [48,'FAKE048_01','Ky thuat so (Gia)',3,'7,5','8,0','7,5',E,E,E,E,E,'8,0','7,5','8,0','7,5','7,7','3.5','B+','Kha',E],
    ],
    sumData: ['7,72','3.29','7,80','3.33','14','116','14','0','Kha','Kha'],
  },
  {
    label: 'HK2 (2023 - 2024)', hasSum: true,
    courses: [
      [49,'FAKE049_01','Toi uu hoa (Gia)',3,'8,0','8,5','8,0','8,5',E,E,E,E,E,E,E,'8,0','8,1','3.5','B+','Kha',E],
      [50,'FAKE050_01','Ly thuyet thong tin (Gia)',3,'7,0','7,5','7,0',E,E,E,E,E,E,E,E,'7,0','7,1','3.0','B','Kha',E],
      [51,'FAKE051_01','Bao mat mang (Gia)',3,'9,0','9,5','9,0','9,5',E,E,E,E,E,E,E,'9,0','9,1','4.0','A+','Xuat sac',E],
      // Course 52: finalExam < 3 edge case – fail condition
      [52,'FAKE052_01','Mon thi cuoi ky duoi 3 (Gia)',3,'9,0','9,0','9,0',E,E,E,E,E,E,E,E,'2,5','3,5','0.0','F','Kem','Diem liet'],
      [53,'FAKE053_01','Xu ly anh so (Gia)',3,'7,5','8,0','7,5',E,E,E,E,E,'8,0','8,5','8,0','7,0','7,6','3.5','B+','Kha',E],
      [54,'FAKE054_01','Thuc tap tot nghiep (Gia)',3,E,E,E,E,E,E,E,E,E,E,E,'9,0','9,0','4.0','A+','Xuat sac',E],
    ],
    sumData: ['7,68','3.26','7,80','3.33','18','134','15','3','Kha','Kha'],
  },
];

let body = '';
let totalCourses = 0;
let totalSummaryRows = 0;
let semestersWithSummary = 0;
let semestersWithoutSummary = 0;

for (const sem of semesters) {
  body += mkSemHeader(sem.label) + '\n';
  for (const c of sem.courses) {
    body += mkRow(...c) + '\n';
    totalCourses++;
  }
  if (sem.hasSum && sem.sumData) {
    body += mkSummary(...sem.sumData) + '\n';
    totalSummaryRows += 5;
    semestersWithSummary++;
  } else {
    semestersWithoutSummary++;
  }
}

const html = `<!DOCTYPE html>
<!-- SANITIZED TEST FIXTURE - IUH GPA Tool
     All data is FICTITIOUS. Real student data removed.
     DOM structure mirrors IUH ket-qua-hoc-tap.html.
     Stats: ${semesters.length} semesters, ${totalCourses} course rows,
            ${totalSummaryRows} summary rows (${semestersWithSummary} with / ${semestersWithoutSummary} without).
     Edge cases included:
       - Course #6: credits = 0
       - Course #22: DiemThuongKy6-9 all have data
       - Course #25: midterm = "0" (numeric zero, not missing)
       - Course #34: Thuc tap (special type)
       - Course #40: Khoa luan (special type, 9 credits)
       - Course #52: finalExam < 3 (fail condition edge)
       - Semesters HKH have no summary rows.
-->
<html lang="vi">
<head><meta charset="UTF-8"><title>Fixture – Ket qua hoc tap (sanitized)</title></head>
<body>
<div class="wrapper"><div class="main-content">
<div id="full-resize-table" class="container">
<div id="contnet" class="main-section-content">
<div class="box-df"><div class="portlet"><div class="portlet-body">
<div id="viewBangDiem" class="main-wrapper">
<div class="table-wrapper tbl-scrollable">
<table id="xemDiem_aaa" class="table-custom table table-bordered text-center freeze-table"
       width="100%" style="border-collapse:separate;">
${thead}
<tbody>
${body}
</tbody>
</table>
</div></div></div></div></div></div></div></div></div>
</body></html>`;

const outPath = path.join(__dirname, 'grade-page.sanitized.html');
fs.writeFileSync(outPath, html, 'utf8');
const stat = fs.statSync(outPath);
console.log('Fixture written:', outPath);
console.log('Size:', stat.size, 'bytes');
console.log('Semesters:', semesters.length, '| Courses:', totalCourses, '| Summary rows:', totalSummaryRows);
console.log('With summary:', semestersWithSummary, '| Without summary:', semestersWithoutSummary);
