import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ENRICH_BUDGET_MS, ENRICH_LIMIT, PAUSE_MS, hasTimeFor, isBlockedStatus, pickEventsToEnrich,
  type EnrichCandidate, type EnrichRunState,
} from "./enrich-plan";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { parseMeetupEventPage } from "./meetup-page";
import { meetupPageUrl } from "./platforms";
import { sourceKey, type DetailsStatus, type EventSource, type RunError, type SourceEventDetails } from "./types";

// Trusted server code only (called from the sync engine with the service-role client).

const CANDIDATE_SELECT =
  "id, source_event_id, external_url, starts_at, created_at, cover_url, description, price_min, venue_name, address, city, latitude, longitude";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Only read pages for events that still need a venue or coordinates. */
const needsLocation = (event: EnrichCandidate) =>
  !!meetupPageUrl(event) &&
  (!event.venue_name || !event.address || !event.city || event.latitude == null || event.longitude == null);

/**
 * Reads new Meetup event pages once each for venue name, address, city and coordinates.
 * Politeness matches the Luma reader: one page at a time, a small budget, stop on blocks.
 * Never throws. Returns how many events got location details.
 */
export async function enrichMeetupEvents(
  source: Pick<EventSource, "id">,
  { db, now, errors, run }: { db: SupabaseClient; now: Date; errors: RunError[]; run: EnrichRunState },
): Promise<number> {
  if (run.blocked) return 0;
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
      errors.push({ message: `Meetup location: ${error.message}` });
      return 0;
    }
    const events = (data ?? []) as EnrichCandidate[];
    if (events.length === 0) return 0;

    const details = new Map<string, SourceEventDetails>();
    for (let i = 0; i < events.length; i += 200) {
      const ids = events.slice(i, i + 200).map((e) => e.id);
      const { data: rows, error: detailsError } = await db.from("source_event_details").select("*").in("event_id", ids);
      if (detailsError) {
        errors.push({ message: `Meetup location: ${detailsError.message}` });
        return 0;
      }
      for (const row of (rows ?? []) as SourceEventDetails[]) details.set(row.event_id, row);
    }

    // A location can be lost if an older sync cleared it. Treat an "ok" row whose location is
    // now missing as unread so this run can put it back (the retry limits then apply).
    for (const [eventId, row] of details) {
      const event = events.find((e) => e.id === eventId);
      if (row.status === "ok" && event && needsLocation(event)) details.delete(eventId);
    }

    const picked = pickEventsToEnrich(events, details, now, ENRICH_LIMIT, needsLocation);
    const limit = Math.min(Date.now() + ENRICH_BUDGET_MS, run.deadline);

    for (const [i, event] of picked.entries()) {
      if (run.blocked || !hasTimeFor(Date.now(), limit)) break;
      if (i > 0) await sleep(PAUSE_MS);

      const url = meetupPageUrl(event)!;
      const attempts = (details.get(event.id)?.attempts ?? 0) + 1;
      const record = async (status: DetailsStatus, lastError: string | null = null) => {
        const { error: recordError } = await db.from("source_event_details").upsert(
          { event_id: event.id, status, attempts, last_error: lastError?.slice(0, 500) ?? null, fetched_at: new Date().toISOString() },
          { onConflict: "event_id" },
        );
        if (recordError) errors.push({ event: event.source_event_id ?? event.id, message: `Couldn't record location: ${recordError.message}` });
      };

      try {
        const page = parseMeetupEventPage(await fetchFeedText(url, { accept: "text/html" }));
        if (!page) {
          await record("failed", "No location found on the page.");
          continue;
        }

        // Fill only empty fields. An admin's venue/address always wins.
        const apply = async (values: Record<string, unknown>, column: string, current: unknown) => {
          let query = db.from("events").update(values).eq("id", event.id).eq("source", key);
          query = current === null || current === undefined ? query.is(column, null) : query.eq(column, current as string);
          const { data: rows, error: updateError } = await query.select("id");
          if (updateError) throw new Error(updateError.message);
          return (rows?.length ?? 0) > 0;
        };

        let wrote = false;
        if (!event.venue_name && page.venueName) {
          wrote = (await apply({ venue_name: page.venueName }, "venue_name", event.venue_name)) || wrote;
        }
        if (!event.address && page.address) {
          wrote = (await apply({ address: page.address }, "address", event.address)) || wrote;
        }
        if ((!event.city || event.city === "London") && page.city && page.city !== event.city) {
          wrote = (await apply({ city: page.city }, "city", event.city)) || wrote;
        }
        if ((event.latitude == null || event.longitude == null) && page.latitude != null && page.longitude != null) {
          wrote = (await apply({ latitude: page.latitude, longitude: page.longitude }, "latitude", event.latitude)) || wrote;
        }
        if (wrote) saved++;
        await record("ok", null);
      } catch (e) {
        if (e instanceof FetchHttpError && isBlockedStatus(e.status)) {
          run.blocked = true;
          await record("blocked", e.message);
          errors.push({ message: "Meetup is blocking page reads. We'll try again on the next refresh." });
          break;
        }
        await record("failed", message(e));
        errors.push({ event: event.source_event_id ?? event.id, message: `Meetup location: ${message(e)}` });
      }
    }
  } catch (e) {
    errors.push({ message: `Meetup location: ${message(e)}` });
  }
  return saved;
}
