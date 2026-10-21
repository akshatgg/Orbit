// Recurring series: every date is its own event, and dates of one series share `series_key`.

/**
 * Keeps only the soonest date of each series (one-off events pass through), preserving order
 * otherwise. Once a date ends it drops out of discovery queries, so the next date takes its place.
 */
export function nextOfEachSeries<T extends { series_key?: string | null; starts_at: string }>(events: T[]): T[] {
  const soonest = new Map<string, T>();
  for (const e of events) {
    if (!e.series_key) continue;
    const best = soonest.get(e.series_key);
    if (!best || new Date(e.starts_at).getTime() < new Date(best.starts_at).getTime()) soonest.set(e.series_key, e);
  }
  return events.filter((e) => !e.series_key || soonest.get(e.series_key) === e);
}

/** "Every week on Wednesday until December 10, 2026" → "Every week on Wednesday", for cards. */
export function shortSeriesLabel(label: string | null | undefined): string | null {
  const short = label?.replace(/\s+until\b.*$/i, "").trim();
  return short || null;
}

/** " · Every week on Wednesday" after a card's date, or "" for a one-off event. */
export function seriesHint(event: { series_label?: string | null }): string {
  const short = shortSeriesLabel(event.series_label);
  return short ? ` · ${short}` : "";
}

/** "Wed 28 Oct" for a series date chip, in the event's own timezone (UK time if it's unknown). */
export function seriesDayLabel(startsAt: string, timezone: string | null | undefined): string {
  const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone || "Europe/London" }).format(new Date(startsAt));
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Europe/London" }).format(new Date(startsAt));
  }
}
