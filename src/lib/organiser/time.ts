// Event times are entered as UK wall-clock time (what organisers see on a poster), whatever
// timezone the organiser's device is in. These helpers convert between a `datetime-local`
// value ("2026-10-20T18:00") interpreted as Europe/London and a UTC ISO string, handling the
// GMT ⇄ BST switch.

export const EVENT_TZ = "Europe/London";

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: EVENT_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** London wall-clock time of an instant, encoded as if it were UTC (ms). */
function londonWallMs(utcMs: number) {
  const p: Record<string, number> = {};
  for (const part of partsFmt.formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
}

/** London's offset from UTC at an instant, in ms (0 in winter, 3 600 000 in summer). */
function londonOffsetMs(utcMs: number) {
  return londonWallMs(utcMs) - Math.floor(utcMs / 1000) * 1000;
}

/**
 * "2026-10-20T18:00" (London time) → "2026-10-20T17:00:00.000Z".
 * Ambiguous times (the repeated hour in October) resolve to the first occurrence (BST);
 * times that don't exist (the skipped hour in March) move forward by an hour.
 * Returns null for anything that isn't a valid datetime-local value.
 */
export function londonLocalToUtcIso(local: string | null | undefined): string | null {
  const m = LOCAL_RE.exec((local ?? "").trim());
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((v) => Number(v ?? 0));
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null;
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  // Reject impossible dates like 31 February (Date.UTC rolls them over).
  if (new Date(wall).getUTCDate() !== d) return null;

  const day = 24 * 36e5;
  const offsets = [...new Set([londonOffsetMs(wall - day), londonOffsetMs(wall + day)])];
  const candidates = offsets.map((o) => wall - o).filter((t) => londonWallMs(t) === wall);
  const utc = candidates.length > 0 ? Math.min(...candidates) : wall - londonOffsetMs(wall - day);
  return new Date(utc).toISOString();
}

/** UTC ISO string → "2026-10-20T18:00" in London time, for a datetime-local input. */
export function utcIsoToLondonLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return new Date(londonWallMs(t)).toISOString().slice(0, 16);
}

/** "GMT" or "BST" for a London wall-clock value — shown next to time inputs. */
export function londonZoneLabel(local: string | null | undefined): string | null {
  const iso = londonLocalToUtcIso(local);
  if (!iso) return null;
  return londonOffsetMs(new Date(iso).getTime()) === 0 ? "GMT" : "BST";
}
