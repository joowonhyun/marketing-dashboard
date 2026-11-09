import { expect, test } from "vitest";
import { normalizeDate, overlapsPeriod } from "@/shared/utils/dataset";

test("normalizeDate는 없는 날짜를 가짜 날짜로 채우지 않는다", () => {
  expect(normalizeDate(null)).toBeNull();
  expect(normalizeDate(undefined)).toBeNull();
  expect(normalizeDate("")).toBeNull();
  expect(normalizeDate("2026/04/12")).toBe("2026-04-12");
});

test("종료일 없는(진행 중) 캠페인은 시작 이후 모든 기간에 걸친다", () => {
  // db.json NAV-010: 2026-03-04 시작, endDate null
  expect(overlapsPeriod("2026-03-04", null, "2026-04-01", "2026-04-30")).toBe(true);
  expect(overlapsPeriod("2026-03-04", null, "2026-11-01", "2026-11-30")).toBe(true);
  expect(overlapsPeriod("2026-03-04", null, "2026-02-01", "2026-02-28")).toBe(false);
});

test("시작일 없는 캠페인은 종료일까지의 기간에 걸친다", () => {
  // db.json GGL-006: startDate null, 2026-04-23 종료
  expect(overlapsPeriod(null, "2026-04-23", "2026-04-01", "2026-04-30")).toBe(true);
  expect(overlapsPeriod(null, "2026-04-23", "2026-05-01", "2026-05-31")).toBe(false);
});

test("양끝이 닫힌 기간은 경계일을 포함해 겹침을 판정한다", () => {
  expect(overlapsPeriod("2026-04-30", "2026-05-10", "2026-04-01", "2026-04-30")).toBe(true);
  expect(overlapsPeriod("2026-03-01", "2026-03-31", "2026-04-01", "2026-04-30")).toBe(false);
});
