import "server-only";
import {
  EVENTBRITE_BATCH, EVENTBRITE_MAX_EVENTS, EVENTBRITE_MAX_PAGES, eventDetailsUrl, organizerEventsUrl, parseEventbriteEvents,
  parseEventbriteSearchPage, parseOrganizerEvents, searchPageUrl,
} from "./eventbrite";
import {
  FATSOMA_MAX_EVENTS, FATSOMA_MAX_PAGES, FATSOMA_PAGE_SIZE, fatsomaEventsUrl, fatsomaPageLookupUrl, parseFatsomaCityPage,
  parseFatsomaEvents, parseFatsomaPageLookup, type FatsomaFilter,
} from "./fatsoma";
import { FetchHttpError, fetchFeedText } from "./fetch";
import { parseIcal } from "./ical";
import {
  LUMA_CATEGORY_MAX_PAGES, lumaCategoryEventsUrl, parseLumaCategoryEvents, parseLumaCategoryPage, parseLumaDiscoverPage,
  type LumaCategory,
} from "./luma-discover";
import { parseLumaLinkedEvent } from "./luma-page";
import {
  MEETUP_SEARCH_MAX_EVENTS, MEETUP_SEARCH_MAX_PAGES, fetchMeetupSearchPage, parseMeetupFindPage,
} from "./meetup-search";
import { parseMeetupLinkedEvent } from "./meetup-page";
import { withSeriesDates } from "./meetup-series";
import {
  MEETUP_LOCATION_ERROR, cleanEvent, eventbriteLink, fatsomaLink, lumaDiscoverSlug, lumaNearSlug, meetupFindMissingLocation,
} from "./platforms";
import type { ConnectorResult, ListingCoverage, NormalizedEvent, RunError, SourceConnector, SourceKind } from "./types";

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
    const category = place ? null : parseLumaCategoryPage(html);
    if (category) return lumaCategoryEvents(category, lumaNearSlug(source.url));
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

/**
 * A Luma category page (luma.com/tech) lists events near whoever opens it, so the link names the
 * city (?near=bengaluru). Luma's own list for that city and category, soonest first, capped.
 */
async function lumaCategoryEvents(category: LumaCategory, near: string | null): Promise<ConnectorResult> {
  const example = `https://luma.com/${category.slug ?? "tech"}?near=bengaluru`;
  if (!near) throw new Error(`Luma's ${category.name} page shows events near whoever opens it. Add the city to the link, e.g. ${example}`);

  const client = politeClient();
  const place = parseLumaDiscoverPage(await client.html(`https://luma.com/${near}`), near);
  if (!place) throw new Error(`Luma has no city page called “${near}”. Use the name from the city's link, e.g. ${example}`);

  const events: NormalizedEvent[] = [];
  const errors: RunError[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < LUMA_CATEGORY_MAX_PAGES; page++) {
    const result = parseLumaCategoryEvents(await client.json(lumaCategoryEventsUrl(category.apiId, place.apiId, cursor)), category);
    events.push(...result.events);
    errors.push(...result.errors);
    if (!result.hasMore) return { events, errors };
    cursor = result.nextCursor;
  }
  return { events, errors, coverage: coveredUntil(events) };
}

/** Meetup's find page + internal GraphQL, capped and de-duplicated. */
const meetupSearchConnector: SourceConnector = {
  kind: "meetup-search",
  async fetchEvents(source, { now }) {
    if (meetupFindMissingLocation(source.url)) throw new Error(MEETUP_LOCATION_ERROR);
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

    // Meetup ranks search results by relevance and the list reshuffles daily: an event that drops
    // out of it hasn't gone anywhere, so a search never flags events as missing.
    return { events: await withSeriesDates(unique, { now, referer: source.url, errors }), errors, coverage: "sample" } satisfies ConnectorResult;
  },
};

/** A soonest-first list cut off at the cap covers events up to its last start (exclusive). */
function coveredUntil(events: NormalizedEvent[]): ListingCoverage {
  const last = events.reduce((max, e) => (e.startsAt > max ? e.startsAt : max), "");
  return last ? { until: last } : "complete";
}

/**
 * Requests to one platform, 1 s apart. Any failure fails the run: a partial list would make the
 * sync flag every event it didn't see as missing.
 */
function politeClient() {
  let sent = 0;
  return {
    async json(url: string) {
      if (sent++ > 0) await sleep(1000);
      return fetchFeedText(url, { accept: "application/json" });
    },
    async html(url: string) {
      if (sent++ > 0) await sleep(1000);
      return fetchHtml(url);
    },
  };
}

