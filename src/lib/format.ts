// Display helpers. Dates always render in UK time, whatever the device timezone.

const TZ = "Europe/London";

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const longFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ,
});
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

/** "Thu 16 Oct · 18:00" */
export function formatEventDate(startsAt: string | Date) {
  const d = new Date(startsAt);
  return `${dayFmt.format(d)} · ${timeFmt.format(d)}`;
}

/** "18:00 – 20:00" */
export function formatTimeRange(startsAt: string | Date, endsAt?: string | Date | null) {
  const start = timeFmt.format(new Date(startsAt));
  return endsAt ? `${start} – ${timeFmt.format(new Date(endsAt))}` : start;
}

/** "Thursday 16 October 2026" */
export function formatLongDate(d: string | Date) {
  return longFmt.format(new Date(d));
}

/** "2026-10-16" in UK time — for grouping events by day. */
export function dayKey(d: string | Date) {
  return dayKeyFmt.format(new Date(d));
}

/** "Free", "£5", "£5 – £15", or null when unknown. */
export function formatPrice(min: number | null, max: number | null, currency = "GBP") {
  if (min === null && max === null) return null;
  const money = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency", currency, minimumFractionDigits: n % 1 ? 2 : 0,
    }).format(n);
  const lo = min ?? max ?? 0;
  const hi = max ?? min ?? 0;
  if (hi === 0) return "Free";
  if (lo === hi) return money(lo);
  return `${lo === 0 ? "Free" : money(lo)} – ${money(hi)}`;
}

export const FORMAT_LABELS = { in_person: "In person", online: "Online", hybrid: "Hybrid" } as const;

/** Relative deadline text: "Closes in 3 days", "Closes today", "Closed". */
export function formatDeadline(deadline: string | null, now = new Date()) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - now.getTime();
  if (ms <= 0) return "Registration closed";
  const hours = Math.floor(ms / 36e5);
  if (hours < 24) return hours <= 1 ? "Closes within the hour" : `Closes in ${hours} hours`;
  const days = Math.round(hours / 24);
  return `Closes in ${days} day${days === 1 ? "" : "s"}`;
}
