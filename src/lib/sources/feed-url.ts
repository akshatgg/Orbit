// What an admin pastes into the source form → the feed URL the Orbit API fetches
// (Luma, Meetup, Eventbrite and Fatsoma links), plus each platform's default credit line.

import type { SourceKind } from "./types";
import { checkFeedUrl } from "./url-guard";

export type FeedUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Credit line used when an admin leaves attribution empty. */
export const DEFAULT_ATTRIBUTION: Partial<Record<SourceKind, string>> = {
  luma: "From Luma",
  "luma-discover": "From Luma",
  meetup: "From Meetup",
  "meetup-search": "From Meetup",
  eventbrite: "From Eventbrite",
  fatsoma: "From Fatsoma",
};

const LUMA_HOSTS = new Set(["lu.ma", "www.lu.ma", "luma.com", "www.luma.com", "api.lu.ma", "api.luma.com"]);
const LUMA_FEED_HOSTS = new Set(["api.lu.ma", "api.luma.com"]);
const LUMA_PAGE_HOSTS = new Set(["lu.ma", "www.lu.ma", "luma.com", "www.luma.com"]);

/** First path segments on meetup.com that are site pages, not groups. */
const MEETUP_RESERVED = new Set([
  "find", "topics", "cities", "events", "login", "register", "apps", "about", "help", "pro", "lp", "blog",
  "home", "messages", "account", "notifications", "create", "start", "members", "groups",
]);
const MEETUP_LOCALE = /^[a-z]{2}-[A-Z]{2}$/;

