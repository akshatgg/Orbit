// Meetup search: parse the public find page, then page through Meetup's own GraphQL query.
//
// Robots note: Meetup's robots.txt disallows the `source` and `categoryId` find-page parameters.
// The product owner accepted this exception; keep this source opt-in, capped and easy to disable.

import { FetchHttpError, USER_AGENT } from "./fetch";
import { LIMITS, clamp, cleanProse, oneLine, orNull, safeHttpUrl, stripHtml, summarise } from "./text";
import { isValidTimezone } from "./timezone";
import type { NormalizedEvent, RunError } from "./types";

export const MEETUP_SEARCH_GQL = "https://www.meetup.com/gql2";
export const MEETUP_SEARCH_PAGE_SIZE = 50;
export const MEETUP_SEARCH_MAX_PAGES = 6;
export const MEETUP_SEARCH_MAX_EVENTS = 250;

export type MeetupSearchArgs = {
  lat: number;
  lon: number;
  startDateRange: string | null;
  indexAlias: string | null;
  categoryId: string | null;
  topicCategoryId: string | null;
  endCursor: string | null;
  hasNextPage: boolean;
};

const id = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : null);

/** Reads the find page's own SSR state: coordinates, filters and first cursor. */
export function parseMeetupFindPage(html: string): MeetupSearchArgs | null {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  const root = (data as {
    props?: { pageProps?: { __APOLLO_STATE__?: { ROOT_QUERY?: Record<string, unknown> } } };
  })?.props?.pageProps?.__APOLLO_STATE__?.ROOT_QUERY;
  if (!root) return null;

  const key = Object.keys(root).find((name) => name.startsWith("recommendedEvents:"));
  if (!key) return null;

  let args: { filter?: Record<string, unknown> };
  try {
    args = JSON.parse(key.slice("recommendedEvents:".length));
  } catch {
    return null;
  }
  const filter = args.filter ?? {};
  const lat = Number(filter.lat);
  const lon = Number(filter.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const connection = root[key] as { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } };
  return {
    lat,
    lon,
    startDateRange: typeof filter.startDateRange === "string" ? filter.startDateRange : null,
    indexAlias: typeof filter.indexAlias === "string" ? filter.indexAlias : null,
    categoryId: id(filter.categoryId),
    topicCategoryId: id(filter.topicCategoryId),
    endCursor: connection?.pageInfo?.endCursor ?? null,
    hasNextPage: !!connection?.pageInfo?.hasNextPage,
  };
}

export const MEETUP_SEARCH_QUERY = `query meetupSearch(
  $lat: Float!, $lon: Float!, $categoryId: ID, $topicCategoryId: ID,
  $startDateRange: String, $first: Int, $after: String,
  $sortField: RecommendedEventsSortField, $indexAlias: String,
  $doConsolidateEvents: Boolean, $doPromotePaypalEvents: Boolean
) {
  result: recommendedEvents(
    filter: {
      lat: $lat, lon: $lon, categoryId: $categoryId, topicCategoryId: $topicCategoryId,
      startDateRange: $startDateRange, doConsolidateEvents: $doConsolidateEvents,
      doPromotePaypalEvents: $doPromotePaypalEvents, indexAlias: $indexAlias
    }
    first: $first, after: $after, sort: { sortField: $sortField }
  ) {
    pageInfo { hasNextPage endCursor }
    totalCount
    edges { node { ...SearchEvent } }
  }
}
fragment SearchEvent on Event {
  id title dateTime description eventType eventUrl
  series { description }
  group { name urlname timezone }
  venue { name address city state country }
}`;

type SearchNode = {
  id?: unknown;
  title?: unknown;
  dateTime?: unknown;
  description?: unknown;
  eventType?: unknown;
  eventUrl?: unknown;
  series?: { description?: unknown } | null;
  group?: { name?: unknown; timezone?: unknown };
  venue?: { name?: unknown; address?: unknown; city?: unknown };
};

type SearchResponse = {
  data?: {
    result?: {
      pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      edges?: { node?: SearchNode }[];
    };
  };
  errors?: { message?: string }[];
};

