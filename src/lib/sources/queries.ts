import "server-only";
import { importOptions } from "@/lib/admin/options";
import { isNotFound } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { IMPORTED_KINDS, type EventSource, type ImportedKind, type SourceEventDetails, type SourceRun } from "./types";

// Admin screens read the Orbit API's /admin/sources endpoints as the signed-in admin.

type Page<T> = { items: T[]; total: number; page: number; page_size: number };

export type SourceWithDefaults = EventSource & {
  organiser_name: string | null;
  category_name: string | null;
  latest_run: SourceRun | null;
};

/** How many events each source has in ORBIT (any status): a recurring series counts once. */
export type SourceEventCount = { events: number; dates: number };

export type ReviewCounts = { missing: number; duplicates: number; hidden: number };

type OverviewSource = SourceWithDefaults & { event_count: number; date_count: number };

/** Every source with its latest run and event counts, plus the review dashboard's counts. */
export async function sourcesOverview() {
  const overview = await authed.get<{ sources: OverviewSource[]; review_counts: ReviewCounts }>("/admin/sources/overview");
  const eventCounts = new Map<string, SourceEventCount>(
    overview.sources.map((s) => [s.id, { events: s.event_count, dates: s.date_count }]),
  );
  return { sources: overview.sources as SourceWithDefaults[], eventCounts, reviewCounts: overview.review_counts };
}

export async function listSources() {
  return (await authed.get<Page<SourceWithDefaults>>("/admin/sources")).items;
}

export async function getSource(id: string) {
  try {
    return await authed.get<SourceWithDefaults>(`/admin/sources/${id}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export type RunWithSource = SourceRun & { source: { name: string } | null };

export async function listRecentRuns({ sourceId, limit = 25 }: { sourceId?: string; limit?: number } = {}) {
  const { items } = await authed.get<Page<SourceRun & { source_name: string }>>("/admin/sources/runs", {
    query: { source_id: sourceId, limit },
  });
  return items.map<RunWithSource>(({ source_name, ...run }) => ({ ...run, source: { name: source_name } }));
}

/** Approved organisers and every category, for a source's defaults. */
export async function listFormOptions() {
  const { organisers, categories } = await importOptions();
  return {
    organisers: organisers.filter((o) => o.status === "approved").map(({ id, name }) => ({ id, name })),
    categories: categories.map(({ id, name }) => ({ id, name })),
  };
}

// ─── Review queue ──────────────────────────────────────────────────────────

export type ReviewEvent = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  format: string;
  status: string;
  source: string;
  /** The source's name ("Deleted source" once it's gone). */
  source_name: string;
  source_url: string | null;
  source_event_id: string | null;
  external_url: string | null;
  duplicate_of: string | null;
  needs_review: boolean;
  last_verified_at: string;
  created_at: string;
  organiser_id: string | null;
  organiser: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
};

export type ReviewItem = {
  event: ReviewEvent;
  original: ReviewEvent | null;
  reason: "duplicate" | "missing" | "flagged";
};

type Pair = { event: ReviewEvent; original: ReviewEvent | null };

/** "source:<id>" (or a built-in source) → its name, from the events a list already holds. */
export function labelFrom(events: (ReviewEvent | null)[]) {
  const names = new Map(events.filter((e): e is ReviewEvent => !!e).map((e) => [e.source, e.source_name]));
  return (source: string) => names.get(source) ?? source;
}

/** How many events wait in each part of the review dashboard. */
export async function reviewCounts(): Promise<ReviewCounts> {
  return authed.get<ReviewCounts>("/admin/sources/review/counts");
}

export type MissingItem = { event: ReviewEvent; reason: "missing" | "flagged"; daysAway: number; sourceName: string };

type MissingRow = ReviewEvent & { reason: "missing" | "flagged"; days_away: number };

/**
 * Events flagged for review that aren't duplicates (missing from their feed, or flagged another
 * way), soonest first, a page at a time; optionally one source's. `sources` counts them per source
 * for the filter.
 */
export async function listMissingReview({ page = 1, pageSize = 50, sourceId = null }: {
  page?: number; pageSize?: number; sourceId?: string | null;
} = {}) {
  const result = await authed.get<Page<MissingRow> & { sources: { source: string; id: string | null; name: string; count: number }[] }>(
    "/admin/sources/review/missing",
    { query: { page, page_size: pageSize, source_id: sourceId } },
  );
  const items = result.items.map<MissingItem>(({ reason, days_away, ...event }) => ({
    event,
    reason,
    daysAway: days_away,
    sourceName: event.source_name,
  }));
  const sources = result.sources
    .filter((s): s is { source: string; id: string; name: string; count: number } => !!s.id)
    .map(({ id, name, count }) => ({ id, name, count }));
  return { items, total: result.total, sources };
}

/** Possible duplicates waiting for a decision, each with the event it may duplicate; a page at a time. */
export async function listDuplicateReview({ page = 1, pageSize = 20 }: { page?: number; pageSize?: number } = {}) {
  const result = await authed.get<Page<Pair>>("/admin/sources/review/duplicates", { query: { page, page_size: pageSize } });
  return { items: result.items.map<ReviewItem>((r) => ({ ...r, reason: "duplicate" })), total: result.total };
}

/** Duplicates that an admin chose to keep hidden (resolved, but still reversible). */
export async function listHiddenDuplicates({ limit = 50 }: { limit?: number } = {}) {
  const result = await authed.get<Page<Pair>>("/admin/sources/review/hidden", { query: { limit } });
  return result.items;
}

// ─── Imported platform events (details editor) ────────────────────────────

export type ImportedEvent = {
  id: string;
  title: string;
  starts_at: string;
  cover_url: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string;
  kind: ImportedKind;
  external_url: string | null;
  source: string;
  source_event_id: string | null;
  details: Pick<SourceEventDetails, "status" | "attempts" | "last_error" | "fetched_at"> | null;
};

/** Upcoming published events from platform sources (Luma, Meetup, Eventbrite, Fatsoma); ones without a cover first. */
export async function listImportedEvents({ limit = 60 }: { limit?: number } = {}) {
  const { items } = await authed.get<Page<Omit<ImportedEvent, "kind"> & { kind: string }>>("/admin/sources/imported", { query: { limit } });
  const imported = new Set<string>(IMPORTED_KINDS);
  // Only platform events have a details editor; iCal feeds own everything they send.
  return items
    .filter((e) => imported.has(e.kind))
    .map<ImportedEvent>((e) => ({ ...e, kind: e.kind as ImportedKind }));
}
