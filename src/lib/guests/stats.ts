import type { RegistrationStatus } from "@/types/database";
import { REGISTRATION_STATUSES, type Guest } from "./types";

export type StatusCounts = Record<RegistrationStatus, number>;

type RegLike = Pick<Guest, "status" | "registeredAt" | "checkedInAt">;

export function emptyStatusCounts(): StatusCounts {
  return Object.fromEntries(REGISTRATION_STATUSES.map((s) => [s, 0])) as StatusCounts;
}

/** Registrations per status. Unknown statuses are ignored. */
export function countByStatus(regs: Pick<Guest, "status">[]): StatusCounts {
  const counts = emptyStatusCounts();
  for (const r of regs) if (r.status in counts) counts[r.status] += 1;
  return counts;
}

/** Confirmed guests who have been checked in. */
export function countCheckedIn(regs: Pick<Guest, "status" | "checkedInAt">[]): number {
  return regs.filter((r) => r.status === "going" && r.checkedInAt).length;
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/London" });
const dayLabelUtc = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export type DayBucket = { key: string; label: string; count: number };

/**
 * New registrations per UK calendar day for the last `days` days (oldest first, today last).
 * Days with no registrations are included with a count of 0.
 */
export function registrationsByDay(regs: Pick<Guest, "registeredAt">[], days = 14, now = new Date()): DayBucket[] {
  const buckets: DayBucket[] = [];
  const index = new Map<string, DayBucket>();
  // Walk calendar days from today's UK date at UTC noon, so clock changes never skip or repeat a day.
  const [y, m, d] = dayKeyFmt.format(now).split("-").map(Number);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.UTC(y, m - 1, d - i, 12));
    const key = day.toISOString().slice(0, 10);
    const bucket = { key, label: dayLabelUtc.format(day), count: 0 };
    buckets.push(bucket);
    index.set(key, bucket);
  }
  for (const r of regs) {
    const bucket = index.get(dayKeyFmt.format(new Date(r.registeredAt)));
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

/** Share of `part` in `whole` as a whole-number percentage, or null when `whole` is 0. */
export function percent(part: number, whole: number): number | null {
  if (!whole || whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

export type EventStats = {
  counts: StatusCounts;
  total: number;
  /** Registrations that are or were active (everything except cancelled). */
  active: number;
  checkedIn: number;
  views: number;
  applyClicks: number;
  /** Going + holding a spot (pending / awaiting payment) against capacity. */
  capacity: { cap: number; going: number; held: number; percent: number } | null;
  /** View → registration conversion (tickets) or view → Apply-now click (external links). */
  conversion: number | null;
  byDay: DayBucket[];
};

/** All overview numbers for one event, from its registrations and interaction counts. */
export function buildEventStats(
  regs: RegLike[],
  { views, applyClicks, capacity, mode, now = new Date() }: {
    views: number; applyClicks: number; capacity: number | null; mode: "tickets" | "external" | "none"; now?: Date;
  },
): EventStats {
  const counts = countByStatus(regs);
  const total = regs.length;
  const active = total - counts.cancelled;
  const held = counts.pending + counts.awaiting_payment;
  return {
    counts,
    total,
    active,
    checkedIn: countCheckedIn(regs),
    views,
    applyClicks,
    capacity: capacity
      ? { cap: capacity, going: counts.going, held, percent: Math.min(100, percent(counts.going + held, capacity) ?? 0) }
      : null,
    conversion: mode === "external" ? percent(applyClicks, views) : percent(total, views),
    byDay: registrationsByDay(regs, 14, now),
  };
}
