import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { EventSource, SourceEventDetails, SourceRun } from "./types";
import { sourceIdFromKey, sourceKey } from "./types";

// Admin screens read through the signed-in admin's client, so RLS still applies.

export type SourceWithDefaults = EventSource & {
  organiser: { name: string } | null;
  category: { name: string } | null;
};

export async function listSources() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_sources")
    .select("*, organiser:organisers ( name ), category:categories ( name )")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SourceWithDefaults[];
}

export async function getSource(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("event_sources").select("*").eq("id", id).maybeSingle();
  return data as EventSource | null;
}

export type RunWithSource = SourceRun & { source: { name: string } | null };

export async function listRecentRuns({ sourceId, limit = 25 }: { sourceId?: string; limit?: number } = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("source_runs")
    .select("*, source:event_sources ( name )")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (sourceId) query = query.eq("source_id", sourceId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RunWithSource[];
}

/** The most recent run per source. */
export async function latestRunBySource(sourceIds: string[]) {
  const map = new Map<string, SourceRun>();
  if (sourceIds.length === 0) return map;
  const supabase = await createClient();
  const results = await Promise.all(
    sourceIds.map((id) =>
      supabase.from("source_runs").select("*").eq("source_id", id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ),
  );
  results.forEach(({ data }, i) => {
    if (data) map.set(sourceIds[i], data as SourceRun);
  });
  return map;
}

/** How many events each source has in ORBIT (any status). */
export async function eventCountsBySource(sourceIds: string[]) {
  const supabase = await createClient();
  const counts = await Promise.all(
    sourceIds.map((id) =>
      supabase.from("events").select("id", { count: "exact", head: true }).eq("source", `source:${id}`),
    ),
  );
  return new Map(sourceIds.map((id, i) => [id, counts[i].count ?? 0]));
}

export async function listFormOptions() {
  const supabase = await createClient();
  const [{ data: organisers }, { data: categories }] = await Promise.all([
    supabase.from("organisers").select("id, name, status").eq("status", "approved").order("name"),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);
  return {
    organisers: (organisers ?? []) as { id: string; name: string }[],
    categories: (categories ?? []) as { id: string; name: string }[],
  };
}

// ─── Review queue ──────────────────────────────────────────────────────────

export const REVIEW_EVENT_SELECT = `
  id, title, summary, description, starts_at, ends_at, venue_name, address, format, status, source,
  source_url, source_event_id, external_url, duplicate_of, needs_review, last_verified_at, created_at,
  organiser:organisers ( name ), category:categories ( name )
`;

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
  source_url: string | null;
  source_event_id: string | null;
  external_url: string | null;
  duplicate_of: string | null;
  needs_review: boolean;
  last_verified_at: string;
  created_at: string;
  organiser: { name: string } | null;
  category: { name: string } | null;
};

export type ReviewItem = {
  event: ReviewEvent;
  original: ReviewEvent | null;
  reason: "duplicate" | "missing" | "flagged";
};

export async function countReviewQueue() {
  const supabase = await createClient();
  const { count } = await supabase.from("events").select("id", { count: "exact", head: true }).eq("needs_review", true);
  return count ?? 0;
}

/** Name lookup for "source:<id>" keys, plus labels for built-in sources. */
export async function sourceLabels() {
  const supabase = await createClient();
  const { data } = await supabase.from("event_sources").select("id, name, last_run_at, last_status");
  const sources = (data ?? []) as Pick<EventSource, "id" | "name" | "last_run_at" | "last_status">[];
  const byId = new Map(sources.map((s) => [s.id, s]));
  const label = (source: string) => {
    const id = sourceIdFromKey(source);
    if (id) return byId.get(id)?.name ?? "Deleted source";
    return ({ orbit: "ORBIT (organiser)", manual: "Added by an admin", csv: "CSV import" } as Record<string, string>)[source] ?? source;
  };
  return { label, byId };
}

async function withOriginals(events: ReviewEvent[]) {
  const ids = [...new Set(events.map((e) => e.duplicate_of).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map<string, ReviewEvent>();
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(REVIEW_EVENT_SELECT).in("id", ids);
  return new Map(((data ?? []) as unknown as ReviewEvent[]).map((e) => [e.id, e]));
}

export async function listReviewQueue({ limit = 100 }: { limit?: number } = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(REVIEW_EVENT_SELECT)
    .eq("needs_review", true)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as unknown as ReviewEvent[];
  const originals = await withOriginals(events);
  const { byId } = await sourceLabels();

  return events.map<ReviewItem>((event) => {
    if (event.duplicate_of) return { event, original: originals.get(event.duplicate_of) ?? null, reason: "duplicate" };
    // A source event that the latest successful run didn't verify has gone missing (or was cancelled upstream).
    const source = byId.get(sourceIdFromKey(event.source) ?? "");
    const missing =
      source?.last_run_at && source.last_status === "ok" &&
      new Date(event.last_verified_at).getTime() < new Date(source.last_run_at).getTime() - 60 * 60 * 1000;
    return { event, original: null, reason: missing ? "missing" : "flagged" };
  });
}

/** Duplicates that an admin chose to keep hidden (resolved, but still reversible). */
export async function listHiddenDuplicates({ limit = 50 }: { limit?: number } = {}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(REVIEW_EVENT_SELECT)
    .eq("needs_review", false)
    .not("duplicate_of", "is", null)
    .gte("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const events = (data ?? []) as unknown as ReviewEvent[];
  const originals = await withOriginals(events);
  return events.map((event) => ({ event, original: originals.get(event.duplicate_of!) ?? null }));
}

// ─── Imported Luma / Meetup events (details editor) ───────────────────────

export type ImportedEvent = {
  id: string;
  title: string;
  starts_at: string;
  cover_url: string | null;
  description: string | null;
  price_min: number | null;
  price_max: number | null;
  external_url: string | null;
  source: string;
  source_event_id: string | null;
  details: Pick<SourceEventDetails, "status" | "attempts" | "last_error" | "fetched_at"> | null;
};

/** Upcoming published events from Luma / Meetup sources; ones without a cover first. */
export async function listImportedEvents({ limit = 60 }: { limit?: number } = {}) {
  const supabase = await createClient();
  const { data: sources } = await supabase.from("event_sources").select("id").in("kind", ["luma", "meetup"]);
  const keys = ((sources ?? []) as { id: string }[]).map((s) => sourceKey(s.id));
  if (keys.length === 0) return [];
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, starts_at, cover_url, description, price_min, price_max, external_url, source, source_event_id, details:source_event_details ( status, attempts, last_error, fetched_at )",
    )
    .in("source", keys)
    .eq("status", "published")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as (Omit<ImportedEvent, "details"> & { details: ImportedEvent["details"] | ImportedEvent["details"][] })[];
  return rows
    .map<ImportedEvent>((r) => ({ ...r, details: Array.isArray(r.details) ? (r.details[0] ?? null) : r.details }))
    .sort((a, b) => Number(Boolean(a.cover_url)) - Number(Boolean(b.cover_url)));
}
