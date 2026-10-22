// Pure helpers for the review dashboard on /admin/sources.

const DAY_MS = 24 * 60 * 60 * 1000;
const londonDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

/** Whole calendar days (UK time) from today to `iso`: 0 = today, 1 = tomorrow, negative = past. */
export function daysAway(iso: string, now = new Date()): number {
  const day = (d: Date) => Date.parse(`${londonDay.format(d)}T00:00:00Z`);
  return Math.round((day(new Date(iso)) - day(now)) / DAY_MS);
}

/** "Started", "Today", "Tomorrow", "In 3 days". */
export function startsInLabel(days: number): string {
  if (days < 0) return "Started";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** The ids a bulk action was sent: comma-separated uuids, de-duplicated, at most `max`. */
export function parseIdList(raw: unknown, max = 500): string[] | null {
  if (typeof raw !== "string") return null;
  const ids = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return ids.length > 0 && ids.length <= max && ids.every((id) => uuid.test(id)) ? ids : null;
}
