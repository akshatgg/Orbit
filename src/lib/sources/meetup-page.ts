// Reads a Meetup event page for its venue: name, street address, city and coordinates.
//
// Meetup's iCal feed often omits LOCATION entirely, so this is the only automatic source for
// where an imported Meetup event is. The public page carries schema.org JSON-LD plus a venue
// object in its app data (which includes lat/lng).

import { LIMITS, clamp, decodeEntities, orNull } from "./text";

export type MeetupPageDetails = {
  venueName: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

function firstEvent(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    for (const item of Array.isArray(data) ? data : [data]) {
      if (item && typeof item === "object" && (item as Record<string, unknown>)["@type"] === "Event") {
        return item as Record<string, unknown>;
      }
    }
  }
  return null;
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

function validPoint(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

/** Venue details from a Meetup event page, or null when the page has no location. */
export function parseMeetupEventPage(html: string): MeetupPageDetails | null {
  const event = firstEvent(html);
  const location = event && typeof event.location === "object" ? (event.location as Record<string, unknown>) : null;
  const address = location && typeof location.address === "object" ? (location.address as Record<string, unknown>) : null;

  const jsonLdName = text(location?.name);
  const state = venueState(html, jsonLdName);
  const venueName = jsonLdName ?? state?.name ?? null;
  const street = state?.address ?? text(address?.streetAddress);
  const city = state?.city ?? text(address?.addressLocality);
  const point = validPoint(state?.latitude ?? null, state?.longitude ?? null);

  if (!venueName && !street && !city && !point) return null;

  return {
    venueName: orNull(clamp(decodeEntities(venueName ?? ""), LIMITS.venue)),
    address: orNull(clamp(decodeEntities(street ?? ""), LIMITS.address)),
    city: orNull(clamp(decodeEntities(city ?? ""), LIMITS.venue)),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
  };
}
