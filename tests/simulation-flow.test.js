/**
 * tests/simulation-flow.test.js
 * Integration tests cho luồng mô phỏng Realtime, cập nhật GPA học kỳ/tích lũy và reset
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { IUHPageAdapter } = require('../src/adapters/IUHPageAdapter.js');
const { SimulationStore } = require('../src/state/SimulationStore.js');

test('Simulation Flow: Thay đổi điểm cuối kỳ cập nhật realtime tổng kết và GPA các cấp', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector('table#xemDiem_aaa');

  const colMap = IUHPageAdapter.detectColumns(table).data;
  const semesters = IUHPageAdapter.parseSemesters(table, colMap).data;

  const store = new SimulationStore();
  store.setOriginalData(semesters);

  const initialDerived = store.getDerivedData();
  const targetCourseId = semesters[0].courses[0].id;
  const origScore10 = semesters[0].courses[0].officialResult.total10.value;
  const origSemGpa10 = initialDerived.semesters[0].calculatedOriginalGPA.gpa10;
  const origCumGpa10 = initialDerived.overallOriginal.gpa10;

  // 1. Mô phỏng nâng điểm thi cuối kỳ lên 10.0
  store.setCourseOverride(targetCourseId, { finalExam: 10.0 });

  const updatedDerived = store.getDerivedData();
  const updatedCourse = updatedDerived.semesters[0].courses.find(c => c.id === targetCourseId);

  // Điểm tổng kết môn phải tăng
  assert.ok(updatedCourse.score10 > origScore10);
  assert.equal(updatedCourse.isSimulated, true);

  // GPA học kỳ 1 phải tăng
  const updatedSemGpa10 = updatedDerived.semesters[0].calculatedSimulatedGPA.gpa10;
  assert.ok(updatedSemGpa10 > origSemGpa10);

  // GPA tích lũy toàn khóa phải tăng
  const updatedCumGpa10 = updatedDerived.overallSimulated.gpa10;
  assert.ok(updatedCumGpa10 > origCumGpa10);

  // Dữ liệu gốc vẫn giữ nguyên hoàn hảo
  assert.equal(updatedDerived.semesters[0].calculatedOriginalGPA.gpa10, origSemGpa10);
  assert.equal(updatedDerived.overallOriginal.gpa10, origCumGpa10);

  // 2. Khôi phục môn này
  store.resetCourse(targetCourseId);
  const revertedDerived = store.getDerivedData();
  assert.equal(revertedDerived.hasSimulations, false);
  assert.equal(revertedDerived.overallSimulated.gpa10, origCumGpa10);
});

test('Simulation Flow: Reset học kỳ (resetSemester)', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector('table#xemDiem_aaa');

  const colMap = IUHPageAdapter.detectColumns(table).data;
  const semesters = IUHPageAdapter.parseSemesters(table, colMap).data;

  const store = new SimulationStore();
  store.setOriginalData(semesters);

  const sem1 = semesters[0];
  const c1Id = sem1.courses[0].id;
  const c2Id = sem1.courses[1].id;

  store.setCourseOverride(c1Id, { finalExam: 9.0 });
  store.setCourseOverride(c2Id, { finalExam: 9.0 });
  assert.equal(store.getActiveSimulationsCount(), 2);

  // Reset học kỳ 1
  store.resetSemester(sem1.semesterKey);
  assert.equal(store.getActiveSimulationsCount(), 0);
  assert.equal(store.hasActiveSimulations(), false);
});

test('Performance check: Thay đổi slider trong store KHÔNG gọi lại parse DOM', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'grade-page.sanitized.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector('table#xemDiem_aaa');

  const colMap = IUHPageAdapter.detectColumns(table).data;
  const semesters = IUHPageAdapter.parseSemesters(table, colMap).data;

  const store = new SimulationStore();
  store.setOriginalData(semesters);

  // Spy vào IUHPageAdapter.parseSemesters
  let parseCallCount = 0;
  const origParse = IUHPageAdapter.parseSemesters;
  IUHPageAdapter.parseSemesters = (...args) => {
    parseCallCount++;
    return origParse.apply(IUHPageAdapter, args);
  };

  const courseId = semesters[0].courses[0].id;

  // Giả lập 50 events kéo slider liên tục từ 5.0 -> 10.0
  for (let s = 5.0; s <= 10.0; s += 0.1) {
    store.setCourseOverride(courseId, { finalExam: s });
    store.getDerivedData();
  }

  // Khôi phục spy
  IUHPageAdapter.parseSemesters = origParse;

  // Khẳng định: Trong suốt 51 lần slider event, parseSemesters trên DOM KHÔNG HỀ BỊ GỌI LẠI!
  assert.equal(parseCallCount, 0, 'Slider events không được kích hoạt DOM parsing lại');
});
