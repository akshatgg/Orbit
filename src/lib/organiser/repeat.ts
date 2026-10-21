// Pure helpers for events that run on several dates. Times are London wall-clock strings, as the
// editor's datetime-local inputs hold them ("2026-10-28T17:00"), so a weekly event keeps its local
// time across the clocks changing.

/** Most dates one event can be created with in one go (the first date plus these). */
export const MAX_EXTRA_DATES = 25;

export type DateSlot = { key: string; starts_at: string; ends_at: string };

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** The same wall-clock time `days` later ("" stays ""). Works on dates ("2026-10-28") too. */
export function shiftLocalDays(local: string, days: number): string {
  const m = local.match(LOCAL);
  if (!m) return local;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days, +(m[4] ?? 0), +(m[5] ?? 0)));
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return m[4] === undefined ? date : `${date}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Whole calendar days from `a` to `b` (by their dates, ignoring the time of day). */
export function daysBetween(a: string, b: string): number {
  const da = a.match(LOCAL);
  const db = b.match(LOCAL);
  if (!da || !db) return 0;
  return Math.round((Date.UTC(+db[1], +db[2] - 1, +db[3]) - Date.UTC(+da[1], +da[2] - 1, +da[3])) / 86_400_000);
}

/** The slot a week after `slot`, same times and length. */
export function nextWeek(slot: Pick<DateSlot, "starts_at" | "ends_at">, key: string): DateSlot {
  return { key, starts_at: shiftLocalDays(slot.starts_at, 7), ends_at: slot.ends_at ? shiftLocalDays(slot.ends_at, 7) : "" };
}

/**
 * Weekly slots after `first` up to and including `until` (a date, "2026-12-09"), capped at
 * MAX_EXTRA_DATES. `makeKey` gives each new slot its React key.
 */
export function weeklyUntil(first: Pick<DateSlot, "starts_at" | "ends_at">, until: string, makeKey: () => string): DateSlot[] {
  const out: DateSlot[] = [];
  if (!LOCAL.test(first.starts_at) || !LOCAL.test(until)) return out;
  let slot = { ...first };
  while (out.length < MAX_EXTRA_DATES) {
    slot = nextWeek(slot, makeKey());
    if (daysBetween(slot.starts_at, until) < 0) break;
    out.push(slot as DateSlot);
  }
  return out;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * "Every week on Wednesday until 9 December 2026" when the dates are exactly a week apart,
 * otherwise null (the event page then just lists the dates).
 */
export function weeklyLabel(startsAts: string[]): string | null {
  const sorted = [...startsAts].filter((s) => LOCAL.test(s)).sort();
  if (sorted.length < 2) return null;
  for (let i = 1; i < sorted.length; i++) if (daysBetween(sorted[i - 1], sorted[i]) !== 7) return null;
  const parse = (s: string) => s.match(LOCAL)!;
  const first = parse(sorted[0]);
  const last = parse(sorted[sorted.length - 1]);
  const weekday = WEEKDAYS[new Date(Date.UTC(+first[1], +first[2] - 1, +first[3])).getUTCDay()];
  return `Every week on ${weekday} until ${+last[3]} ${MONTHS[+last[2] - 1]} ${last[1]}`;
}