export type MeetupSearchPage = {
  events: NormalizedEvent[];
  errors: RunError[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

function eventFormat(value: unknown): NormalizedEvent["format"] {
  if (value === "ONLINE") return "online";
  if (value === "HYBRID") return "hybrid";
  return "in_person";
}

/** Maps one GraphQL page into ORBIT's normalised events. */
export function parseMeetupSearchResponse(json: SearchResponse): MeetupSearchPage {
  const result = json?.data?.result;
  const pageInfo = result?.pageInfo;
  const out: MeetupSearchPage = {
    events: [],
    errors: [],
    hasNextPage: !!pageInfo?.hasNextPage,
    nextCursor: pageInfo?.endCursor ?? null,
  };

  if (!result) {
    const message = json?.errors?.[0]?.message ?? "Meetup search returned no results.";
    out.errors.push({ message });
    return out;
  }

  for (const edge of result.edges ?? []) {
    const node = edge?.node;
    if (!node) continue;

    const idValue = id(node.id);
    const title = clamp(oneLine(typeof node.title === "string" ? node.title : ""), LIMITS.title);
    const starts = typeof node.dateTime === "string" ? new Date(node.dateTime) : null;
    const url = safeHttpUrl(typeof node.eventUrl === "string" ? node.eventUrl : null);

    if (!idValue || title.length < 3 || !starts || Number.isNaN(starts.getTime()) || !url) {
      out.errors.push({ event: idValue ?? undefined, message: "Skipped: missing id, title, start or event URL" });
      continue;
    }

    const description = orNull(clamp(cleanProse(stripHtml(typeof node.description === "string" ? node.description : ""), { keepEmphasis: true }), LIMITS.description));
    const groupName = oneLine(typeof node.group?.name === "string" ? node.group.name : "");
    const timezone = typeof node.group?.timezone === "string" && isValidTimezone(node.group.timezone) ? node.group.timezone : "Europe/London";

    out.events.push({
      sourceEventId: `event_${idValue}@meetup.com`,
      title,
      summary: summarise(description) ?? (groupName ? clamp(groupName, LIMITS.summary) : null),
      description,
      startsAt: starts.toISOString(),
      endsAt: null,
      allDay: false,
      timezone,
      format: eventFormat(node.eventType),
      venueName: orNull(clamp(oneLine(typeof node.venue?.name === "string" ? node.venue.name : ""), LIMITS.venue)),
      address: orNull(clamp(oneLine(typeof node.venue?.address === "string" ? node.venue.address : ""), LIMITS.address)),
      city: orNull(clamp(oneLine(typeof node.venue?.city === "string" ? node.venue.city : ""), LIMITS.venue)),
      latitude: null,
      longitude: null,
      url,
      cancelled: false,
      // Search consolidates a series into one result; the connector expands it to every date.
      seriesLabel: typeof node.series?.description === "string" ? orNull(clamp(oneLine(node.series.description), LIMITS.summary)) : null,
    });
  }

  return out;
}

/** One GraphQL page. Throws on HTTP errors so the source run records them. */
export async function fetchMeetupSearchPage(
  args: MeetupSearchArgs,
  after: string | null,
  referer: string,
): Promise<MeetupSearchPage> {
  const variables = {
    lat: args.lat,
    lon: args.lon,
    categoryId: args.categoryId,
    topicCategoryId: args.topicCategoryId,
    startDateRange: args.startDateRange,
    first: MEETUP_SEARCH_PAGE_SIZE,
    after,
    sortField: "RELEVANCE",
    indexAlias: args.indexAlias,
    doConsolidateEvents: true,
    doPromotePaypalEvents: false,
  };

  const response = await fetch(MEETUP_SEARCH_GQL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": USER_AGENT,
      origin: "https://www.meetup.com",
      referer,
    },
    body: JSON.stringify({ operationName: "meetupSearch", variables, query: MEETUP_SEARCH_QUERY }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 429 || response.status === 503) {
    throw new FetchHttpError(`Meetup search asked us to slow down (HTTP ${response.status}).`, response.status);
  }
  if (!response.ok) {
    throw new FetchHttpError(`Meetup search returned HTTP ${response.status}.`, response.status);
  }

  const json = (await response.json().catch(() => null)) as SearchResponse | null;
  if (!json) throw new Error("Meetup search returned an invalid response.");
  return parseMeetupSearchResponse(json);
}
