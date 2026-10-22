// Reads Luma's discover pages: a city page (lu.ma/london) gives the city's public iCal feed; a
// category page (lu.ma/tech) gives the category, whose events are listed per city by Luma's API.

import { HINT_WEIGHT } from "./interests";
import { LIMITS, clamp, oneLine, orNull } from "./text";
import { isValidTimezone } from "./timezone";
import type { NormalizedEvent, RunError } from "./types";

export type LumaDiscoverPlace = {
  apiId: string;
  slug: string | null;
  name: string | null;
  timezone: string;
  feedUrl: string;
};

type Place = {
  api_id?: unknown;
  slug?: unknown;
  name?: unknown;
  timezone?: unknown;
};

function place(value: unknown): Place | null {
  return value && typeof value === "object" ? (value as Place) : null;
}

/**
 * Produces the `discplace-…` feed for a city page. Supports the current shape
 * (`initialData.data.place`) and the older `initialData.places` / `featured_place` shape.
 */
/** The page's `initialData` from __NEXT_DATA__, or null. */
function initialData(html: string): unknown {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as { props?: { pageProps?: { initialData?: unknown } } })?.props?.pageProps?.initialData ?? null;
  } catch {
    return null;
  }
}

export function parseLumaDiscoverPage(html: string, slug: string | null): LumaDiscoverPlace | null {
  const initial = initialData(html) as
    | {
        data?: { place?: unknown };
        featured_place?: { place?: unknown };
        places?: { place?: unknown }[];
      }
    | undefined;
  if (!initial) return null;

  const candidates: Place[] = [];
  const add = (value: unknown) => {
    const item = place(value);
    if (item) candidates.push(item);
  };
  add(initial.data?.place);
  add(initial.featured_place?.place);
  for (const item of initial.places ?? []) add(item?.place);

  const chosen = slug ? candidates.find((item) => item.slug === slug) : candidates[0];
  if (!chosen) return null;

  const apiId = typeof chosen.api_id === "string" ? chosen.api_id : null;
  if (!apiId?.startsWith("discplace-")) return null;

  const timezone =
    typeof chosen.timezone === "string" && isValidTimezone(chosen.timezone) ? chosen.timezone : "Europe/London";

  return {
    apiId,
    slug: typeof chosen.slug === "string" ? chosen.slug : slug,
    name: typeof chosen.name === "string" ? chosen.name : null,
    timezone,
    feedUrl: `https://api.lu.ma/ics/get?entity=discover&id=${apiId}`,
  };
}

// ─── Category pages ───────────────────────────────────────────────────────

export const LUMA_CATEGORY_PAGE_SIZE = 50;
export const LUMA_CATEGORY_MAX_PAGES = 5;

export type LumaCategory = { apiId: string; slug: string | null; name: string };

/** The category on a category page (lu.ma/tech → `cat-tech`, "Tech"), or null for any other page. */
export function parseLumaCategoryPage(html: string): LumaCategory | null {
  const initial = initialData(html) as { kind?: unknown; data?: { category?: Place } } | null;
  const category = initial?.kind === "category" ? place(initial.data?.category) : null;
  const apiId = typeof category?.api_id === "string" ? category.api_id : null;
  if (!apiId?.startsWith("cat-")) return null;
  return {
    apiId,
    slug: typeof category?.slug === "string" ? category.slug : null,
    name: typeof category?.name === "string" && category.name.trim() ? category.name.trim() : apiId.slice(4),
  };
}

/** One page of a category's upcoming events in one city, soonest first. */
export function lumaCategoryEventsUrl(categoryId: string, placeId: string, cursor: string | null) {
  const params = new URLSearchParams({
    discover_category_api_id: categoryId,
    discover_place_api_id: placeId,
    pagination_limit: String(LUMA_CATEGORY_PAGE_SIZE),
  });
  if (cursor) params.set("pagination_cursor", cursor);
  return `https://api.lu.ma/discover/get-paginated-events?${params}`;
}

type Json = Record<string, unknown>;
const record = (value: unknown): Json | null => (value && typeof value === "object" ? (value as Json) : null);
const text = (value: unknown) => (typeof value === "string" ? value : "");

const LUMA_IMAGE_HOSTS = new Set(["cdn.lu.ma", "images.lumacdn.com"]);

