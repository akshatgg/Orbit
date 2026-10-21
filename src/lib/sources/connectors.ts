import "server-only";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { parseIcal } from "./ical";
import { parseLumaDiscoverPage } from "./luma-discover";
import { parseLumaLinkedEvent } from "./luma-page";
import {
  MEETUP_SEARCH_MAX_EVENTS, MEETUP_SEARCH_MAX_PAGES, fetchMeetupSearchPage, parseMeetupFindPage,
} from "./meetup-search";
import { parseMeetupLinkedEvent } from "./meetup-page";
import { withSeriesDates } from "./meetup-series";
import { cleanEvent, lumaDiscoverSlug } from "./platforms";
import type { ConnectorResult, NormalizedEvent, RunError, SourceConnector, SourceKind } from "./types";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One polite retry for a transient page timeout; a 403 is a block and is not retried. */
async function fetchHtml(url: string) {
  try {
    return await fetchFeedText(url, { accept: "text/html" });
  } catch (e) {
    if (e instanceof FetchHttpError && e.status === 403) throw e;
    await sleep(1500);
    return fetchFeedText(url, { accept: "text/html" });
  }
}

/** iCal feeds, with the platform's own clean-up for Luma / Meetup. */
function feedConnector(kind: SourceKind): SourceConnector {
  return {
    kind,
    async fetchEvents(source, { now }) {
      const text = await fetchFeedText(source.url);
      const result = parseIcal(text, { now });
      return { ...result, events: result.events.map((e) => cleanEvent(kind, e)) };
    },
  };
}

/** A Luma city page resolves to its public `discplace-…` iCal feed. */
const lumaDiscoverConnector: SourceConnector = {
  kind: "luma-discover",
  async fetchEvents(source, { now }) {
    const slug = lumaDiscoverSlug(source.url);
    const html = await fetchHtml(source.url);
    const place = parseLumaDiscoverPage(html, slug);
    if (!place) {
      const single = parseLumaLinkedEvent(html, source.url);
      if (!single) throw new Error("Couldn't read that Luma link. Use a city page or an event page.");
      return { events: [single], errors: [] };
    }

    const text = await fetchFeedText(place.feedUrl);
    const result = parseIcal(text, { now, defaultTimezone: place.timezone });
    return { ...result, events: result.events.map((e) => cleanEvent("luma-discover", e)) };
  },
};

/** Meetup's find page + internal GraphQL, capped and de-duplicated. */
const meetupSearchConnector: SourceConnector = {
  kind: "meetup-search",
  async fetchEvents(source, { now }) {
    const html = await fetchHtml(source.url);
    const args = parseMeetupFindPage(html);
    if (!args) {
      const single = parseMeetupLinkedEvent(html, source.url);
      if (!single) throw new Error("Couldn't read that Meetup link. Use an event page or a search page.");
      const errors: RunError[] = [];
      return { events: await withSeriesDates([single], { now, referer: source.url, errors }), errors };
    }

    const events: NormalizedEvent[] = [];
    const errors: { event?: string; message: string }[] = [];
    let after: string | null = null;

    for (let page = 0; page < MEETUP_SEARCH_MAX_PAGES; page++) {
      let result;
      try {
        result = await fetchMeetupSearchPage(args, after, source.url);
      } catch (e) {
        if (page === 0) throw e;
        errors.push({ message: `Meetup search page ${page + 1}: ${message(e)}` });
        break;
      }

      events.push(...result.events);
      errors.push(...result.errors);
      if (!result.hasNextPage || !result.nextCursor || events.length >= MEETUP_SEARCH_MAX_EVENTS) break;

      after = result.nextCursor;
      await sleep(1000);
    }

    const seen = new Set<string>();
    const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
    const unique = events
      .filter((event) => new Date(event.startsAt).getTime() >= cutoff)
      .filter((event) => {
        if (seen.has(event.sourceEventId)) return false;
        seen.add(event.sourceEventId);
        return true;
      })
      .slice(0, MEETUP_SEARCH_MAX_EVENTS);

    return { events: await withSeriesDates(unique, { now, referer: source.url, errors }), errors } satisfies ConnectorResult;
  },
};

/** Add new kinds here (official APIs etc.) — the sync engine only sees NormalizedEvent[]. */
export const CONNECTORS: Record<SourceKind, SourceConnector> = {
  ical: feedConnector("ical"),
  luma: feedConnector("luma"),
  "luma-discover": lumaDiscoverConnector,
  meetup: feedConnector("meetup"),
  "meetup-search": meetupSearchConnector,
};
