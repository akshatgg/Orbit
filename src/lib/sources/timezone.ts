// Wall-clock time in an IANA zone → UTC instant, using only Intl (no dependencies).

export const DEFAULT_TIMEZONE = "Europe/London";

export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Offset of `tz` from UTC at the instant `ms`, in milliseconds. */
function offsetAt(ms: number, tz: string) {
  const parts = Object.fromEntries(
    formatterFor(tz).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/**
 * The UTC instant at which clocks in `tz` show the given wall time.
 * A time skipped by a DST jump is moved forward (01:30 on spring-forward day → 02:30).
 */
export function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number },
  tz: string,
): Date {
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0);
  const first = wall - offsetAt(wall, tz);
  const firstOffset = offsetAt(first, tz);
  if (wall - firstOffset === first) return new Date(first);
  const second = wall - firstOffset;
  if (wall - offsetAt(second, tz) === second) return new Date(second);
  return new Date(Math.max(first, second)); // inside a DST gap
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day ("2026-10-22") an instant falls on in `tz` (London when `tz` isn't valid). */
export function localDay(ms: number, tz: string): string {
  const zone = isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
  let f = dayFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(zone, f);
  }
  return f.format(new Date(ms));
}
