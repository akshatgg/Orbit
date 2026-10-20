import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONNECTORS } from "./connectors";
import { enrichLumaEvents } from "./enrich";
import { enrichMeetupEvents } from "./enrich-meetup";
import { ENRICH_BUDGET_MS, RUN_ENRICH_DEADLINE_MS, type EnrichRunState } from "./enrich-plan";
import { findDuplicates, pairKey, type DuplicateCandidate } from "./duplicates";
import { EXISTING_EVENT_SELECT, SKIPPED_FIELDS, buildInsertRow, planSync, type ExistingSourceEvent } from "./sync-plan";
import { sourceKey, type EventSource, type RefreshSummary, type RunError, type RunSummary, type RunTrigger } from "./types";

// Trusted server code only: callers must have checked CRON_SECRET or requireAdmin() first.

const PAGE = 1000;
const CHUNK = 200;
const DAY = 24 * 60 * 60 * 1000;

const message = (e: unknown) => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : String(e));

function chunks<T>(items: T[], size = CHUNK) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Reads every row of a query, a page at a time (PostgREST caps responses). */
async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(message(error));
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function previousOkRunStart(db: SupabaseClient, sourceId: string) {
  const { data } = await db
    .from("source_runs")
    .select("started_at")
    .eq("source_id", sourceId)
    .eq("status", "ok")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.started_at ? new Date(data.started_at as string) : null;
}

/** Fetches one source and applies the diff to its events. Never throws: failures are recorded. */
export async function runSource(
  sourceId: string,
  {
    trigger, now = new Date(), db = createAdminClient(),
    run = { deadline: Date.now() + ENRICH_BUDGET_MS, blocked: false },
  }: { trigger: RunTrigger; now?: Date; db?: SupabaseClient; run?: EnrichRunState },
): Promise<RunSummary> {
  const startedAt = now.toISOString();
  const errors: RunError[] = [];
  const summary: RunSummary = {
    sourceId, name: "", status: "error", found: 0, inserted: 0, updated: 0, unchanged: 0, flaggedMissing: 0, enriched: 0, errors,
  };

  const { data: sourceRow, error: sourceError } = await db.from("event_sources").select("*").eq("id", sourceId).maybeSingle();
  if (sourceError || !sourceRow) {
    errors.push({ message: sourceError ? message(sourceError) : "Source not found" });
    return summary;
  }
  const source = sourceRow as EventSource;
  summary.name = source.name;

  try {
    if (!source.permission_confirmed) throw new Error("Permission to use this feed hasn't been confirmed.");
    const connector = CONNECTORS[source.kind];
    if (!connector) throw new Error(`No connector for "${source.kind}" sources.`);

    const previousRunStartedAt = await previousOkRunStart(db, source.id);
    const fetched = await connector.fetchEvents(source, { now });
    errors.push(...fetched.errors);
    summary.found = fetched.events.length;

    const key = sourceKey(source.id);
    const existing = await selectAll<ExistingSourceEvent>((from, to) =>
      db.from("events").select(EXISTING_EVENT_SELECT).eq("source", key).order("id").range(from, to),
    );
    const plan = planSync(existing, fetched.events, {
      now, feedUrl: source.url, previousRunStartedAt, skip: SKIPPED_FIELDS[source.kind],
    });
    const verifiedAt = now.toISOString();

    // New events — a batch at a time; if a batch fails, retry row by row to isolate bad data.
    for (const batch of chunks(plan.inserts)) {
      const rows = batch.map((e) => buildInsertRow(e, source, now));
      const { error, count } = await db.from("events").insert(rows, { count: "exact" });
      if (!error) {
        summary.inserted += count ?? rows.length;
        continue;
      }
      for (const [i, row] of rows.entries()) {
        const { error: rowError } = await db.from("events").insert(row);
        if (rowError) errors.push({ event: batch[i].sourceEventId, message: `Not imported: ${rowError.message}` });
        else summary.inserted++;
      }
    }

    for (const u of plan.updates) {
      const { error } = await db
        .from("events")
        .update({ ...u.patch, last_verified_at: verifiedAt })
        .eq("id", u.id)
        .eq("source", key); // only ever touch this source's events
      if (error) errors.push({ event: u.sourceEventId, message: `Not updated: ${error.message}` });
      else summary.updated++;
    }

    for (const ids of chunks(plan.unchanged)) {
      const { error } = await db.from("events").update({ last_verified_at: verifiedAt }).in("id", ids).eq("source", key);
      if (error) errors.push({ message: `Couldn't mark events verified: ${error.message}` });
      else summary.unchanged += ids.length;
    }

    for (const ids of chunks(plan.flagged.map((f) => f.id))) {
      const { error } = await db.from("events").update({ needs_review: true }).in("id", ids).eq("source", key);
      if (error) errors.push({ message: `Couldn't flag missing events: ${error.message}` });
      else summary.flaggedMissing += ids.length;
    }

    if (source.kind === "luma") summary.enriched = await enrichLumaEvents(source, { db, now, errors, run });
    if (source.kind === "meetup") summary.enriched = await enrichMeetupEvents(source, { db, now, errors, run });
    summary.status = "ok";
  } catch (e) {
    summary.status = "error";
    errors.unshift({ message: message(e) });
  }

  const finishedAt = new Date().toISOString();
  await db.from("source_runs").insert({
    source_id: source.id,
    trigger,
    started_at: startedAt,
    finished_at: finishedAt,
    status: summary.status,
    found: summary.found,
    inserted: summary.inserted,
    updated: summary.updated,
    unchanged: summary.unchanged,
    flagged_missing: summary.flaggedMissing,
    enriched: summary.enriched,
    errors: errors.slice(0, 50),
  });
  await db
    .from("event_sources")
    .update({
      last_run_at: finishedAt,
      last_status: summary.status,
      last_error: summary.status === "error" ? errors[0]?.message ?? "Unknown error" : null,
    })
    .eq("id", source.id);

  return summary;
}

