import type { PeriodType, ReportType } from "./types";

const jpWeekday = ["日", "月", "火", "水", "木", "金", "土"];

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getWeekRange(dateKey: string) {
  const date = parseDateKey(dateKey);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(date, mondayOffset);
  const end = addDays(start, 6);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function getMonthRange(dateKey: string) {
  const date = parseDateKey(dateKey);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function getHalfRange(dateKey: string) {
  const date = parseDateKey(dateKey);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 5 && month <= 10) {
    return { start: `${year}-05-01`, end: `${year}-10-31`, label: `${year}年 上半期` };
  }

  const startYear = month >= 11 ? year : year - 1;
  return { start: `${startYear}-11-01`, end: `${startYear + 1}-04-30`, label: `${startYear}年 下半期` };
}

export function getPeriodRange(periodType: PeriodType, dateKey: string) {
  if (periodType === "day") return { start: dateKey, end: dateKey };
  if (periodType === "week") return getWeekRange(dateKey);
  if (periodType === "month") return getMonthRange(dateKey);
  return getHalfRange(dateKey);
}

export function getReportRange(reportType: ReportType, dateKey: string) {
  if (reportType === "daily") return { start: dateKey, end: dateKey };
  if (reportType === "weekly") return getWeekRange(dateKey);
  return getMonthRange(dateKey);
}

export function formatDateJa(dateKey: string) {
  const date = parseDateKey(dateKey);
  return `${date.getMonth() + 1}/${date.getDate()}(${jpWeekday[date.getDay()]})`;
}

export function eachDate(startKey: string, endKey: string) {
  const dates: string[] = [];
  let cursor = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}
