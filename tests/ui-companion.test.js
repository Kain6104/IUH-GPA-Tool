const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { SimulationStore } = require('../src/state/SimulationStore.js');
const { CompanionBar } = require('../src/ui/CompanionBar.js');
const { ExportEngine } = require('../src/core/ExportEngine.js');

test('CompanionBar: Khởi tạo với tablist và 5 tabs (Tổng quan, Kế hoạch, Tiến trình, Phân tích, Quyền riêng tư) không dùng emoji', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const root = dom.window.document.getElementById('root');

  const store = new SimulationStore([
    {
      semesterKey: 'HK1',
      semesterName: 'Học kỳ 1',
      courses: [
        {
          id: 'c1',
          courseName: 'Tin học đại cương',
          credits: { status: 'ok', value: 3 },
          officialResult: { total10: { status: 'ok', value: 7.0 }, score4: { status: 'ok', value: 3.0 }, letter: 'B', passed: true },
        },
      ],
    },
  ]);

  const bar = new CompanionBar({ store, mountParent: root });

  // Kiểm tra nút Xuất CSV
  const exportBtn = root.querySelector('#iuh-gpa-btn-export-csv');
  assert.ok(exportBtn);
  assert.equal(exportBtn.getAttribute('aria-label'), 'Xuất kết quả mô phỏng sang tệp CSV');
  const exportXlsxBtn = root.querySelector('#iuh-gpa-btn-export-xlsx');
  assert.ok(exportXlsxBtn);
  assert.equal(exportXlsxBtn.getAttribute('aria-label'), 'Xuất bảng điểm và phân tích sang tệp Excel .xlsx');
  const originalTriggerDownload = ExportEngine.triggerDownload;
  let exportCall = null;
  ExportEngine.triggerDownload = (content, fileName, mimeType) => {
    exportCall = { content, fileName, mimeType };
    return true;
  };
  try {
    exportXlsxBtn.click();
    assert.ok(exportCall?.content instanceof Uint8Array);
    assert.match(exportCall.fileName, /\.xlsx$/);
    assert.equal(exportCall.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } finally {
    ExportEngine.triggerDownload = originalTriggerDownload;
  }

  const tabList = root.querySelector('.iuh-gpa-tab-nav');
  assert.ok(tabList);
  assert.equal(tabList.getAttribute('role'), 'tablist');

  const tabs = root.querySelectorAll('.iuh-gpa-tab-btn');
  assert.equal(tabs.length, 5);

  const panels = root.querySelectorAll('.iuh-gpa-tab-panel');
  assert.equal(panels.length, 5);

  // Không dùng emoji làm biểu tượng
  const navText = tabList.textContent;
  assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(navText), false);

  // Phải có SVG icon kèm aria-hidden
  const svgIcons = tabList.querySelectorAll('svg.iuh-gpa-tab-icon');
  assert.equal(svgIcons.length, 5);
  svgIcons.forEach((svg) => {
    assert.equal(svg.getAttribute('aria-hidden'), 'true');
  });

  // Tab mặc định là simulation
  assert.equal(tabs[0].classList.contains('active'), true);
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(panels[0].classList.contains('active'), true);

  bar.destroy();
});