/** Published events that ended more than a day ago become "expired". */
export async function expireEvents({ now = new Date(), db = createAdminClient() }: { now?: Date; db?: SupabaseClient } = {}) {
  const cutoff = new Date(now.getTime() - DAY).toISOString();
  const [ended, noEnd] = await Promise.all([
    db.from("events").update({ status: "expired" }).eq("status", "published").lt("ends_at", cutoff).select("id"),
    db.from("events").update({ status: "expired" }).eq("status", "published").is("ends_at", null).lt("starts_at", cutoff).select("id"),
  ]);
  if (ended.error) throw new Error(message(ended.error));
  if (noEnd.error) throw new Error(message(noEnd.error));
  return (ended.data?.length ?? 0) + (noEnd.data?.length ?? 0);
}

/** Flags new duplicates across every source (published, upcoming, not already linked). */
export async function detectDuplicates({ now = new Date(), db = createAdminClient() }: { now?: Date; db?: SupabaseClient } = {}) {
  const since = new Date(now.getTime() - DAY).toISOString();
  const [candidates, dismissals] = await Promise.all([
    selectAll<DuplicateCandidate>((from, to) =>
      db
        .from("events")
        .select("id, title, starts_at, source, created_at")
        .eq("status", "published")
        .is("duplicate_of", null)
        .gte("starts_at", since)
        .order("starts_at")
        .range(from, to),
    ),
    selectAll<{ event_id: string; other_event_id: string }>((from, to) =>
      db.from("event_duplicate_dismissals").select("event_id, other_event_id").range(from, to),
    ),
  ]);
  const dismissed = new Set(dismissals.map((d) => pairKey(d.event_id, d.other_event_id)));
  const matches = findDuplicates(candidates, { dismissed });

  let flagged = 0;
  for (const m of matches) {
    const { data, error } = await db
      .from("events")
      .update({ duplicate_of: m.duplicateOf, needs_review: true })
      .eq("id", m.id)
      .is("duplicate_of", null)
      .select("id");
    if (!error) flagged += data?.length ?? 0;
  }
  return flagged;
}

/** The nightly job: every enabled source in turn (one failure never stops the rest), then expiry
 *  and duplicate detection. */
export async function refreshAllSources(
  { now = new Date(), trigger = "cron" }: { now?: Date; trigger?: RunTrigger } = {},
): Promise<RefreshSummary> {
  const db = createAdminClient();
  const startedAt = now.toISOString();
  const errors: string[] = [];
  const sources: RunSummary[] = [];
  const run: EnrichRunState = { deadline: Date.now() + RUN_ENRICH_DEADLINE_MS, blocked: false };

  const { data, error } = await db.from("event_sources").select("id").eq("enabled", true).order("created_at");
  if (error) errors.push(`Couldn't list sources: ${error.message}`);
  for (const { id } of (data ?? []) as { id: string }[]) {
    try {
      sources.push(await runSource(id, { trigger, db, run }));
    } catch (e) {
      errors.push(`Source ${id}: ${message(e)}`);
    }
  }

  let expired = 0;
  let duplicatesFlagged = 0;
  try {
    expired = await expireEvents({ db });
  } catch (e) {
    errors.push(`Expiry: ${message(e)}`);
  }
  try {
    duplicatesFlagged = await detectDuplicates({ db });
  } catch (e) {
    errors.push(`Duplicate check: ${message(e)}`);
  }

  return {
    ok: errors.length === 0 && sources.every((s) => s.status === "ok"),
    startedAt,
    finishedAt: new Date().toISOString(),
    sources,
    expired,
    duplicatesFlagged,
    errors,
  };
}
