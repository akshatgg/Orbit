// Eventbrite: the JSON its own website loads (organiser listings, search results, event details).
//
// Terms note: Eventbrite only allows automated access through its official API. The product owner
// accepted this exception (docs/specs/2026-10-22-eventbrite-fatsoma-sources-design.md); keep this
// source opt-in, capped and easy to disable.

import { HINT_WEIGHT } from "./interests";
import { EVENTBRITE_ORIGIN, platformImage } from "./platforms";
import { LIMITS, clamp, htmlToProse, oneLine, orNull, safeHttpUrl, summarise } from "./text";
import { isValidTimezone, zonedTimeToUtc } from "./timezone";
import type { ConnectorResult, InterestHint, NormalizedEvent, RunError } from "./types";

export const EVENTBRITE_BATCH = 50; // ids per details request (the endpoint's page size)
export const EVENTBRITE_MAX_EVENTS = 250;
export const EVENTBRITE_MAX_PAGES = 5; // organiser listing pages (50 ids each)

const API = `${EVENTBRITE_ORIGIN}/api/v3`;
const ID = /^\d{5,20}$/;

/** `eventbrite-<id>`: the source event id of an imported Eventbrite event. */
export const eventbriteSourceId = (id: string) => `eventbrite-${id}`;
export const eventbriteIdOf = (sourceEventId: string | null) =>
  sourceEventId?.startsWith("eventbrite-") && ID.test(sourceEventId.slice(11)) ? sourceEventId.slice(11) : null;

/** One page of an organiser's live events, soonest first. */
export function organizerEventsUrl(organizerId: string, continuation: string | null) {
  const url = new URL(`${API}/organizers/${organizerId}/events/`);
  url.searchParams.set("status", "live");
  url.searchParams.set("order_by", "start_asc");
  if (continuation) url.searchParams.set("continuation", continuation);
  return url.toString();
}

/** Details for up to 50 events, in the shape Eventbrite's own search results use. */
export function eventDetailsUrl(ids: readonly string[]) {
  const url = new URL(`${API}/destination/events/`);
  url.searchParams.set("event_ids", ids.join(","));
  url.searchParams.set("expand", "image,primary_venue,ticket_availability,primary_organizer");
  url.searchParams.set("page_size", String(EVENTBRITE_BATCH));
  return url.toString();
}

