// Fatsoma: the JSON:API its own website loads (api.fatsoma.com/v1).
//
// Terms note: Fatsoma's terms (clause 5.1.6) forbid copying or storing its content. The product
// owner accepted this exception (docs/specs/2026-10-22-eventbrite-fatsoma-sources-design.md);
// keep this source opt-in, capped and easy to disable.

import { HINT_WEIGHT } from "./interests";
import { platformImage } from "./platforms";
import { LIMITS, clamp, htmlToProse, oneLine, orNull, summarise } from "./text";
import { isValidTimezone } from "./timezone";
import type { ConnectorResult, InterestHint, NormalizedEvent, RunError } from "./types";

export const FATSOMA_API = "https://api.fatsoma.com/v1";
export const FATSOMA_PAGE_SIZE = 50;
export const FATSOMA_MAX_EVENTS = 250;
export const FATSOMA_MAX_PAGES = 5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const fatsomaSourceId = (id: string) => `fatsoma-${id}`;

/** The organiser page with this vanity name (fatsoma.com/p/<vanity>). */
export const fatsomaPageLookupUrl = (vanity: string) =>
  `${FATSOMA_API}/pages?filter%5Bvanity-name%5D=${encodeURIComponent(vanity)}`;

export type FatsomaFilter = { pageId: string } | { vanity: string } | { latLon: [number, number] };

/**
 * One page of active events starting from now, soonest first. Filtering on the start (not the end)
 * leaves out months-long listings ("every night until June") that began in the past.
 */
export function fatsomaEventsUrl(filter: FatsomaFilter, page: number, now: Date) {
  const url = new URL(`${FATSOMA_API}/events`);
  if ("pageId" in filter) url.searchParams.set("filter[page.id]", filter.pageId);
  if ("vanity" in filter) url.searchParams.set("filter[vanity-name]", filter.vanity);
  if ("latLon" in filter) url.searchParams.set("filter[location.lat-lon]", filter.latLon.join(","));
  url.searchParams.set("filter[status]", "active");
  url.searchParams.set("filter[starts-at][gte]", now.toISOString().slice(0, 19));
  url.searchParams.set("include", "location,page,categories");
  url.searchParams.set("sort", "starts-at");
  url.searchParams.set("page[size]", String(FATSOMA_PAGE_SIZE));
  url.searchParams.set("page[number]", String(page));
  return url.toString();
}

type Resource = { type?: unknown; id?: unknown; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: unknown }> };

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** The search coordinates a city page (/l/gb/london) uses for its own event list. */
export function parseFatsomaCityPage(html: string): [number, number] | null {
  const match = html.match(/filter\[location\.lat-lon\]=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  const [lat, lon] = [Number(match[1]), Number(match[2])];
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}

/** The id of the organiser page from a vanity-name lookup, or null when there is none. */
export function parseFatsomaPageLookup(raw: string): string | null {
  const data = parseJson(raw)?.data;
  const first = record(Array.isArray(data) ? data[0] : data);
  const id = text(first?.id);
  return id && UUID.test(id) ? id : null;
}

/** Pence (Fatsoma's unit) → a price range in pounds, or null when it doesn't add up. */
function priceRange(attributes: Record<string, unknown>): NormalizedEvent["price"] {
  const min = Number(attributes["price-min"]);
  const max = Number(attributes["price-max"]);
  const currency = text(attributes.currency)?.toUpperCase();
  if (attributes["price-min"] == null || attributes["price-max"] == null || !currency) return null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) return null;
  return { min: min / 100, max: max / 100, currency };
}

function point(location: Record<string, unknown> | null) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);
  if (location?.latitude == null || location?.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  return { latitude, longitude };
}

