import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCloudinaryConfig } from "@/lib/cloudinary";
import { importRemoteImage } from "./cloudinary-import";
import {
  ENRICH_BUDGET_MS, ENRICH_LIMIT, PAUSE_MS, hasTimeFor, hintedTags, isBlockedStatus, pickEventsToEnrich,
  type EnrichCandidate, type EnrichRunState,
} from "./enrich-plan";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { isMeetupHostedImage, parseMeetupEventPage } from "./meetup-page";
import { meetupPageUrl } from "./platforms";
import { sourceKey, type DetailsStatus, type EventSource, type RunError, type SourceEventDetails } from "./types";

// Trusted server code only (called from the sync engine with the service-role client).

const CANDIDATE_SELECT =
  "id, source_event_id, external_url, starts_at, created_at, cover_url, description, price_min, venue_name, address, city, latitude, longitude, series_key, title, summary, tags, tags_locked";

const COVER_FOLDER = "orbit/event-covers/sources";
const NO_COVER = "No cover image on the page.";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Events that still need a venue or coordinates. */
const needsLocation = (event: EnrichCandidate) =>
  !!meetupPageUrl(event) &&
  (!event.venue_name || !event.address || !event.city || event.latitude == null || event.longitude == null);

/**
 * Reads new Meetup event pages once each for venue name, address, city, coordinates and the
 * cover image (copied to Cloudinary so ORBIT serves its own image).
 * Politeness matches the Luma reader: one page at a time, a small budget, stop on blocks.
 * Never throws. Returns how many events got details.
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
      errors.push({ message: `Meetup page details: ${error.message}` });
      return 0;
    }
    const events = (data ?? []) as EnrichCandidate[];
    if (events.length === 0) return 0;

    const coversPossible = getCloudinaryConfig() !== null;
    // Every date of a series has the same poster: import it once and share ORBIT's copy.
    const seriesCover = new Map<string, string>();
    for (const e of events) if (e.series_key && e.cover_url && !isMeetupHostedImage(e.cover_url)) seriesCover.set(e.series_key, e.cover_url);
    // A cover still hotlinked from Meetup (set on import) is replaced by ORBIT's own copy.
    const needsCover = (event: EnrichCandidate) =>
      coversPossible && !!meetupPageUrl(event) && (!event.cover_url || isMeetupHostedImage(event.cover_url));

    const details = new Map<string, SourceEventDetails>();
    for (let i = 0; i < events.length; i += 200) {
      const ids = events.slice(i, i + 200).map((e) => e.id);
      const { data: rows, error: detailsError } = await db.from("source_event_details").select("*").in("event_id", ids);
      if (detailsError) {
        errors.push({ message: `Meetup page details: ${detailsError.message}` });
        return 0;
      }
      for (const row of (rows ?? []) as SourceEventDetails[]) details.set(row.event_id, row);
    }

    // A location can be lost if an older sync cleared it. Treat an "ok" row whose location is
    // now missing as unread so this run can put it back (the retry limits then apply). Pages read
    // before covers were imported are read once more for their image; a page known to have no
    // image isn't.
    for (const [eventId, row] of details) {
      const event = events.find((e) => e.id === eventId);
      const coverPending = event && needsCover(event) && row.last_error !== NO_COVER;
      if (row.status === "ok" && event && (needsLocation(event) || coverPending)) details.delete(eventId);
    }

    const picked = pickEventsToEnrich(events, details, now, ENRICH_LIMIT, (e) => needsLocation(e) || needsCover(e));
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
          await record("failed", "No location or cover found on the page.");
          continue;
        }

        let cover: string | null = null;
        let coverError: string | null = null;
        const shared = event.series_key ? seriesCover.get(event.series_key) : undefined;
        if (needsCover(event) && shared) {
          cover = shared;
        } else if (needsCover(event) && page.coverUrl) {
          try {
            cover = await importRemoteImage(page.coverUrl, COVER_FOLDER);
            if (event.series_key) seriesCover.set(event.series_key, cover);
          } catch (e) {
            coverError = `Cover not imported: ${message(e)}`;
          }
        }

        // Fill only empty fields. An admin's venue/address/cover always wins.
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
        if (cover) wrote = (await apply({ cover_url: cover }, "cover_url", event.cover_url)) || wrote;
        const tags = hintedTags(event, page.interestHints);
        if (tags) {
          const { error: tagError } = await db.from("events").update({ tags }).eq("id", event.id).eq("source", key).eq("tags_locked", false);
          if (tagError) throw new Error(tagError.message);
        }
        if (wrote) saved++;
        if (coverError) {
          // "failed" so the retry limits bring the image back on a later refresh.
          await record("failed", coverError);
          errors.push({ event: event.source_event_id ?? event.id, message: coverError });
        } else {
          await record("ok", needsCover(event) && !page.coverUrl ? NO_COVER : null);
        }
      } catch (e) {
        if (e instanceof FetchHttpError && isBlockedStatus(e.status)) {
          run.blocked = true;
          await record("blocked", e.message);
          errors.push({ message: "Meetup is blocking page reads. We'll try again on the next refresh." });
          break;
        }
        await record("failed", message(e));
        errors.push({ event: event.source_event_id ?? event.id, message: `Meetup page details: ${message(e)}` });
      }
    }

    // Every date of a series has the same poster: give dates still without one the series' cover
    // now, instead of waiting for each date's own page read (only a few run per refresh).
    for (const [seriesKey, cover] of seriesCover) {
      const { error: shareError } = await db
        .from("events")
        .update({ cover_url: cover })
        .eq("source", key)
        .eq("series_key", seriesKey)
        .or("cover_url.is.null,cover_url.like.https://secure.meetupstatic.com/*,cover_url.like.https://secure-content.meetupstatic.com/*");
      if (shareError) errors.push({ message: `Couldn't share a series cover: ${shareError.message}` });
    }
  } catch (e) {
    errors.push({ message: `Meetup page details: ${message(e)}` });
  }
  return saved;
}
