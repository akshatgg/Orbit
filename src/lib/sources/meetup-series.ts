// Recurring Meetup series. Meetup lists each date of a series as its own event (own page, own RSVP)
// and links them in a series ("Every week on Wednesday until …"). ORBIT imports every upcoming date
// the same way: one event per date, all sharing a series key, so discovery can show the next date
// and the event page can list them all.

import { FetchHttpError, USER_AGENT } from "./fetch";
import { meetupImage } from "./meetup-page";
import { MEETUP_SEARCH_GQL } from "./meetup-search";
import { LIMITS, clamp, oneLine, orNull, safeHttpUrl } from "./text";
import type { NormalizedEvent, RunError } from "./types";

/** Dates imported per series: about three months of a weekly meetup. */
export const MEETUP_SERIES_MAX_DATES = 12;
/** Series looked up per source run (one GraphQL call each). */
export const MEETUP_SERIES_MAX_PER_RUN = 25;

const SERIES_QUERY = `query eventSeries($id: ID!) {
  event(id: $id) {
    series {
      description
      events { edges { node { id dateTime endTime eventUrl status featuredEventPhoto { highResUrl } } } }
    }
  }
}`;

export type MeetupSeriesDate = {
  id: string; startsAt: string; endsAt: string | null; url: string; cancelled: boolean; imageUrl?: string | null;
};
export type MeetupSeries = { label: string | null; dates: MeetupSeriesDate[] };

type SeriesResponse = {
  data?: {
    event?: {
      series?: {
        description?: unknown;
        events?: {
          edges?: {
            node?: {
              id?: unknown; dateTime?: unknown; endTime?: unknown; eventUrl?: unknown; status?: unknown;
              featuredEventPhoto?: { highResUrl?: unknown } | null;
            };
          }[];
        };
      } | null;
    } | null;
  };
};

const isoOrNull = (value: unknown) => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/** The series' label and dates, or null when the event isn't part of a series. */
export function parseMeetupSeriesResponse(json: SeriesResponse | null): MeetupSeries | null {
  const series = json?.data?.event?.series;
  if (!series) return null;
  const dates: MeetupSeriesDate[] = [];
  for (const edge of series.events?.edges ?? []) {
    const node = edge?.node;
    const id = typeof node?.id === "string" || typeof node?.id === "number" ? String(node.id) : null;
    const startsAt = isoOrNull(node?.dateTime);
    const url = safeHttpUrl(typeof node?.eventUrl === "string" ? node.eventUrl : null);
    if (!id || !/^[a-z0-9]+$/i.test(id) || !startsAt || !url) continue;
    const photo = node?.featuredEventPhoto?.highResUrl;
    dates.push({
      id, startsAt, endsAt: isoOrNull(node?.endTime), url, cancelled: node?.status === "CANCELLED",
      imageUrl: meetupImage(typeof photo === "string" ? photo : null),
    });
  }
  const label = typeof series.description === "string" ? orNull(clamp(oneLine(series.description), LIMITS.summary)) : null;
  return { label, dates };
}

/** One GraphQL call for an event's series. Throws on HTTP errors so the run records them. */
export async function fetchMeetupSeries(eventId: string, referer: string): Promise<MeetupSeries | null> {
  const response = await fetch(MEETUP_SEARCH_GQL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": USER_AGENT,
      origin: "https://www.meetup.com",
      referer,
    },
    body: JSON.stringify({ operationName: "eventSeries", variables: { id: eventId }, query: SERIES_QUERY }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new FetchHttpError(`Meetup series lookup returned HTTP ${response.status}.`, response.status);
  return parseMeetupSeriesResponse((await response.json().catch(() => null)) as SeriesResponse | null);
}

/** Meetup's event id from ORBIT's source id (`event_<id>@meetup.com`). */
export const meetupEventId = (sourceEventId: string) => sourceEventId.match(/^event_([a-z0-9]+)@meetup\.com$/i)?.[1] ?? null;

/** Shared by every date of one series: the group plus the title (`meetup:<group>:<title>`). */
export function meetupSeriesKey(event: Pick<NormalizedEvent, "url" | "title">): string | null {
  const group = event.url?.match(/meetup\.com\/([^/]+)\/events\//i)?.[1]?.toLowerCase();
  const title = event.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return group && title ? `meetup:${group}:${title}` : null;
}

/**
 * One event per upcoming date of the series, soonest first: each a copy of `base` with its own id,
 * times and link. Dates that ended over a day ago are dropped.
 */
export function expandSeries(base: NormalizedEvent, series: MeetupSeries, now: Date): NormalizedEvent[] {
  const seriesKey = meetupSeriesKey(base);
  const seriesLabel = series.label ?? base.seriesLabel ?? null;
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const dates = series.dates
    .filter((d) => new Date(d.endsAt ?? d.startsAt).getTime() >= cutoff)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, MEETUP_SERIES_MAX_DATES);
  if (dates.length === 0) return [{ ...base, seriesKey, seriesLabel }];
  return dates.map((d) => ({
    ...base,
    sourceEventId: `event_${d.id}@meetup.com`,
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    url: d.url,
    cancelled: d.cancelled,
    imageUrl: d.imageUrl ?? base.imageUrl ?? null,
    seriesKey,
    seriesLabel,
  }));
}

/**
 * Replaces each series event (one with a `seriesLabel`) by all of its upcoming dates. One lookup
 * per series, politely spaced. A failed lookup keeps the single date (still grouped) and is recorded.
 */
export async function withSeriesDates(
  events: NormalizedEvent[],
  { now, referer, errors, lookup = fetchMeetupSeries, pauseMs = 500 }: {
    now: Date;
    referer: string;
    errors: RunError[];
    lookup?: (eventId: string, referer: string) => Promise<MeetupSeries | null>;
    pauseMs?: number;
  },
): Promise<NormalizedEvent[]> {
  const out: NormalizedEvent[] = [];
  const expanded = new Set<string>();
  let lookups = 0;
  for (const event of events) {
    const key = event.seriesLabel ? meetupSeriesKey(event) : null;
    const id = meetupEventId(event.sourceEventId);
    if (!key || !id) {
      out.push(event);
      continue;
    }
    if (expanded.has(key)) continue; // another date of a series already expanded
    if (lookups >= MEETUP_SERIES_MAX_PER_RUN) {
      out.push({ ...event, seriesKey: key });
      continue;
    }
    if (lookups > 0 && pauseMs > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));
    lookups++;
    try {
      const series = await lookup(id, referer);
      out.push(...(series ? expandSeries(event, series, now) : [{ ...event, seriesKey: key }]));
      expanded.add(key);
    } catch (e) {
      errors.push({ event: event.sourceEventId, message: `Series dates: ${e instanceof Error ? e.message : String(e)}` });
      out.push({ ...event, seriesKey: key });
    }
  }
  // Search results may also list later dates of an expanded series: keep one copy of each date.
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.sourceEventId) ? false : (seen.add(e.sourceEventId), true)));
}
