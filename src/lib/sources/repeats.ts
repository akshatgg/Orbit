// Some organisers list each date of a repeating event as its own event (same title, same place),
// without the platform marking them as a series. Group those too, so they show as one series.

import type { NormalizedEvent } from "./types";

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Gives events that share a title and place (two or more dates) a common series key, scoped to the
 * source. Events the platform already put in a series keep theirs. Pure; order is preserved.
 */
export function groupRepeats(events: NormalizedEvent[], sourceKey: string): NormalizedEvent[] {
  const keyOf = (e: NormalizedEvent) => {
    const place = e.format === "online" ? "online" : norm(e.venueName) || norm(e.address) || norm(e.city);
    const title = norm(e.title);
    return title ? `${sourceKey}:${title}:${place}` : null;
  };
  const counts = new Map<string, number>();
  for (const e of events) {
    const key = e.seriesKey ? null : keyOf(e);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return events.map((e) => {
    if (e.seriesKey) return e;
    const key = keyOf(e);
    return key && (counts.get(key) ?? 0) > 1 ? { ...e, seriesKey: key } : e;
  });
}
