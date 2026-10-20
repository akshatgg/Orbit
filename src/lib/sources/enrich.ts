import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { importRemoteImage } from "./cloudinary-import";
import { ENRICH_BUDGET_MS, PAUSE_MS, detailsPatch, isBlockedStatus, pickEventsToEnrich, type EnrichCandidate } from "./enrich-plan";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { parseLumaEventPage } from "./luma-page";
import { lumaPageUrl } from "./platforms";
import { sourceKey, type DetailsStatus, type EventSource, type RunError, type SourceEventDetails } from "./types";

// Trusted server code only (called from the sync engine with the service-role client).

const CANDIDATE_SELECT = "id, source_event_id, external_url, starts_at, created_at, cover_url, description, price_min";
const COVER_FOLDER = "orbit/event-covers/sources";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads new Luma event pages once each (politely, stopping if Luma blocks us) and fills in
 * empty cover / description / price. Returns how many events got details. Never throws.
 */
export async function enrichLumaEvents(
  source: Pick<EventSource, "id">,
  { db, now, errors }: { db: SupabaseClient; now: Date; errors: RunError[] },
): Promise<number> {
  let saved = 0;
  try {
    const key = sourceKey(source.id);
    const { data, error } = await db
      .from("events")
      .select(CANDIDATE_SELECT)
      .eq("source", key)
      .eq("status", "published")
      .gt("starts_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      errors.push({ message: `Page details: ${error.message}` });
      return 0;
    }
    const events = (data ?? []) as EnrichCandidate[];
    if (events.length === 0) return 0;

    const details = new Map<string, SourceEventDetails>();
    for (let i = 0; i < events.length; i += 200) {
      const ids = events.slice(i, i + 200).map((e) => e.id);
      const { data: rows, error: detailsError } = await db.from("source_event_details").select("*").in("event_id", ids);
      if (detailsError) {
        errors.push({ message: `Page details: ${detailsError.message}` });
        return 0; // don't enrich blind: an empty map would make every event look never-read
      }
      for (const r of (rows ?? []) as SourceEventDetails[]) details.set(r.event_id, r);
    }

    const picked = pickEventsToEnrich(events, details, now);
    const started = Date.now();

    // Each group only writes where the column is still empty, so an admin save mid-run wins.
    const applyGroup = async (event: EnrichCandidate, column: string, values: Record<string, unknown>) => {
      const { data: rows, error: updateError } = await db
        .from("events")
        .update(values)
        .eq("id", event.id)
        .eq("source", key)
        .is(column, null)
        .select("id");
      if (updateError) throw new Error(updateError.message);
      return (rows?.length ?? 0) > 0;
    };

    for (const [i, event] of picked.entries()) {
      if (Date.now() - started > ENRICH_BUDGET_MS) break;
      if (i > 0) await sleep(PAUSE_MS);
      const url = lumaPageUrl(event)!;
      const attempts = (details.get(event.id)?.attempts ?? 0) + 1;
      const record = async (status: DetailsStatus, lastError: string | null = null) => {
        const { error: recordError } = await db.from("source_event_details").upsert(
          { event_id: event.id, status, attempts, last_error: lastError?.slice(0, 500) ?? null, fetched_at: new Date().toISOString() },
          { onConflict: "event_id" },
        );
        if (recordError) {
          errors.push({ event: event.source_event_id ?? event.id, message: `Couldn't record page details: ${recordError.message}` });
        }
      };

      try {
        const page = parseLumaEventPage(await fetchFeedText(url, { accept: "text/html" }));
        if (!page) {
          await record("failed", "No event details found on the page.");
          continue;
        }
        let cover: string | null = null;
        let coverError: string | null = null;
        if (!event.cover_url && page.coverUrl) {
          try {
            cover = await importRemoteImage(page.coverUrl, COVER_FOLDER);
          } catch (e) {
            coverError = message(e);
          }
        }
        const patch = detailsPatch(event, page, cover);
        let wrote = false;
        try {
          if (patch.cover_url) wrote = (await applyGroup(event, "cover_url", { cover_url: patch.cover_url })) || wrote;
          if (patch.description) wrote = (await applyGroup(event, "description", { description: patch.description })) || wrote;
          if (patch.price_min !== undefined) {
            const price = { price_min: patch.price_min, price_max: patch.price_max, currency: patch.currency };
            wrote = (await applyGroup(event, "price_min", price)) || wrote;
          }
        } catch (e) {
          if (wrote) saved++;
          await record("failed", message(e));
          continue;
        }
        if (wrote) saved++;
        await record(coverError ? "failed" : "ok", coverError);
        if (coverError) errors.push({ event: event.source_event_id ?? event.id, message: `Cover not imported: ${coverError}` });
      } catch (e) {
        if (e instanceof FetchHttpError && isBlockedStatus(e.status)) {
          await record("blocked", e.message);
          errors.push({ message: "Luma is blocking page reads. Paste or upload images for now." });
          break;
        }
        await record("failed", message(e));
        errors.push({ event: event.source_event_id ?? event.id, message: `Page details: ${message(e)}` });
      }
    }
  } catch (e) {
    errors.push({ message: `Page details: ${message(e)}` });
  }
  return saved;
}