/** Eventbrite organiser, event or search links: the event ids first, then details 50 at a time. */
const eventbriteConnector: SourceConnector = {
  kind: "eventbrite",
  async fetchEvents(source) {
    const link = eventbriteLink(source.url);
    if (!link) throw new Error("That isn't an Eventbrite organiser, event or search link.");
    const client = politeClient();

    let ids: string[];
    let truncated = false; // an organiser list (soonest first) cut off at the cap
    if (link.type === "event") {
      ids = [link.id];
    } else if (link.type === "search") {
      ids = [];
      for (let page = 1; page <= EVENTBRITE_MAX_PAGES && ids.length < EVENTBRITE_MAX_EVENTS; page++) {
        const found = parseEventbriteSearchPage(await client.html(searchPageUrl(link.url, page)));
        const fresh = found.filter((id) => !ids.includes(id));
        ids.push(...fresh);
        if (fresh.length === 0) break; // past the last page, or a search that doesn't page
      }
      if (ids.length === 0) throw new Error("No events found on that Eventbrite search page.");
    } else {
      ids = [];
      let continuation: string | null = null;
      for (let page = 0; page < EVENTBRITE_MAX_PAGES && ids.length < EVENTBRITE_MAX_EVENTS; page++) {
        const listing = parseOrganizerEvents(await client.json(organizerEventsUrl(link.id, continuation)));
        if (!listing) throw new Error("Couldn't read that organiser's events on Eventbrite.");
        ids.push(...listing.ids.filter((id) => !ids.includes(id)));
        continuation = listing.continuation;
        if (!continuation) break;
      }
      truncated = !!continuation || ids.length > EVENTBRITE_MAX_EVENTS;
    }

    const result: ConnectorResult = { events: [], errors: [] };
    const wanted = ids.slice(0, EVENTBRITE_MAX_EVENTS);
    for (let i = 0; i < wanted.length; i += EVENTBRITE_BATCH) {
      const batch = parseEventbriteEvents(await client.json(eventDetailsUrl(wanted.slice(i, i + EVENTBRITE_BATCH))));
      if (!batch) throw new Error("Couldn't read event details from Eventbrite.");
      result.events.push(...batch.events);
      result.errors.push(...batch.errors);
    }
    if (link.type === "event" && result.events.length === 0) throw new Error("That Eventbrite event isn't public or has ended.");
    // A search is ranked by relevance, so an event dropping out of it says nothing.
    result.coverage = link.type === "search" ? "sample" : truncated ? coveredUntil(result.events) : "complete";
    return result;
  },
};

/** Fatsoma organiser, event or city links, through the API Fatsoma's own site uses. */
const fatsomaConnector: SourceConnector = {
  kind: "fatsoma",
  async fetchEvents(source, { now }) {
    const link = fatsomaLink(source.url);
    if (!link) throw new Error("That isn't a Fatsoma organiser, event or city link.");
    const client = politeClient();

    let filter: FatsomaFilter;
    if (link.type === "event") {
      filter = { vanity: link.vanity };
    } else if (link.type === "page") {
      const pageId = parseFatsomaPageLookup(await client.json(fatsomaPageLookupUrl(link.vanity)));
      if (!pageId) throw new Error(`No Fatsoma organiser page called "${link.vanity}".`);
      filter = { pageId };
    } else {
      const latLon = parseFatsomaCityPage(await client.html(link.url));
      if (!latLon) throw new Error("Couldn't find the event list on that Fatsoma city page.");
      filter = { latLon };
    }

    const result: ConnectorResult = { events: [], errors: [] };
    let truncated = true; // until a page shows it was the last one
    for (let page = 1; page <= FATSOMA_MAX_PAGES && result.events.length < FATSOMA_MAX_EVENTS; page++) {
      const response = parseFatsomaEvents(await client.json(fatsomaEventsUrl(filter, page, now)));
      if (!response) throw new Error("Couldn't read events from Fatsoma.");
      result.events.push(...response.events.filter((e) => !result.events.some((seen) => seen.sourceEventId === e.sourceEventId)));
      result.errors.push(...response.errors);
      const read = response.events.length + response.errors.length;
      if (read < FATSOMA_PAGE_SIZE || (response.total !== null && page * FATSOMA_PAGE_SIZE >= response.total)) {
        truncated = false;
        break;
      }
    }
    result.events = result.events.slice(0, FATSOMA_MAX_EVENTS);
    result.coverage = truncated ? coveredUntil(result.events) : "complete";
    if (link.type === "event" && result.events.length === 0) throw new Error("That Fatsoma event isn't on sale or has ended.");
    return result;
  },
};

/** Add new kinds here (official APIs etc.) — the sync engine only sees NormalizedEvent[]. */
export const CONNECTORS: Record<SourceKind, SourceConnector> = {
  ical: feedConnector("ical"),
  luma: feedConnector("luma"),
  "luma-discover": lumaDiscoverConnector,
  meetup: feedConnector("meetup"),
  "meetup-search": meetupSearchConnector,
  eventbrite: eventbriteConnector,
  fatsoma: fatsomaConnector,
};
