// Platform-specific handling for Luma and Meetup sources: feed URLs, feed clean-up, page links.

import { LIMITS, clamp, orNull } from "./text";
import type { NormalizedEvent, SourceKind } from "./types";
import { checkFeedUrl } from "./url-guard";

export type FeedUrlResult = { ok: true; url: string } | { ok: false; error: string };

/** Credit line used when an admin leaves attribution empty. */
export const DEFAULT_ATTRIBUTION: Partial<Record<SourceKind, string>> = {
  luma: "From Luma",
  meetup: "From Meetup",
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

/** Turns what an admin pasted into the feed URL ORBIT fetches. */
export function resolveFeedUrl(kind: SourceKind, input: string): FeedUrlResult {
  if (kind === "meetup") return resolveMeetup(input);
  if (kind === "luma") return resolveLuma(input);
  return finalCheck(input);
}

// Luma's feed DESCRIPTION is only a stub:
//   "Get up-to-date information at: https://luma.com/<slug>\n\nAddress:\n…\n\nHosted by <host>"
// or, for external entries (calev-…): "Find more information on https://luma.com/<calendar>".
const LUMA_LINK = /https:\/\/(?:www\.)?(?:luma\.com|lu\.ma)\/[A-Za-z0-9_-]+/;
const HOSTED_BY = /^Hosted by (.+)$/m;

/** Platform tidy-up after parsing the feed. Other kinds pass through unchanged. */
export function cleanEvent(kind: SourceKind, event: NormalizedEvent): NormalizedEvent {
  if (kind !== "luma") return event;
  const stub = event.description ?? "";
  const host = stub.match(HOSTED_BY)?.[1]?.trim();
  return {
    ...event,
    url: event.url ?? stub.match(LUMA_LINK)?.[0] ?? null,
    description: null,
    summary: host ? orNull(clamp(`Hosted by ${host}`, LIMITS.summary)) : null,
  };
}

/** The Luma page to read for an imported event, or null when it isn't a Luma event page. */
export function lumaPageUrl(event: { source_event_id: string | null; external_url: string | null }): string | null {
  if (!event.source_event_id?.startsWith("evt-") || !event.external_url) return null;
  try {
    const url = new URL(event.external_url);
    return url.protocol === "https:" && LUMA_PAGE_HOSTS.has(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch {
    return null;
  }
}
