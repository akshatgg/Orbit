// Reads a Meetup event page for its venue (name, street address, city, coordinates) and cover.
//
// Meetup's iCal feed often omits LOCATION entirely, so this is the only automatic source for
// where an imported Meetup event is. The public page carries schema.org JSON-LD plus a venue
// object in its app data (which includes lat/lng).

import { LIMITS, clamp, cleanProse, decodeEntities, oneLine, orNull, safeHttpUrl, stripHtml, summarise } from "./text";
import { firstJsonLdEvent } from "./jsonld";
import { isValidTimezone } from "./timezone";
import { HINT_WEIGHT } from "./interests";
import type { InterestHint, NormalizedEvent } from "./types";

export type MeetupPageDetails = {
  venueName: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  interestHints?: InterestHint[];
};

const IMAGE_HOSTS = new Set(["secure.meetupstatic.com", "secure-content.meetupstatic.com"]);

function safeImage(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(decodeEntities(value));
    return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** The event's own photo at full size (`"featuredEventPhoto":{…,"source":…}`), else og:image. */
function coverImage(html: string): string | null {
  const featured = html.match(/"featuredEventPhoto":\{[^}]*?"source":"([^"]+)"/)?.[1];
  const ogTag = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
  return safeImage(featured) ?? safeImage(ogTag?.match(/content=["']([^"']+)["']/i)?.[1]);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type VenueState = { name: string | null; address: string | null; city: string | null; latitude: number | null; longitude: number | null };

function parseVenueObject(object: string): VenueState {
  const string = (key: string) => object.match(new RegExp(`"${key}":\\s*"([^"]*)"`))?.[1] ?? null;
  const numeric = (key: string) => number(object.match(new RegExp(`"${key}":\\s*(-?\\d+(?:\\.\\d+)?)`))?.[1]);
  return {
    name: string("name"),
    address: string("address"),
    city: string("city"),
    latitude: numeric("lat"),
    longitude: numeric("lng") ?? numeric("lon"),
  };
}

/**
 * Meetup embeds the venue as `"venue":{"name":…,"address":…,"city":…,"lat":…,"lng":…}`.
 * Scans those objects, preferring one whose name matches the JSON-LD location.
 */
function venueState(html: string, name: string | null): VenueState | null {
  const state = findVenueState(html, name);
  // Online events carry a placeholder venue ("Online event", at a point in the Pacific): not a place.
  return state?.name === ONLINE_VENUE ? null : state;
}

/** Meetup's name for the placeholder venue on online events. */
const ONLINE_VENUE = "Online event";

function findVenueState(html: string, name: string | null): VenueState | null {
  let fallback: VenueState | null = null;
  for (const match of html.matchAll(/"venue":\{/g)) {
    const start = match.index ?? -1;
    const end = start >= 0 ? html.indexOf("}", start) : -1;
    if (end < 0) continue;
    const state = parseVenueObject(html.slice(start, end));
    if (!fallback) fallback = state;
    if (name && state.name === name) return state;
  }
  if (fallback) return fallback;

  // Last resort: the page may keep the coordinates outside the venue object.
  const pair = html.match(/"lat":\s*(-?\d+(?:\.\d+)?)[^}]{0,100}?"(?:lng|lon)":\s*(-?\d+(?:\.\d+)?)/);
  return pair
    ? { name: null, address: null, city: null, latitude: number(pair[1]), longitude: number(pair[2]) }
    : null;
}

/** The event record in the page's __NEXT_DATA__ (`props.pageProps.event`). */
function pageEvent(html: string): Record<string, unknown> | null {
  const raw = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return null;
  try {
    const event = JSON.parse(raw)?.props?.pageProps?.event;
    return event && typeof event === "object" ? (event as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The event's full description (Markdown) from the page data. The JSON-LD copy is cut at about
 * 155 characters, often mid-word and mid-`**bold**`.
 */
function pageDescription(page: Record<string, unknown> | null): string | null {
  return typeof page?.description === "string" && page.description.trim() ? page.description : null;
}

/** The group's Meetup category (medium evidence) and topics (weak: they cover the whole group). */
function pageHints(page: Record<string, unknown> | null): InterestHint[] {
  const group = page?.group as { topicCategory?: { name?: unknown } | null; topics?: { name?: unknown }[] | null } | undefined;
  const hints: InterestHint[] = [];
  if (typeof group?.topicCategory?.name === "string") hints.push({ label: group.topicCategory.name, weight: HINT_WEIGHT.groupCategory });
  for (const topic of Array.isArray(group?.topics) ? group.topics : []) {
    if (typeof topic?.name === "string") hints.push({ label: topic.name, weight: HINT_WEIGHT.groupTopic });
  }
  return hints;
}

/** "Every week on Wednesday until …" when the event is one date of a recurring series. */
function pageSeriesLabel(page: Record<string, unknown> | null): string | null {
  const series = page?.series as { description?: unknown } | null | undefined;
  return typeof series?.description === "string" ? orNull(clamp(oneLine(series.description), LIMITS.summary)) : null;
}

function validPoint(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/**
 * One Meetup event page as an ORBIT event. Used when an admin pastes a single event link
 * instead of a search page. The page's JSON-LD and venue state carry everything we need.
 */
export function parseMeetupLinkedEvent(html: string, pageUrl: string): NormalizedEvent | null {
  const event = firstJsonLdEvent(html);
  if (!event) return null;

  // Unannounced dates of a series have a lowercase-letter id until Meetup gives them a number.
  const idPattern = /\/events\/(\d+|[a-z]{10,})(?:\/|$)/;
  const idMatch = pageUrl.match(idPattern) ?? (typeof event.url === "string" ? event.url.match(idPattern) : null);
  const eventId = idMatch?.[1];
  const title = clamp(oneLine(text(event.name) ?? ""), LIMITS.title);
  const starts = typeof event.startDate === "string" ? new Date(event.startDate) : null;
  const ends = typeof event.endDate === "string" && event.endDate ? new Date(event.endDate) : null;
  const url = safeHttpUrl(text(event.url) ?? pageUrl) ?? safeHttpUrl(pageUrl);
  if (!eventId || title.length < 3 || !starts || Number.isNaN(starts.getTime()) || !url) return null;

  const location = event.location && typeof event.location === "object" ? (event.location as Record<string, unknown>) : null;
  const address = location?.address && typeof location.address === "object" ? (location.address as Record<string, unknown>) : null;
  const venueName = text(location?.name);
  const state = venueState(html, venueName);
  const point = validPoint(state?.latitude ?? null, state?.longitude ?? null);
  const timezone = html.match(/"timezone":"([^"]+)"/)?.[1] ?? null;

  const organizer = Array.isArray(event.organizer) ? event.organizer[0] : event.organizer;
  const organizerName = organizer && typeof organizer === "object" ? text((organizer as Record<string, unknown>).name) : null;
  const page = pageEvent(html);
  const description = orNull(clamp(cleanProse(stripHtml(pageDescription(page) ?? text(event.description) ?? ""), { keepEmphasis: true }), LIMITS.description));
  const mode = text(event.eventAttendanceMode) ?? "";
  const status = text(event.eventStatus) ?? "";

  return {
    sourceEventId: `event_${eventId}@meetup.com`,
    title,
    summary: summarise(description) ?? (organizerName ? clamp(organizerName, LIMITS.summary) : null),
    description,
    startsAt: starts.toISOString(),
    endsAt: ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : null,
    allDay: false,
    timezone: timezone && isValidTimezone(timezone) ? timezone : "Europe/London",
    format: mode.includes("Online") ? "online" : mode.includes("Mixed") ? "hybrid" : "in_person",
    venueName: orNull(clamp(state?.name ?? venueName ?? "", LIMITS.venue)),
    address: orNull(clamp(state?.address ?? text(address?.streetAddress) ?? "", LIMITS.address)),
    city: orNull(clamp(state?.city ?? text(address?.addressLocality) ?? "", LIMITS.venue)),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    url,
    cancelled: status.includes("Cancelled"),
    seriesLabel: pageSeriesLabel(page),
    interestHints: pageHints(page),
  };
}

/** Venue details and cover from a Meetup event page, or null when the page has neither. */
export function parseMeetupEventPage(html: string): MeetupPageDetails | null {
  const event = firstJsonLdEvent(html);
  const location = event && typeof event.location === "object" ? (event.location as Record<string, unknown>) : null;
  const address = location && typeof location.address === "object" ? (location.address as Record<string, unknown>) : null;

  const jsonLdName = text(location?.name);
  const state = venueState(html, jsonLdName);
  const venueName = jsonLdName ?? state?.name ?? null;
  const street = state?.address ?? text(address?.streetAddress);
  const city = state?.city ?? text(address?.addressLocality);
  const point = validPoint(state?.latitude ?? null, state?.longitude ?? null);
  const coverUrl = coverImage(html);
  const interestHints = pageHints(pageEvent(html));

  if (!venueName && !street && !city && !point && !coverUrl && interestHints.length === 0) return null;

  return {
    venueName: orNull(clamp(decodeEntities(venueName ?? ""), LIMITS.venue)),
    address: orNull(clamp(decodeEntities(street ?? ""), LIMITS.address)),
    city: orNull(clamp(decodeEntities(city ?? ""), LIMITS.venue)),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    coverUrl,
    interestHints,
  };
}
