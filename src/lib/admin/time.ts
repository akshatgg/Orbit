// UK wall-clock time <-> UTC. Admins type times as they appear on posters in London;
// the database stores UTC. Works the same in the browser and on the server.

export const UK_TZ = "Europe/London";

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function ukParts(date: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second),
  };
}

/** Minutes the UK is ahead of UTC at this instant (0 in winter, 60 in summer). */
export function ukOffsetMinutes(date: Date) {
  const p = ukParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * "2026-10-20T18:00" or "2026-10-20 18:00" (UK wall-clock) → UTC Date, or null if invalid.
 * Clocks-go-forward gaps (e.g. 01:30 on the last Sunday of March) resolve to the later offset;
 * repeated times when clocks go back resolve to the first (BST) occurrence.
 */
export function ukLocalToUtc(local: string): Date | null {
  const m = LOCAL_RE.exec(local.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? "0"].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const naive = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(naive);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null; // 31 Feb etc.

  // Try both possible offsets; prefer the one that round-trips to the same wall-clock time.
  const candidates = [60, 0].map((off) => new Date(naive - off * 60000));
  for (const c of candidates) {
    if (ukOffsetMinutes(c) * 60000 === naive - c.getTime()) return c;
  }
  // Wall-clock time that doesn't exist (spring-forward gap): use the offset after the change.
  return new Date(naive - ukOffsetMinutes(new Date(naive)) * 60000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** UTC instant → "2026-10-20T18:00" in UK time, for <input type="datetime-local">. */
export function utcToUkLocalInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = ukParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const ISO_WITH_ZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const UK_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})$/;

/**
 * Accepts what people paste into spreadsheets:
 * - ISO with a zone: "2026-10-20T17:00:00Z", "2026-10-20T18:00+01:00" (exact instant)
 * - UK wall-clock: "2026-10-20 18:00", "2026-10-20T18:00", "20/10/2026 18:00"
 * Returns a UTC Date, or null when the value isn't a date we understand.
 */
export function parseFlexibleDate(raw: string | null | undefined): Date | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (ISO_WITH_ZONE_RE.test(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const uk = UK_DATE_RE.exec(value);
  if (uk) {
    const [, dd, mm, yyyy, hh, min] = uk;
    return ukLocalToUtc(`${yyyy}-${pad(Number(mm))}-${pad(Number(dd))} ${hh}:${min}`);
  }
  return ukLocalToUtc(value);
}
