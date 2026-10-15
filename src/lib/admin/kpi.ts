// Small number helpers for the admin overview. Pure, so they're unit-tested.

export type AdminStats = {
  users: number;
  onboarded: number;
  verified_students: number;
  signups_7d: number;
  organisers_pending: number;
  organisers_approved: number;
  upcoming_events: number;
  events_this_week: number;
  needs_review: number;
  registrations: number;
  registrations_7d: number;
  check_ins: number;
};

export const EMPTY_STATS: AdminStats = {
  users: 0, onboarded: 0, verified_students: 0, signups_7d: 0, organisers_pending: 0,
  organisers_approved: 0, upcoming_events: 0, events_this_week: 0, needs_review: 0,
  registrations: 0, registrations_7d: 0, check_ins: 0,
};

/** Coerces the admin_stats() JSON into numbers (bigint counts can arrive as strings). */
export function toStats(raw: unknown): AdminStats {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...EMPTY_STATS };
  for (const key of Object.keys(out) as (keyof AdminStats)[]) {
    const n = Number(src[key]);
    out[key] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

/** Whole-number percentage; 0 when there's nothing to divide by. */
export function percent(part: number, total: number) {
  if (!total || total < 0) return 0;
  return Math.round((Math.max(0, part) / total) * 100);
}

/** 950 → "950", 1234 → "1.2k", 25300 → "25k", 1200000 → "1.2m". */
export function compactNumber(n: number) {
  const abs = Math.abs(n);
  const fmt = (v: number, suffix: string) => `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}${suffix}`;
  if (abs >= 1e6) return fmt(n / 1e6, "m");
  if (abs >= 1e3) return fmt(n / 1e3, "k");
  return String(n);
}

export type DailyPoint = { day: string; count: number };

/**
 * Zero-fills a day series so the chart always has `days` bars ending on `today`
 * ("YYYY-MM-DD" in UK time).
 */
export function fillDailySeries(rows: { day: string; count: number }[], days: number, today: string): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), Number(r.count) || 0]));
  const end = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(end - i * 864e5).toISOString().slice(0, 10);
    out.push({ day, count: byDay.get(day) ?? 0 });
  }
  return out;
}

/** Bar heights as % of the tallest bar. Non-zero values stay visible (≥ 4%). */
export function barHeights(values: number[]) {
  const max = Math.max(0, ...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => (v <= 0 ? 0 : Math.max(4, Math.round((v / max) * 100))));
}

/** Sum of the last `n` points vs the `n` before them. */
export function periodDelta(series: DailyPoint[], n = 7) {
  const current = series.slice(-n).reduce((s, p) => s + p.count, 0);
  const previous = series.slice(-2 * n, -n).reduce((s, p) => s + p.count, 0);
  return { current, previous, change: current - previous };
}