function instant(value: unknown): string | null {
  const date = typeof value === "string" ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

const related = (resource: Resource, name: string) => {
  const data = resource.relationships?.[name]?.data;
  return (Array.isArray(data) ? data : data ? [data] : []).map((d) => record(d)).filter(Boolean) as Record<string, unknown>[];
};

function toEvent(resource: Resource, lookup: (type: string, id: unknown) => Record<string, unknown> | null): NormalizedEvent | RunError {
  const id = text(resource.id);
  const a = resource.attributes ?? {};
  if (!id || !UUID.test(id)) return { message: "Skipped a Fatsoma event without an id." };
  const title = clamp(oneLine(text(a.name) ?? ""), LIMITS.title);
  const vanity = text(a["vanity-name"]);
  const startsAt = instant(a["starts-at"]);
  if (title.length < 3) return { event: fatsomaSourceId(id), message: "Skipped: no title." };
  if (!startsAt) return { event: fatsomaSourceId(id), message: "Skipped: no start time." };
  if (!vanity || !/^[a-z0-9]+$/i.test(vanity)) return { event: fatsomaSourceId(id), message: "Skipped: no event page." };

  const endsAt = instant(a["ends-at"]);
  const locationRef = related(resource, "location")[0];
  const location = locationRef ? lookup("locations", locationRef.id) : null;
  const pageRef = related(resource, "page")[0];
  const organiser = pageRef ? text(lookup("pages", pageRef.id)?.name) : null;
  const located = point(location);
  const timezone = text(location?.timezone);
  const seo = text(a["seo-name"]);
  const description = htmlToProse(text(a.description));
  // `address` is the full one-line address (with postcode); the line fields are usually empty.
  const street =
    text(location?.address) ??
    [text(location?.["address-line-1"]), text(location?.["address-line-2"]), text(location?.["postal-code"])].filter(Boolean).join(", ");
  const interestHints: InterestHint[] = related(resource, "categories")
    .map((c) => text(lookup("categories", c.id)?.name))
    .filter((name): name is string => !!name)
    .map((label) => ({ label, weight: HINT_WEIGHT.eventCategory }));

  return {
    sourceEventId: fatsomaSourceId(id),
    title,
    summary: summarise(description) ?? (organiser ? clamp(`Hosted by ${oneLine(organiser)}`, LIMITS.summary) : null),
    description,
    startsAt,
    endsAt: endsAt && endsAt > startsAt ? endsAt : null,
    allDay: false,
    timezone: timezone && isValidTimezone(timezone) ? timezone : "Europe/London",
    format: "in_person",
    venueName: orNull(clamp(oneLine(text(location?.name) ?? ""), LIMITS.venue)),
    address: orNull(clamp(oneLine(street), LIMITS.address)),
    city: orNull(clamp(oneLine(text(location?.city) ?? ""), LIMITS.venue)),
    latitude: located?.latitude ?? null,
    longitude: located?.longitude ?? null,
    url: `https://www.fatsoma.com/e/${vanity}${seo && /^[a-z0-9-]+$/i.test(seo) ? `/${seo}` : ""}`,
    cancelled: a.health === "cancelled",
    interestHints,
    imageUrl: platformImage("fatsoma", a["asset-url"]),
    price: priceRange(a),
  };
}

/** Events from one API page, plus whether another page follows. Bad rows are skipped, not thrown. */
export function parseFatsomaEvents(raw: string): (ConnectorResult & { total: number | null }) | null {
  const data = parseJson(raw);
  if (!data || !Array.isArray(data.data)) return null;
  const included = new Map<string, Record<string, unknown>>();
  for (const item of Array.isArray(data.included) ? data.included : []) {
    const resource = record(item) as Resource | null;
    if (resource && typeof resource.type === "string" && typeof resource.id === "string" && resource.attributes) {
      included.set(`${resource.type}:${resource.id}`, resource.attributes);
    }
  }
  const lookup = (type: string, id: unknown) => (typeof id === "string" ? (included.get(`${type}:${id}`) ?? null) : null);

  const result: ConnectorResult = { events: [], errors: [] };
  for (const item of data.data) {
    const resource = record(item) as Resource | null;
    if (!resource || resource.type !== "events") continue;
    const parsed = toEvent(resource, lookup);
    if ("sourceEventId" in parsed) result.events.push(parsed);
    else result.errors.push(parsed);
  }
  const total = Number(record(data.meta)?.["total-count"]);
  return { ...result, total: Number.isFinite(total) ? total : null };
}