/** Parses user input that may lack a scheme ("meetup.com/x"). */
function parseLoose(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function finalCheck(url: string): FeedUrlResult {
  const check = checkFeedUrl(url);
  return check.ok ? { ok: true, url: check.url.toString() } : { ok: false, error: check.error };
}

function resolveMeetup(input: string): FeedUrlResult {
  const url = parseLoose(input);
  const host = url?.hostname.toLowerCase().replace(/^www\./, "");
  if (!url || host !== "meetup.com") {
    return { ok: false, error: "Paste a Meetup group link, e.g. https://www.meetup.com/your-group/" };
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const urlname = MEETUP_LOCALE.test(segments[0] ?? "") ? segments[1] : segments[0];
  if (!urlname || MEETUP_RESERVED.has(urlname.toLowerCase()) || !/^[A-Za-z0-9-]{2,80}$/.test(urlname)) {
    return { ok: false, error: "That isn't a Meetup group link. Open the group and copy its address, e.g. https://www.meetup.com/your-group/" };
  }
  return finalCheck(`https://www.meetup.com/${urlname}/events/ical/`);
}

function resolveLuma(input: string): FeedUrlResult {
  const url = parseLoose(input.trim().replace(/^webcal:\/\//i, "https://"));
  const host = url?.hostname.toLowerCase();
  if (!url || !host || !LUMA_HOSTS.has(host)) {
    return { ok: false, error: "Paste the calendar's Subscribe → iCal link from Luma (it starts with webcal://api.lu.ma/ics/…)." };
  }
  if (!LUMA_FEED_HOSTS.has(host) || !url.pathname.startsWith("/ics/")) {
    return { ok: false, error: "That's a Luma page, not its feed. Paste the calendar's Subscribe → iCal link instead." };
  }
  return finalCheck(url.toString());
}

/** First path segments on Luma that are site pages, not city slugs. */
const LUMA_RESERVED = new Set([
  "event", "events", "discover", "home", "signin", "signup", "create", "manage", "ics", "api",
  "about", "help", "pricing", "blog", "careers", "terms", "privacy", "download", "explore",
  "user", "calendar", "cal",
]);

/** The city slug of a Luma city page, or null. */
export function lumaDiscoverSlug(input: string): string | null {
  const url = parseLoose(input.trim());
  if (!url) return null;
  if (!LUMA_PAGE_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const slug = segments[0].toLowerCase();
  return /^[a-z0-9-]{2,80}$/.test(slug) && !LUMA_RESERVED.has(slug) ? slug : null;
}

function resolveLumaDiscover(input: string): FeedUrlResult {
  const raw = parseLoose(input.trim());
  const host = raw?.hostname.toLowerCase();
  const segments = raw?.pathname.split("/").filter(Boolean) ?? [];
  if (raw && host && LUMA_PAGE_HOSTS.has(host) && segments[0] === "event" && segments[1]) {
    return finalCheck(raw.toString());
  }

  const slug = lumaDiscoverSlug(input);
  if (!slug) {
    return { ok: false, error: "Paste a Luma city, category or event link, e.g. https://lu.ma/london." };
  }
  const near = raw?.searchParams.get("near");
  if (near != null && !lumaNearSlug(input)) {
    return { ok: false, error: "After near=, put a Luma city page name, e.g. https://luma.com/tech?near=bengaluru." };
  }
  return finalCheck(`https://luma.com/${slug}${near ? `?near=${near.trim().toLowerCase()}` : ""}`);
}

/**
 * The city for a Luma category link (luma.com/tech?near=bengaluru), or null. A category page
 * lists events near whoever opens it, so the link names the city to import.
 */
export function lumaNearSlug(input: string): string | null {
  const near = parseLoose(input.trim())?.searchParams.get("near")?.trim().toLowerCase();
  return near && /^[a-z0-9-]{2,80}$/.test(near) && !LUMA_RESERVED.has(near) ? near : null;
}

function resolveMeetupSearch(input: string): FeedUrlResult {
  const url = parseLoose(input);
  const host = url?.hostname.toLowerCase().replace(/^www\./, "");
  if (!url || host !== "meetup.com") {
    return { ok: false, error: "Paste a Meetup event link or search link." };
  }

  const isFind = /^\/find\/?$/.test(url.pathname);
  const isEvent = !url.pathname.startsWith("/find/") && /^\/[^/]+\/events\/\d+\/?$/.test(url.pathname);
  if (!isFind && !isEvent) {
    return {
      ok: false,
      error: "Paste a Meetup event link (…/events/123/) or a search link (…/find/?location=…).",
    };
  }
  if (isFind && meetupFindMissingLocation(url.toString())) return { ok: false, error: MEETUP_LOCATION_ERROR };
  return finalCheck(url.toString());
}

export const MEETUP_LOCATION_ERROR =
  "Add a city to this Meetup search link: pick a location on Meetup, then copy the link again. It should contain &location=…, e.g. https://www.meetup.com/find/?categoryId=546&source=EVENTS&location=gb--London";

/**
 * A Meetup find link without `location`: Meetup then centres the search on wherever the request
 * comes from, so the same link returns Europe one night and India the next.
 */
export function meetupFindMissingLocation(input: string): boolean {
  const url = parseLoose(input);
  if (!url || !/^\/find\/?$/.test(url.pathname)) return false;
  return !url.searchParams.get("location")?.trim();
}

// ─── Eventbrite ───────────────────────────────────────────────────────────

/** eventbrite.com, eventbrite.co.uk, eventbrite.ie, eventbrite.com.au… with or without www. */
const EVENTBRITE_HOST = /^(?:www\.)?eventbrite\.[a-z]{2,3}(?:\.[a-z]{2})?$/;
/** The host ORBIT reads from: its own API answers there, for events on every country site. */
export const EVENTBRITE_ORIGIN = "https://www.eventbrite.co.uk";

export type EventbriteLink =
  | { type: "organizer"; id: string; url: string }
  | { type: "event"; id: string; url: string }
  | { type: "search"; url: string };

const EVENTBRITE_SLUG = /^[a-z0-9-]+$/i;

/**
 * What an Eventbrite link points at: an organiser (/o/…), one event (/e/…) or a search (/d/…).
 * A category page (/b/<place>/<category>/) only ever shows 8 events, so it becomes the same search
 * (/d/<place>/<category>--events/), which pages through all of them.
 */
export function eventbriteLink(input: string): EventbriteLink | null {
  const url = parseLoose(input);
  if (!url || !EVENTBRITE_HOST.test(url.hostname.toLowerCase())) return null;
  const [section, slug, ...rest] = url.pathname.split("/").filter(Boolean);
  if (section === "o" && slug && rest.length === 0) {
    const id = slug.match(/(?:^|-)(\d{5,20})$/)?.[1];
    return id ? { type: "organizer", id, url: `${EVENTBRITE_ORIGIN}/o/${slug}` } : null;
  }
  if (section === "e" && slug && rest.length === 0) {
    const id = slug.match(/(?:^|-)(\d{5,20})$/)?.[1];
    return id ? { type: "event", id, url: `${EVENTBRITE_ORIGIN}/e/${slug}` } : null;
  }
  if (section === "d" && slug && EVENTBRITE_SLUG.test(slug) && rest.length <= 1) {
    return { type: "search", url: `${EVENTBRITE_ORIGIN}${url.pathname.replace(/\/?$/, "/")}${url.search}` };
  }
  if (section === "b" && slug && EVENTBRITE_SLUG.test(slug) && rest.length === 1 && EVENTBRITE_SLUG.test(rest[0])) {
    return { type: "search", url: `${EVENTBRITE_ORIGIN}/d/${slug}/${rest[0].toLowerCase()}--events/` };
  }
  return null;
}

function resolveEventbrite(input: string): FeedUrlResult {
  const link = eventbriteLink(input);
  if (!link) {
    return {
      ok: false,
      error: "Paste an Eventbrite organiser page (…/o/name-123), event page (…/e/name-tickets-123), category page (…/b/united-kingdom--london/music/) or search page (…/d/united-kingdom--london/events/).",
    };
  }
  return finalCheck(link.url);
}

// ─── Fatsoma ──────────────────────────────────────────────────────────────

const FATSOMA_HOSTS = new Set(["fatsoma.com", "www.fatsoma.com"]);
const FATSOMA_SLUG = /^[a-z0-9][a-z0-9_-]{0,99}$/i;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FatsomaLink =
  | { type: "page"; vanity: string; url: string }
  | { type: "event"; vanity: string; url: string }
  | { type: "city"; url: string }
  | { type: "discover"; categoryId: string | null; latLon: [number, number] | null; url: string };

/** "51.5072178,-0.1275862" → [lat, lon], or null when it isn't a point on the map. */
function latLonParam(value: string | null): [number, number] | null {
  const match = value?.trim().match(/^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const [lat, lon] = [Number(match[1]), Number(match[2])];
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}

/**
 * The Discover page (/discover?category-id=…&lat-lng=…&location=London, UK): a category, a place,
 * or both. Neither is just "everything on Fatsoma", which isn't a source.
 */
function fatsomaDiscover(url: URL): FatsomaLink | null {
  const rawCategory = url.searchParams.get("category-id");
  const rawLatLon = url.searchParams.get("lat-lng");
  const categoryId = rawCategory && UUID.test(rawCategory) ? rawCategory.toLowerCase() : null;
  const latLon = latLonParam(rawLatLon);
  if ((rawCategory && !categoryId) || (rawLatLon && !latLon) || (!categoryId && !latLon)) return null;
  const clean = new URL("https://www.fatsoma.com/discover");
  if (categoryId) clean.searchParams.set("category-id", categoryId);
  if (latLon) {
    clean.searchParams.set("lat-lng", latLon.join(","));
    const place = url.searchParams.get("location")?.trim().slice(0, 100);
    if (place) clean.searchParams.set("location", place);
  }
  return { type: "discover", categoryId, latLon, url: clean.toString() };
}

/**
 * What a Fatsoma link points at: an organiser (/p/…), one event (/e/…), a city (/l/gb/london) or a
 * Discover search (/discover?category-id=…&lat-lng=…).
 */
export function fatsomaLink(input: string): FatsomaLink | null {
  const url = parseLoose(input);
  if (!url || !FATSOMA_HOSTS.has(url.hostname.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 1 && segments[0] === "discover") return fatsomaDiscover(url);
  const [section, first, second] = segments;
  if (!first || !FATSOMA_SLUG.test(first)) return null;
  if (section === "p" && segments.length <= 3) {
    return { type: "page", vanity: first, url: `https://www.fatsoma.com/p/${first}` };
  }
  if (section === "e" && segments.length <= 3 && (!second || FATSOMA_SLUG.test(second))) {
    return { type: "event", vanity: first, url: `https://www.fatsoma.com/e/${first}${second ? `/${second}` : ""}` };
  }
  if (section === "l" && second && FATSOMA_SLUG.test(second) && segments.length === 3 && first !== "locations") {
    return { type: "city", url: `https://www.fatsoma.com/l/${first.toLowerCase()}/${second.toLowerCase()}` };
  }
  return null;
}

function resolveFatsoma(input: string): FeedUrlResult {
  const link = fatsomaLink(input);
  if (!link) {
    return {
      ok: false,
      error:
        "Paste a Fatsoma organiser page (…/p/name), event page (…/e/abc123/name), city page (…/l/gb/london) or Discover page with a category or location picked (…/discover?category-id=…).",
    };
  }
  return finalCheck(link.url);
}

/** Turns what an admin pasted into the feed URL ORBIT fetches. */
export function resolveFeedUrl(kind: SourceKind, input: string): FeedUrlResult {
  if (kind === "meetup") return resolveMeetup(input);
  if (kind === "meetup-search") return resolveMeetupSearch(input);
  if (kind === "luma") return resolveLuma(input);
  if (kind === "luma-discover") return resolveLumaDiscover(input);
  if (kind === "eventbrite") return resolveEventbrite(input);
  if (kind === "fatsoma") return resolveFatsoma(input);
  return finalCheck(input);
}
