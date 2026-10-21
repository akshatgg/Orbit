import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCloudinaryConfig } from "@/lib/cloudinary";
import { importRemoteImage } from "./cloudinary-import";
import {
  ENRICH_BUDGET_MS, ENRICH_LIMIT, PAUSE_MS, hasTimeFor, importedDescription, isBlockedStatus, pickEventsToEnrich,
  type EnrichCandidate, type EnrichRunState,
} from "./enrich-plan";
import { eventbriteIdOf, parseEventbriteDescription, structuredContentUrl } from "./eventbrite";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { isPlatformHostedImage } from "./platforms";
import { sourceKey, type DetailsStatus, type EventSource, type RunError, type SourceEventDetails } from "./types";

// Trusted server code only (called from the sync engine with the service-role client).

const CANDIDATE_SELECT = "id, source_event_id, external_url, starts_at, created_at, cover_url, description, summary, price_min";
const COVER_FOLDER = "orbit/event-covers/sources";
const PLATFORM = { eventbrite: "Eventbrite", fatsoma: "Fatsoma" } as const;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The details step for Eventbrite and Fatsoma events, once per event: Eventbrite's full
 * description (its listing only has the summary), and for both, ORBIT's own copy of the cover that
 * was hotlinked on import. Fatsoma needs no page reads: Cloudinary fetches the image.
 * Politeness and limits match the Luma and Meetup readers. Never throws. Returns how many events
 * got details.
 */
export async function enrichImportedEvents(
  source: Pick<EventSource, "id"> & { kind: keyof typeof PLATFORM },
  { db, now, errors, run }: { db: SupabaseClient; now: Date; errors: RunError[]; run: EnrichRunState },
): Promise<number> {
  const { kind } = source;
  const readsPages = kind === "eventbrite";
  if (readsPages && run.blocked) return 0;
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
      errors.push({ message: `${PLATFORM[kind]} details: ${error.message}` });
      return 0;
    }
    const events = (data ?? []) as EnrichCandidate[];
    if (events.length === 0) return 0;

    const coversPossible = getCloudinaryConfig() !== null;
    const hotlinked = (event: EnrichCandidate) => isPlatformHostedImage(kind, event.cover_url);
    const needsCover = (event: EnrichCandidate) => coversPossible && hotlinked(event);
    const needsRead = (event: EnrichCandidate) => readsPages && eventbriteIdOf(event.source_event_id) !== null;
    if (!coversPossible && events.some(hotlinked)) {
      errors.push({ message: `Covers stay linked to ${PLATFORM[kind]}: image import needs Cloudinary (CLOUDINARY_* env vars are missing).` });
    }

    const details = new Map<string, SourceEventDetails>();
    for (let i = 0; i < events.length; i += 200) {
      const ids = events.slice(i, i + 200).map((e) => e.id);
      const { data: rows, error: detailsError } = await db.from("source_event_details").select("*").in("event_id", ids);
      if (detailsError) {
        errors.push({ message: `${PLATFORM[kind]} details: ${detailsError.message}` });
        return 0; // don't work blind: an empty map would make every event look never handled
      }
      for (const row of (rows ?? []) as SourceEventDetails[]) details.set(row.event_id, row);
    }
    // A cover hotlinked again after its event was handled (an admin cleared it, the sync re-linked
    // the platform's image) gets one more go.
    for (const [eventId, row] of details) {
      const event = events.find((e) => e.id === eventId);
      if (row.status === "ok" && event && needsCover(event)) details.delete(eventId);
    }

    const picked = pickEventsToEnrich(events, details, now, ENRICH_LIMIT, (e) => needsRead(e) || needsCover(e));
    const limit = Math.min(Date.now() + ENRICH_BUDGET_MS, run.deadline);

    for (const [i, event] of picked.entries()) {
      if ((readsPages && run.blocked) || !hasTimeFor(Date.now(), limit)) break;
      if (i > 0) await sleep(PAUSE_MS);

      const attempts = (details.get(event.id)?.attempts ?? 0) + 1;
      const record = async (status: DetailsStatus, lastError: string | null = null) => {
        const { error: recordError } = await db.from("source_event_details").upsert(
          { event_id: event.id, status, attempts, last_error: lastError?.slice(0, 500) ?? null, fetched_at: new Date().toISOString() },
          { onConflict: "event_id" },
        );
        if (recordError) errors.push({ event: event.source_event_id ?? event.id, message: `Couldn't record details: ${recordError.message}` });
      };
      // Only writes while the column still holds what we read, so an admin's edit mid-run wins.
      const apply = async (column: "description" | "cover_url", value: string, current: string | null) => {
        let query = db.from("events").update({ [column]: value }).eq("id", event.id).eq("source", key);
        query = current === null ? query.is(column, null) : query.eq(column, current);
        const { data: rows, error: updateError } = await query.select("id");
        if (updateError) throw new Error(updateError.message);
        return (rows?.length ?? 0) > 0;
      };

      try {
        let wrote = false;
        const eventbriteId = needsRead(event) ? eventbriteIdOf(event.source_event_id) : null;
        if (eventbriteId) {
          const full = parseEventbriteDescription(await fetchFeedText(structuredContentUrl(eventbriteId), { accept: "application/json" }));
          const description = importedDescription(event, full);
          if (description) wrote = (await apply("description", description, event.description)) || wrote;
        }

        let coverError: string | null = null;
        if (needsCover(event)) {
          try {
            const cover = await importRemoteImage(event.cover_url!, COVER_FOLDER);
            wrote = (await apply("cover_url", cover, event.cover_url)) || wrote;
          } catch (e) {
            coverError = `Cover not imported: ${message(e)}`;
          }
        }

        if (wrote) saved++;
        if (coverError) {
          // "failed" so the retry limits bring the image back on a later refresh.
          await record("failed", coverError);
          errors.push({ event: event.source_event_id ?? event.id, message: coverError });
        } else {
          await record("ok");
        }
      } catch (e) {
        if (e instanceof FetchHttpError && isBlockedStatus(e.status)) {
          run.blocked = true;
          // "failed", not "blocked": the retry rules read it again after a day.
          await record("failed", `Blocked by ${PLATFORM[kind]}: ${e.message}`);
          errors.push({ message: `${PLATFORM[kind]} is blocking detail reads. We'll try again on the next refresh.` });
          break;
        }
        await record("failed", message(e));
        errors.push({ event: event.source_event_id ?? event.id, message: `${PLATFORM[kind]} details: ${message(e)}` });
      }
    }
  } catch (e) {
    errors.push({ message: `${PLATFORM[kind]} details: ${message(e)}` });
  }
  return saved;
}
