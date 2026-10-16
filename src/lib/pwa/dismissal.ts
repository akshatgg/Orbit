/** Banner timing: when to nudge, and for how long a dismissal is remembered. Storage may be unavailable. */

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export const VISITS_KEY = "orbit:install:visits";
export const DISMISSED_KEY = "orbit:install:dismissed-at";
export const MOMENT_KEY = "orbit:install:moment";
export const SESSION_KEY = "orbit:install:counted";

export const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
export const MIN_VISITS = 2;

function read(storage: StorageLike | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: StorageLike | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* private mode / quota / blocked: degrade to "never remembered" */
  }
}

function readNumber(storage: StorageLike | null, key: string): number {
  const n = Number(read(storage, key));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Counts one visit per browser session (the session flag stops reloads inflating it). */
export function recordVisit(local: StorageLike | null, session: StorageLike | null): number {
  const current = readNumber(local, VISITS_KEY);
  if (read(session, SESSION_KEY)) return current;
  const next = current + 1;
  write(local, VISITS_KEY, String(next));
  write(session, SESSION_KEY, "1");
  return next;
}

/** A meaningful moment (saved an event, got a ticket) makes the banner eligible straight away. */
export function recordMoment(local: StorageLike | null): void {
  write(local, MOMENT_KEY, "1");
}

export function readSignals(local: StorageLike | null) {
  return {
    visits: readNumber(local, VISITS_KEY),
    moment: read(local, MOMENT_KEY) === "1",
    dismissedAt: readNumber(local, DISMISSED_KEY) || null,
  };
}

export function recordDismissal(local: StorageLike | null, now: number): void {
  write(local, DISMISSED_KEY, String(now));
}

export function isDismissed(dismissedAt: number | null, now: number): boolean {
  return dismissedAt !== null && now - dismissedAt < DISMISS_MS;
}

export function isBannerDue(
  s: { visits: number; moment: boolean; dismissedAt: number | null },
  now: number,
): boolean {
  if (isDismissed(s.dismissedAt, now)) return false;
  return s.visits >= MIN_VISITS || s.moment;
}