function lumaImage(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" && LUMA_IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

const cents = (value: unknown) => {
  const n = Number(value);
  return value != null && Number.isFinite(n) && n >= 0 ? n / 100 : null;
};

/** "Free", a fixed price, or a pay-what-you-want range; null when Luma doesn't say. */
function ticketPrice(info: Json | null): NormalizedEvent["price"] {
  if (info?.is_free === true) return { min: 0, max: 0, currency: "GBP" };
  const price = record(info?.price);
  const amount = cents(price?.cents);
  const currency = text(price?.currency).toUpperCase();
  if (amount === null || !/^[A-Z]{3}$/.test(currency)) return null;
  const min = price?.is_flexible === true ? (cents(price.min_cents) ?? amount) : amount;
  const max = cents(record(info?.max_price)?.cents) ?? amount;
  return { min: Math.min(min, max), max: Math.max(min, max), currency };
}

/** "A", "A & B", or "A, B and 3 others". */
function hostLine(hosts: string[]) {
  if (hosts.length <= 2) return hosts.join(" & ");
  const others = hosts.length - 2;
  return `${hosts[0]}, ${hosts[1]} and ${others} other${others === 1 ? "" : "s"}`;
}

/** One entry of Luma's paginated events list as an ORBIT event, or a skip reason. */
function categoryEvent(entry: Json, category: LumaCategory): NormalizedEvent | RunError {
  const event = record(entry.event);
  const apiId = text(event?.api_id);
  if (!event || !apiId.startsWith("evt-")) return { message: "Skipped: Luma entry without an event id" };

  const title = clamp(oneLine(text(event.name)), LIMITS.title);
  if (title.length < 3) return { event: apiId, message: "Skipped: title is missing or too short" };
  const starts = new Date(text(event.start_at));
  if (Number.isNaN(starts.getTime())) return { event: apiId, message: "Skipped: invalid start date" };
  const ends = event.end_at ? new Date(text(event.end_at)) : null;
  const slug = text(event.url);
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) return { event: apiId, message: "Skipped: no Luma page" };

  // Luma hides the exact place of some events until you register; only the city is public then.
  const geo = record(event.geo_address_info);
  const shown = geo?.mode === "shown";
  const point = record(event.coordinate);
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);
  const hasPoint = shown && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  const timezone = text(event.timezone);
  const hosts = (Array.isArray(entry.hosts) ? entry.hosts : []).map((h) => oneLine(text(record(h)?.name))).filter(Boolean);

  return {
    sourceEventId: `${apiId}@events.lu.ma`,
    title,
    summary: hosts.length ? orNull(clamp(`Hosted by ${hostLine(hosts)}`, LIMITS.summary)) : null,
    description: null,
    startsAt: starts.toISOString(),
    endsAt: ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : null,
    allDay: false,
    timezone: isValidTimezone(timezone) ? timezone : "Europe/London",
    format: event.location_type === "offline" ? "in_person" : "online",
    venueName: shown ? orNull(clamp(oneLine(text(geo?.address)), LIMITS.venue)) : null,
    address: shown ? orNull(clamp(oneLine(text(geo?.short_address)), LIMITS.address)) : null,
    city: orNull(clamp(oneLine(text(geo?.city)), LIMITS.venue)),
    country: orNull(text(geo?.country_code)),
    latitude: hasPoint ? latitude : null,
    longitude: hasPoint ? longitude : null,
    url: `https://luma.com/${slug}`,
    cancelled: false,
    interestHints: [{ label: category.name, weight: HINT_WEIGHT.eventCategory }],
    imageUrl: lumaImage(event.cover_url),
    price: ticketPrice(record(entry.ticket_info)),
  };
}

export type LumaCategoryPage = { events: NormalizedEvent[]; errors: RunError[]; hasMore: boolean; nextCursor: string | null };

/** One page of Luma's paginated events response. Throws when the response isn't that shape. */
export function parseLumaCategoryEvents(body: string, category: LumaCategory): LumaCategoryPage {
  const data = record(JSON.parse(body));
  if (!data || !Array.isArray(data.entries)) throw new Error("Luma's event list came back in an unexpected shape.");
  const events: NormalizedEvent[] = [];
  const errors: RunError[] = [];
  for (const entry of data.entries) {
    const result = categoryEvent(record(entry) ?? {}, category);
    if ("sourceEventId" in result) events.push(result);
    else errors.push(result);
  }
  const nextCursor = text(data.next_cursor) || null;
  return { events, errors, hasMore: data.has_more === true && nextCursor !== null, nextCursor };
}