/** The event's description as its organiser laid it out. */
export const structuredContentUrl = (id: string) => `${API}/events/${id}/structured_content/?purpose=listing`;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The trailing id of an Eventbrite event link (…/e/name-tickets-123). */
function eventIdFromUrl(value: unknown): string | null {
  const url = safeHttpUrl(typeof value === "string" ? value : null);
  return url?.match(/\/e\/(?:[^/?#]*-)?(\d{5,20})\/?(?:[?#]|$)/)?.[1] ?? null;
}

/** Page `page` of a search (Eventbrite's own `?page=` links; page 1 is asked for too, so a category
 *  search isn't redirected to its 8-event category page). */
export function searchPageUrl(searchUrl: string, page: number) {
  const url = new URL(searchUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
}

/** Event ids from a search page's JSON-LD list (20 per page for a category; 40 for a plain search, which doesn't page). */
export function parseEventbriteSearchPage(html: string): string[] {
  const ids: string[] = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = record(parseJson(match[1]));
    if (data?.["@type"] !== "ItemList" || !Array.isArray(data.itemListElement)) continue;
    for (const element of data.itemListElement) {
      const id = eventIdFromUrl(record(record(element)?.item)?.url);
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/** Ids on one page of an organiser's events, and the cursor for the next page. */
export function parseOrganizerEvents(raw: string): { ids: string[]; continuation: string | null } | null {
  const data = record(parseJson(raw));
  if (!data || !Array.isArray(data.events)) return null;
  const ids = data.events.map((e) => text(record(e)?.id)).filter((id): id is string => !!id && ID.test(id));
  const pagination = record(data.pagination);
  const continuation = pagination?.has_more_items === true ? text(pagination.continuation) : null;
  return { ids, continuation };
}

/** "2026-10-23" + "10:00" in `tz` → ISO UTC, or null. */
function localToUtc(date: unknown, time: unknown, tz: string): string | null {
  const d = typeof date === "string" ? date.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (!d) return null;
  const t = typeof time === "string" ? time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/) : null;
  const instant = zonedTimeToUtc(
    { year: +d[1], month: +d[2], day: +d[3], hour: t ? +t[1] : 0, minute: t ? +t[2] : 0, second: t?.[3] ? +t[3] : 0 },
    tz,
  );
  return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

function money(value: unknown): { amount: number; currency: string } | null {
  const price = record(value);
  const amount = Number(price?.major_value);
  const currency = text(price?.currency)?.toUpperCase();
  return Number.isFinite(amount) && amount >= 0 && currency ? { amount, currency } : null;
}

function priceRange(availability: Record<string, unknown> | null): NormalizedEvent["price"] {
  const min = money(availability?.minimum_ticket_price);
  const max = money(availability?.maximum_ticket_price);
  if (!min || !max || min.currency !== max.currency || max.amount < min.amount) return null;
  return { min: min.amount, max: max.amount, currency: min.currency };
}

const TAG_WEIGHT: Record<string, number> = {
  EventbriteCategory: HINT_WEIGHT.eventCategory,
  EventbriteSubCategory: HINT_WEIGHT.groupCategory,
  EventbriteFormat: HINT_WEIGHT.groupTopic,
};

/** Eventbrite's category, subcategory and format for the event (organisers' own tags are noise). */
function hints(tags: unknown): InterestHint[] {
  return (Array.isArray(tags) ? tags : [])
    .map((tag) => record(tag))
    .filter((tag) => tag && TAG_WEIGHT[String(tag.prefix)])
    .map((tag) => ({ label: text(tag!.display_name) ?? "", weight: TAG_WEIGHT[String(tag!.prefix)] }))
    .filter((hint) => hint.label);
}

function point(address: Record<string, unknown> | null) {
  const latitude = Number(address?.latitude);
  const longitude = Number(address?.longitude);
  if (address?.latitude == null || address?.longitude == null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  // Eventbrite sends the same point with float noise from call to call; 7 decimals is ~1 cm.
  const round = (n: number) => Math.round(n * 1e7) / 1e7;
  return { latitude: round(latitude), longitude: round(longitude) };
}

/** One event from the details endpoint as an ORBIT event, or an error saying why it was skipped. */
function toEvent(raw: Record<string, unknown>): NormalizedEvent | RunError {
  const id = text(raw.id);
  const title = clamp(oneLine(text(raw.name) ?? ""), LIMITS.title);
  if (!id || !ID.test(id)) return { message: "Skipped an Eventbrite event without an id." };
  if (title.length < 3) return { event: eventbriteSourceId(id), message: "Skipped: no title." };

  const timezone = isValidTimezone(text(raw.timezone)) ? text(raw.timezone)! : "Europe/London";
  const startsAt = localToUtc(raw.start_date, raw.start_time, timezone);
  if (!startsAt) return { event: eventbriteSourceId(id), message: "Skipped: no start time." };
  const endsAt = localToUtc(raw.end_date, raw.end_time, timezone);

  const venue = record(raw.primary_venue);
  const address = record(venue?.address);
  const online = raw.is_online_event === true;
  const street = [text(address?.address_1), text(address?.address_2)].filter(Boolean).join(", ");
  const located = point(address);
  const organizer = text(record(raw.primary_organizer)?.name);
  const description = htmlToProse(text(raw.summary));
  const seriesId = text(raw.series_id);

  return {
    sourceEventId: eventbriteSourceId(id),
    title,
    summary: summarise(description) ?? (organizer ? clamp(`Hosted by ${oneLine(organizer)}`, LIMITS.summary) : null),
    description,
    startsAt,
    endsAt: endsAt && endsAt > startsAt ? endsAt : null,
    allDay: false,
    timezone,
    format: online ? "online" : "in_person",
    venueName: online ? null : orNull(clamp(oneLine(text(venue?.name) ?? ""), LIMITS.venue)),
    address: online ? null : orNull(clamp(oneLine(street), LIMITS.address)),
    city: online ? null : orNull(clamp(oneLine(text(address?.city) ?? ""), LIMITS.venue)),
    country: online ? null : text(address?.country),
    latitude: online ? null : (located?.latitude ?? null),
    longitude: online ? null : (located?.longitude ?? null),
    url: safeHttpUrl(text(raw.url)) ?? `${EVENTBRITE_ORIGIN}/e/${id}`,
    cancelled: raw.is_cancelled === true || raw.status === "canceled",
    seriesKey: seriesId && ID.test(seriesId) ? `eventbrite-series-${seriesId}` : null,
    interestHints: hints(raw.tags),
    imageUrl: platformImage("eventbrite", record(record(raw.image)?.original)?.url),
    price: priceRange(record(raw.ticket_availability)),
  };
}

/** Events from one details response. Bad rows are skipped with an error; nothing throws. */
export function parseEventbriteEvents(raw: string): ConnectorResult | null {
  const data = record(parseJson(raw));
  if (!data || !Array.isArray(data.events)) return null;
  const result: ConnectorResult = { events: [], errors: [] };
  for (const item of data.events) {
    const event = record(item);
    // Password-protected or private listings aren't for republishing.
    if (!event || event.is_protected_event === true || (event.privacy_setting && event.privacy_setting !== "unlocked")) continue;
    const parsed = toEvent(event);
    if ("sourceEventId" in parsed) result.events.push(parsed);
    else result.errors.push(parsed);
  }
  return result;
}

/** The full description from an event's structured content (its text modules), or null. */
export function parseEventbriteDescription(raw: string): string | null {
  const data = record(parseJson(raw));
  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const html = modules
    .map((m) => record(m))
    .filter((m) => m?.type === "text")
    .map((m) => text(record(record(m!.data)?.body)?.text))
    .filter(Boolean)
    .join("\n");
  return htmlToProse(html);
}
