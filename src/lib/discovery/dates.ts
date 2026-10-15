// UK-local calendar maths for discovery (week view, calendar grid, date filters).
// Pure: every function takes the clock as an argument.

import { dayKey } from "@/lib/format";

const TZ = "Europe/London";
const DAY = 864e5;

const offsetFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, timeZoneName: "longOffset" });

/** Minutes UK local time is ahead of UTC at an instant (0 in winter, 60 in summer). */
export function ukOffsetMinutes(at: Date): number {
  const name = offsetFmt.formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const mins = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -mins : mins;
}

const parseKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
};

/** The instant UK midnight starts on a "YYYY-MM-DD" day. */
export function ukStartOfDay(key: string): Date {
  const { y, m, d } = parseKey(key);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // Offset at that day (checked twice to be safe around the clock change).
  let guess = utcMidnight - ukOffsetMinutes(new Date(utcMidnight)) * 6e4;
  guess = utcMidnight - ukOffsetMinutes(new Date(guess)) * 6e4;
  return new Date(guess);
}

/** "YYYY-MM-DD" n days after `key`. */
export function addDays(key: string, n: number): string {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d) + n * DAY).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: string): number {
  const { y, m, d } = parseKey(key);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** "YYYY-MM" for an instant, in UK time. */
export function monthKeyOf(at: Date): string {
  return dayKey(at).slice(0, 7);
}

export function isMonthKey(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) && Number(s.slice(0, 4)) >= 2000 && Number(s.slice(0, 4)) <= 2100;
}

export function isDayKey(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parseKey(s);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return dt.toISOString().slice(0, 7);
}

/** UK-local [start, end) instants covering a whole month. */
export function monthRange(month: string): { start: Date; end: Date } {
  return { start: ukStartOfDay(`${month}-01`), end: ukStartOfDay(`${shiftMonth(month, 1)}-01`) };
}

export type GridDay = { key: string; day: number; inMonth: boolean };

/** Monday-first weeks covering the month (leading/trailing days from neighbouring months). */
export function monthGrid(month: string): GridDay[][] {
  const first = `${month}-01`;
  let cursor = addDays(first, -weekdayIndex(first));
  const next = `${shiftMonth(month, 1)}-01`;
  const weeks: GridDay[][] = [];
  while (cursor < next || weeks.length === 0) {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ key: cursor, day: Number(cursor.slice(8)), inMonth: cursor.startsWith(month) });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
/** "October 2026" */
export function formatMonth(month: string): string {
  return monthFmt.format(new Date(`${month}-01T12:00:00Z`));
}

const shortDayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
/** "Saturday 18 October" for a day key. */
export function formatDayKey(key: string): string {
  return shortDayFmt.format(new Date(`${key}T12:00:00Z`));
}

const rangeFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
/** "16 Oct – 22 Oct" for two day keys. */
export function formatDayRange(fromKey: string, toKey: string): string {
  return `${rangeFmt.format(new Date(`${fromKey}T12:00:00Z`))} – ${rangeFmt.format(new Date(`${toKey}T12:00:00Z`))}`;
}

export type DatePreset = "today" | "week" | "weekend" | "month";

/** [from, to) for a date filter, starting no earlier than `now`. */
export function datePresetRange(preset: DatePreset, now: Date): { from: Date; to: Date } {
  const today = dayKey(now);
  switch (preset) {
    case "today":
      return { from: now, to: ukStartOfDay(addDays(today, 1)) };
    case "week":
      return { from: now, to: new Date(now.getTime() + 7 * DAY) };
    case "month":
      return { from: now, to: new Date(now.getTime() + 30 * DAY) };
    case "weekend": {
      // This coming Saturday — or the current one when it's already the weekend.
      const saturday = addDays(today, 5 - weekdayIndex(today));
      const start = ukStartOfDay(saturday);
      return { from: start > now ? start : now, to: ukStartOfDay(addDays(saturday, 2)) };
    }
  }
}
