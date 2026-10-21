// Deterministic category guessing for imported events.
//
// Imported discovery events (a Meetup search, a Luma city page) have no category of their own, and
// copying one default category onto all of them puts unrelated events in the same tile. This scores
// an event's title, tags and prose against each category's keywords, then only answers when one
// category clearly wins. Pure — no database, no network — so it is cheap to test and easy to tune.

export type ClassifyCategory = {
  id: string;
  name: string;
  /** Editable per category in the admin (comma separated there). */
  keywords?: readonly string[] | null;
};

export type ClassifiableEvent = {
  title: string;
  summary?: string | null;
  description?: string | null;
  tags?: readonly string[] | null;
};

export type Classification = {
  categoryId: string | null;
  score: number;
  /** Which terms hit, for tests and for explaining a classification later. */
  matched: string[];
  reason: "matched" | "ambiguous" | "no-match";
};

export type ClassifyOptions = {
  /** Minimum score before a category is assigned at all. */
  minScore?: number;
  /** How far ahead of the runner-up the winner must be. */
  margin?: number;
};

export const CLASSIFY_DEFAULTS = { minScore: 3, margin: 2 } as const;

/** Words too common to identify a category — they appear in almost every listing. */
const STOPWORDS = new Set([
  "and", "or", "the", "of", "a", "an", "for", "in", "on", "at", "to", "with", "by", "from",
  "event", "events", "club", "group", "online", "free",
]);

/** A hit in the title says more than one buried in the description. */
const WEIGHT = { title: 3, tags: 2, summary: 1, description: 1 } as const;

export const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/** Whole-word (or whole-phrase) match: "run" must not fire on "running". */
export const contains = (haystack: string, term: string) => ` ${haystack} `.includes(` ${term} `);

/** True when an already-counted phrase contains this shorter term ("case competition" covers "competition"). */
const covers = (phrase: string, term: string) =>
  phrase === term ||
  phrase.startsWith(`${term} `) ||
  phrase.endsWith(` ${term}`) ||
  phrase.includes(` ${term} `);

/** A category's keywords plus the usable words of its name ("Careers fair" → careers, fair). */
export function categoryTerms(category: ClassifyCategory): string[] {
  const keywords = (category.keywords ?? []).map(normalize).filter(Boolean);
  const nameWords = normalize(category.name)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
  return [...new Set([...keywords, ...nameWords])].filter((term) => term.length >= 3);
}

/**
 * Scores every category and returns the winner, or `categoryId: null` when nothing is clear.
 * Multi-word keywords score double — "case competition" is a stronger signal than "competition".
 */
export function classifyEvent(
  event: ClassifiableEvent,
  categories: readonly ClassifyCategory[],
  options: ClassifyOptions = {},
): Classification {
  const minScore = options.minScore ?? CLASSIFY_DEFAULTS.minScore;
  const margin = options.margin ?? CLASSIFY_DEFAULTS.margin;
  const fields = {
    title: normalize(event.title),
    tags: normalize((event.tags ?? []).join(" ")),
    summary: normalize(event.summary ?? ""),
    description: normalize(event.description ?? ""),
  };

  const ranked = categories
    .map((category) => {
      const matched: string[] = [];
      let score = 0;
      // Longest phrases first, so "case competition" counts once instead of also scoring "competition".
      const terms = categoryTerms(category).sort((a, b) => b.split(" ").length - a.split(" ").length);
      for (const term of terms) {
        if (matched.some((hit) => covers(hit, term))) continue;
        const weight =
          contains(fields.title, term) ? WEIGHT.title
          : contains(fields.tags, term) ? WEIGHT.tags
          : contains(fields.summary, term) ? WEIGHT.summary
          : contains(fields.description, term) ? WEIGHT.description
          : 0;
        if (!weight) continue;
        score += weight * (term.includes(" ") ? 2 : 1);
        matched.push(term);
      }
      return { id: category.id, score, matched };
    })
    // Ties would otherwise depend on database order; the id keeps the result stable.
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const best = ranked[0];
  if (!best || best.score < minScore) {
    return { categoryId: null, score: best?.score ?? 0, matched: best?.matched ?? [], reason: "no-match" };
  }
  const runnerUp = ranked[1];
  if (runnerUp && best.score - runnerUp.score < margin) {
    return { categoryId: null, score: best.score, matched: best.matched, reason: "ambiguous" };
  }
  return { categoryId: best.id, score: best.score, matched: best.matched, reason: "matched" };
}
