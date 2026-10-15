import { DAY_PARTS, WEEKDAYS } from "@/lib/taxonomy";

export type Weekday = (typeof WEEKDAYS)[number]["value"];
export type DayPart = (typeof DAY_PARTS)[number]["value"];

/** Weekly availability as stored in `profiles.availability`: {"mon": ["evening"], ...}. */
export type Availability = Partial<Record<Weekday, DayPart[]>>;

const DAY_ORDER = WEEKDAYS.map((d) => d.value) as Weekday[];
const PART_ORDER = DAY_PARTS.map((p) => p.value) as DayPart[];

const isWeekday = (v: unknown): v is Weekday => typeof v === "string" && (DAY_ORDER as string[]).includes(v);
const isDayPart = (v: unknown): v is DayPart => typeof v === "string" && (PART_ORDER as string[]).includes(v);

/**
 * Cleans whatever is stored (or sent) into a canonical availability object:
 * unknown days/parts dropped, duplicates removed, parts in day order, empty days omitted.
 */
export function normalizeAvailability(raw: unknown): Availability {
  const out: Availability = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const day of DAY_ORDER) {
    const parts = (raw as Record<string, unknown>)[day];
    if (!Array.isArray(parts)) continue;
    const clean = PART_ORDER.filter((p) => parts.some((x) => x === p));
    if (clean.length) out[day] = clean;
  }
  return out;
}

export function hasSlot(a: Availability, day: Weekday, part: DayPart) {
  return a[day]?.includes(part) ?? false;
}

/** Returns a new availability with one day/part slot switched on or off. */
export function toggleSlot(a: Availability, day: Weekday, part: DayPart): Availability {
  if (!isWeekday(day) || !isDayPart(part)) return a;
  const current = a[day] ?? [];
  const next = current.includes(part) ? current.filter((p) => p !== part) : [...current, part];
  return normalizeAvailability({ ...a, [day]: next });
}

/** Sets `part` on for every day in `days` (used by the quick presets). */
export function withSlots(a: Availability, days: readonly Weekday[], parts: readonly DayPart[]): Availability {
  const next: Record<string, string[]> = { ...a };
  for (const d of days) next[d] = [...(next[d] ?? []), ...parts];
  return normalizeAvailability(next);
}

export function countSlots(a: Availability) {
  return Object.values(a).reduce((n, parts) => n + (parts?.length ?? 0), 0);
}

const DAY_LABEL = Object.fromEntries(WEEKDAYS.map((d) => [d.value, d.label])) as Record<Weekday, string>;
const PART_PLURAL: Record<DayPart, string> = { morning: "Mornings", day: "Afternoons", evening: "Evenings" };

/** "Mon–Thu" style ranges for a list of days in week order. */
export function formatDayRuns(days: readonly Weekday[]) {
  const idx = DAY_ORDER.filter((d) => days.includes(d)).map((d) => DAY_ORDER.indexOf(d));
  const runs: string[] = [];
  for (let i = 0; i < idx.length; i++) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1] === idx[j] + 1) j++;
    const from = DAY_LABEL[DAY_ORDER[idx[i]]];
    const to = DAY_LABEL[DAY_ORDER[idx[j]]];
    if (j - i >= 2) runs.push(`${from}–${to}`);
    else if (j === i) runs.push(from);
    else runs.push(from, to);
    i = j;
  }
  return runs.join(", ");
}

/** Human summary, e.g. "Evenings Mon–Thu · Afternoons Sat". Empty string when nothing is set. */
export function summariseAvailability(a: Availability) {
  const clean = normalizeAvailability(a);
  return PART_ORDER.map((part) => {
    const days = DAY_ORDER.filter((d) => clean[d]?.includes(part));
    if (!days.length) return null;
    return `${PART_PLURAL[part]} ${days.length === 7 ? "every day" : formatDayRuns(days)}`;
  })
    .filter(Boolean)
    .join(" · ");
}
