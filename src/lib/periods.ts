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

// ---- 営業日判定（土日・祝日） ----
// 「国民の祝日に関する法律」の恒久規定にもとづき祝日を算出する。
// 振替休日（祝日が日曜の場合の直後の平日）と国民の休日（祝日に挟まれた平日）も含む。
// 春分・秋分は 1980〜2099 年で有効な近似式を使用。

function nthMondayOfMonth(year: number, month: number, nth: number) {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  return 1 + ((8 - firstWeekday) % 7) + (nth - 1) * 7;
}

function equinoxDay(year: number, season: "spring" | "autumn") {
  const base = season === "spring" ? 20.8431 : 23.2488;
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function statutoryHolidays(year: number) {
  const holidays = new Map<string, string>();
  const set = (month: number, day: number, name: string) => {
    holidays.set(`${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`, name);
  };
  set(1, 1, "元日");
  set(1, nthMondayOfMonth(year, 1, 2), "成人の日");
  set(2, 11, "建国記念の日");
  set(2, 23, "天皇誕生日");
  set(3, equinoxDay(year, "spring"), "春分の日");
  set(4, 29, "昭和の日");
  set(5, 3, "憲法記念日");
  set(5, 4, "みどりの日");
  set(5, 5, "こどもの日");
  set(7, nthMondayOfMonth(year, 7, 3), "海の日");
  set(8, 11, "山の日");
  set(9, nthMondayOfMonth(year, 9, 3), "敬老の日");
  set(9, equinoxDay(year, "autumn"), "秋分の日");
  set(10, nthMondayOfMonth(year, 10, 2), "スポーツの日");
  set(11, 3, "文化の日");
  set(11, 23, "勤労感謝の日");
  return holidays;
}

function buildHolidayMap(year: number) {
  const statutory = statutoryHolidays(year);
  const result = new Map(statutory);

  // 国民の休日: 前日と翌日がともに祝日である平日
  for (const key of Array.from(statutory.keys())) {
    const between = toDateKey(addDays(parseDateKey(key), 1));
    const dayAfterNext = toDateKey(addDays(parseDateKey(key), 2));
    if (statutory.has(dayAfterNext) && !statutory.has(between) && parseDateKey(between).getDay() !== 0) {
      result.set(between, "国民の休日");
    }
  }

  // 振替休日: 祝日が日曜の場合、その後の最初の平日
  for (const key of Array.from(statutory.keys())) {
    if (parseDateKey(key).getDay() !== 0) continue;
    let cursor = addDays(parseDateKey(key), 1);
    while (result.has(toDateKey(cursor))) cursor = addDays(cursor, 1);
    result.set(toDateKey(cursor), "振替休日");
  }

  return result;
}

const holidayCache = new Map<number, Map<string, string>>();

export function holidayName(dateKey: string) {
  const year = Number(dateKey.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  let map = holidayCache.get(year);
  if (!map) {
    map = buildHolidayMap(year);
    holidayCache.set(year, map);
  }
  return map.get(dateKey) ?? null;
}

export function isHoliday(dateKey: string) {
  return holidayName(dateKey) !== null;
}

export function isWeekend(dateKey: string) {
  const day = parseDateKey(dateKey).getDay();
  return day === 0 || day === 6;
}

/** KPI集計の対象となる営業日か（土日・祝日を除く） */
export function isBusinessDay(dateKey: string) {
  return !isWeekend(dateKey) && !isHoliday(dateKey);
}