test('CompanionBar: Bốn mục phân tích xử lý dữ liệu, hiển thị mọi môn cải thiện và cảnh báo có mức độ', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const doc = dom.window.document;
  const root = doc.getElementById('root');
  const bar = new CompanionBar({ store: new SimulationStore([]), mountParent: root, doc });
  let appliedRescue = null;
  bar.store.setCourseOverride = (courseId, delta) => {
    appliedRescue = { courseId, delta };
  };
  const courses = Array.from({ length: 12 }, (_, index) => ({
    id: `course-${index}`,
    courseCode: `C${index}`,
    courseName: `Học phần ${index}`,
    credits: 3,
    score4: 1.0,
    gradeLetter: 'D',
    countsTowardGPA: true,
  }));

  bar.update({
    hasSimulations: false,
    overallOriginal: {
      gpa4: 2.4,
      gpa4Raw: 2.4,
      sumWeighted4: 120,
      gradedCredits: 50,
    },
    overallSimulated: {
      gpa4: 2.4,
      gpa4Raw: 2.4,
      sumWeighted4: 120,
      gradedCredits: 50,
    },
    allSimulatedCourses: courses,
    curriculumStatus: 'SYNCED',
    curriculumGaps: {
      hasGaps: true,
      gapCount: 1,
      summaryText: '1 vấn đề cần kiểm tra',
      gaps: [{
        severity: 'WARNING',
        type: 'CREDITS_MISMATCH',
        courseName: 'Học phần đối chiếu',
        message: 'Tín chỉ khác nhau',
        details: 'Bảng điểm và CTK không khớp',
      }],
    },
    semesters: [{ courses }],
    futurePlan: { semesters: [] },
  });
  bar.switchTab('analytics');

  assert.equal(root.querySelectorAll('#iuh-gpa-panel-target, #iuh-gpa-panel-forecast, #iuh-gpa-panel-rescue, #iuh-gpa-panel-gaps').length, 4);
  assert.notEqual(root.querySelector('#iuh-gpa-target-res-value').textContent, '--');
  assert.notEqual(root.querySelector('#iuh-gpa-forecast-proj-val').textContent, '--');
  assert.equal(root.querySelectorAll('.iuh-gpa-rescue-item').length, 12, 'Show the full improvement ranking, not only its first ten entries');
  const rescueAction = root.querySelector('.iuh-gpa-rescue-apply');
  assert.ok(rescueAction, 'A recommendation can be applied to the active simulation');
  rescueAction.click();
  assert.equal(appliedRescue.courseId, courses[0].id);
  assert.ok(appliedRescue.delta.score10 >= 0);
  const warning = root.querySelector('#iuh-gpa-gaps-list-container span');
  assert.equal(warning.textContent, 'Cần kiểm tra', 'WARNING gaps must be presented as actionable warnings');

  const targetInput = root.querySelector('#iuh-gpa-target-input-gpa');
  targetInput.value = '';
  targetInput.dispatchEvent(new dom.window.Event('input'));
  assert.equal(root.querySelector('#iuh-gpa-target-res-badge').textContent, 'Dữ liệu chưa hợp lệ');

  const forecastInput = root.querySelector('#iuh-gpa-forecast-input');
  forecastInput.value = '';
  forecastInput.dispatchEvent(new dom.window.Event('input'));
  assert.equal(root.querySelector('#iuh-gpa-forecast-proj-val').textContent, '--');
  assert.ok(root.querySelector('#iuh-gpa-forecast-proj-rank').textContent.length > 0);
  bar.destroy();
});

test('CompanionBar: Chuyển tab cập nhật role và hiển thị panel tương ứng', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const root = dom.window.document.getElementById('root');

  const store = new SimulationStore([]);
  const bar = new CompanionBar({ store, mountParent: root });

  // Chuyển sang Tab Target
  bar.switchTab('target');

  const targetTab = root.querySelector('#iuh-gpa-tab-target');
  const targetPanel = root.querySelector('#iuh-gpa-panel-target');
  const simTab = root.querySelector('#iuh-gpa-tab-overview');

  assert.equal(targetTab.classList.contains('active'), true);
  assert.equal(targetTab.getAttribute('aria-selected'), 'true');
  assert.equal(simTab.classList.contains('active'), false);
  assert.equal(simTab.getAttribute('aria-selected'), 'false');
  assert.equal(targetPanel.classList.contains('active'), true);

  // Chuyển sang Tab Forecast
  bar.switchTab('forecast');
  const forecastPanel = root.querySelector('#iuh-gpa-panel-forecast');
  assert.equal(forecastPanel.classList.contains('active'), true);

  // Chuyển sang Tab Rescue
  bar.switchTab('rescue');
  const rescuePanel = root.querySelector('#iuh-gpa-panel-rescue');
  assert.equal(rescuePanel.classList.contains('active'), true);

  bar.destroy();
});

test('CompanionBar: An toàn XSS trong Rescue UI (Tên môn độc hại không bị parse thành HTML tag)', () => {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>');
  const root = dom.window.document.getElementById('root');

  const maliciousName = '<img src=x onerror="window._xssTriggered=true">';
  const store = new SimulationStore([
    {
      semesterKey: 'HK1',
      courses: [
        {
          id: 'c_xss',
          courseName: maliciousName,
          credits: { status: 'ok', value: 4 },
          officialResult: { total10: { status: 'ok', value: 4.5 }, score4: { status: 'ok', value: 1.0 }, letter: 'D', passed: true },
        },
      ],
    },
  ]);

  const bar = new CompanionBar({ store, mountParent: root });
  bar.switchTab('rescue');

  // Đảm bảo không có thẻ img nào được tạo ra trong rescue list
  const imgTags = root.querySelectorAll('#iuh-gpa-rescue-course-list img');
  assert.equal(imgTags.length, 0);
  assert.equal(dom.window._xssTriggered, undefined);

  // TextContent phải chứa nguyên vẹn chuỗi độc hại
  const nameEl = root.querySelector('.iuh-gpa-rescue-name');
  assert.ok(nameEl);
  assert.ok(nameEl.textContent.includes(maliciousName));

  bar.destroy();
});
