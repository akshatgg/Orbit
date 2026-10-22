// Groups an ordered event listing so a recurring event pages as one entry (admin events table).

/**
 * The listing's ids as entries in order: a one-off event is `[id]`, a recurring series is all of
 * its ids, placed where its first date in the listing sits.
 */
export function seriesEntries(rows: { id: string; series_key: string | null }[]): string[][] {
  const entries: string[][] = [];
  const bySeries = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.series_key) {
      entries.push([r.id]);
      continue;
    }
    const dates = bySeries.get(r.series_key);
    if (dates) dates.push(r.id);
    else {
      const first = [r.id];
      bySeries.set(r.series_key, first);
      entries.push(first);
    }
  }
  return entries;
}
