// Duplicate detection across all sources: same start (±30 min) and a similar title.

const STOPWORDS = new Set(["the", "a", "an", "and", "of", "for", "with", "at", "in", "on", "to", "by", "x", "vs"]);

export const DUPLICATE_WINDOW_MINUTES = 30;
export const JACCARD_THRESHOLD = 0.6;

/** Lowercase, no accents or punctuation, "&" → "and", single spaces. */
export function normaliseTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function titleTokens(title: string) {
  return new Set(normaliseTitle(title).split(" ").filter((t) => t && !STOPWORDS.has(t)));
}

export function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Token Jaccard ≥ 0.6, or one normalised title contains the other as whole words. */
export function titlesSimilar(a: string, b: string) {
  const na = normaliseTitle(a);
  const nb = normaliseTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (short.length >= 8 && ` ${long} `.includes(` ${short} `)) return true;
  return jaccard(titleTokens(a), titleTokens(b)) >= JACCARD_THRESHOLD;
}

export type DuplicateCandidate = {
  id: string;
  title: string;
  starts_at: string;
  source: string;
  created_at: string;
};

/** Events created in ORBIT (by organisers or admins) are the originals. */
export function isOrbitNative(source: string) {
  return source === "orbit" || source === "manual";
}

/** Lower wins: ORBIT-native, then manual, then CSV, then automatic sources. */
export function sourceRank(source: string) {
  if (source === "orbit") return 0;
  if (source === "manual") return 1;
  if (source === "csv") return 2;
  return 3;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Returns which events are duplicates of which. The highest-ranked event (ORBIT-native first,
 * then the oldest) is kept; the others point at it. Two ORBIT-native events are never paired
 * (organisers own those), and pairs an admin marked "Not a duplicate" are skipped.
 */
export function findDuplicates(
  events: DuplicateCandidate[],
  { dismissed = new Set<string>(), windowMinutes = DUPLICATE_WINDOW_MINUTES }: { dismissed?: Set<string>; windowMinutes?: number } = {},
): { id: string; duplicateOf: string }[] {
  const windowMs = windowMinutes * 60 * 1000;
  const ordered = [...events].sort(
    (a, b) => sourceRank(a.source) - sourceRank(b.source) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  const kept: (DuplicateCandidate & { ms: number })[] = [];
  const result: { id: string; duplicateOf: string }[] = [];

  for (const event of ordered) {
    const ms = new Date(event.starts_at).getTime();
    const original = kept.find(
      (k) =>
        Math.abs(k.ms - ms) <= windowMs &&
        !(isOrbitNative(k.source) && isOrbitNative(event.source)) &&
        !dismissed.has(pairKey(k.id, event.id)) &&
        titlesSimilar(k.title, event.title),
    );
    if (original) result.push({ id: event.id, duplicateOf: original.id });
    else kept.push({ ...event, ms });
  }
  return result;
}
