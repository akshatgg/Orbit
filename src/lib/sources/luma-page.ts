// Reads a Luma event page's schema.org Event data (the JSON-LD Luma publishes for search engines),
// plus the host's formatted description from the page's app data.

import { LIMITS, clamp, cleanProse, decodeEntities, oneLine, orNull, safeHttpUrl, stripHtml, summarise } from "./text";
import { addressCountry, firstJsonLdEvent } from "./jsonld";
import { isValidTimezone } from "./timezone";
import { HINT_WEIGHT } from "./interests";
import type { InterestHint, NormalizedEvent } from "./types";

export type LumaPageDetails = {
  coverUrl: string | null;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
  venueName: string | null;
  address: string | null;
  city: string | null;
  /** The address's country as the page gives it ("IN"); normalised when saved. */
  country?: string | null;
  latitude: number | null;
  longitude: number | null;
  /**
   * The flattened JSON-LD description, exactly as imports before formatted descriptions stored
   * it. A stored description equal to this was never edited, so it can be upgraded.
   */
  flatDescription?: string | null;
  interestHints?: InterestHint[];
};

const IMAGE_HOSTS = new Set(["cdn.lu.ma", "images.lumacdn.com"]);

function safeImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && IMAGE_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

type MirrorNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: MirrorNode[];
};

/** The record in the page's __NEXT_DATA__ that holds `description_mirror`. */
function pageData(html: string): Record<string, unknown> | null {
  const raw = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return null;
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return null;
  }
  const find = (value: unknown, depth: number): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || depth > 12) return null;
    const record = value as Record<string, unknown>;
    if ("description_mirror" in record) return record;
    for (const child of Object.values(record)) {
      const found = find(child, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return find(root, 0);
}

const tidy = (s: string) => s.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ");

/**
 * Inline content in the stored description format: `**bold**`, `*italic*`, links as "label (url)".
 * Neighbouring text with the same emphasis is merged first so markers pair up cleanly, and spaces
 * stay outside the markers (RichText only reads `**x**` with no space inside).
 */
function mirrorInline(nodes: MirrorNode[] = [], { plain = false } = {}): string {
  const runs: { text: string; bold: boolean; italic: boolean }[] = [];
  for (const node of nodes) {
    if (node.type === "hard_break") {
      runs.push({ text: "\n", bold: false, italic: false });
      continue;
    }
    if (typeof node.text !== "string") {
      if (node.content) runs.push({ text: mirrorInline(node.content, { plain }), bold: false, italic: false });
      continue;
    }
    const marks = node.marks ?? [];
    const href = marks.find((m) => m.type === "link")?.attrs?.href;
    const link = typeof href === "string" ? safeHttpUrl(href) : null;
    const text = tidy(node.text);
    // "label (url)", with the label's own surrounding spaces kept outside: "Bangalore (url) - Founders".
    const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    const value = link && core && core !== link && core !== href ? `${lead}${core} (${link})${trail}` : text;
    const bold = !plain && marks.some((m) => m.type === "bold" || m.type === "strong");
    const italic = !plain && marks.some((m) => m.type === "italic" || m.type === "em");
    const last = runs[runs.length - 1];
    if (last && last.bold === bold && last.italic === italic && last.text !== "\n") last.text += value;
    else runs.push({ text: value, bold, italic });
  }
  return runs
    .map(({ text, bold, italic }) => {
      const marker = bold ? "**" : italic ? "*" : "";
      if (!marker || !text.trim()) return text;
      const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
      return `${lead}${marker}${core}${marker}${trail}`;
    })
    .join("");
}

/** Block content as stored-description text: blank lines between blocks, `•` / `1.` list lines. */
function mirrorBlocks(nodes: MirrorNode[] = []): string[] {
  const blocks: string[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "heading": {
        const text = mirrorInline(node.content, { plain: true }).replace(/\s+/g, " ").trim();
        if (text) blocks.push(`**${text}**`);
        break;
      }
      case "paragraph": {
        const text = mirrorInline(node.content).replace(/[ \t]+\n/g, "\n").trim();
        if (text) blocks.push(text);
        break;
      }
      case "bullet_list":
      case "ordered_list": {
        const start = Number(node.attrs?.order ?? node.attrs?.start ?? 1);
        const lines = (node.content ?? []).map((item, i) => {
          const text = mirrorBlocks(item.content).join(" ").replace(/\s*\n\s*/g, " ").trim();
          const bullet = node.type === "ordered_list" ? `${(Number.isFinite(start) ? start : 1) + i}.` : "•";
          return text ? `${bullet} ${text}` : "";
        });
        const list = lines.filter(Boolean).join("\n");
        if (list) blocks.push(list);
        break;
      }
      case "horizontal_rule":
        break;
      default:
        // blockquote, list_item and anything new: keep its text.
        blocks.push(...mirrorBlocks(node.content));
    }
  }
  return blocks;
}

/**
 * The host's formatted description (headings, paragraphs, bold, lists) from Luma's page data.
 * The JSON-LD copy flattens all of that into bare lines, so this is preferred when present.
 */
export function lumaMirrorDescription(html: string): string | null {
  const mirror = pageData(html)?.description_mirror as MirrorNode | undefined;
  if (!mirror || typeof mirror !== "object" || mirror.type !== "doc") return null;
  return orNull(clamp(mirrorBlocks(mirror.content).join("\n\n").replace(/\n{3,}/g, "\n\n").trim(), LIMITS.description));
}

/** Luma's own categories for the event ("Tech", "AI"…): set from its content, so strong evidence. */
function lumaHints(html: string): InterestHint[] {
  const categories = pageData(html)?.categories;
  return (Array.isArray(categories) ? categories : [])
    .map((c) => (typeof c?.name === "string" ? c.name : ""))
    .filter(Boolean)
    .map((label) => ({ label, weight: HINT_WEIGHT.eventCategory }));
}

/** The JSON-LD description, cleaned the way every Luma import used to store it. */
function jsonLdDescription(event: Record<string, unknown> | null): string | null {
  return orNull(clamp(cleanProse(stripHtml(typeof event?.description === "string" ? event.description : ""), { keepEmphasis: true }), LIMITS.description));
}

/** Formatted description when the page has one, else the flattened JSON-LD copy. */
function pageDescription(html: string, event: Record<string, unknown> | null): string | null {
  return lumaMirrorDescription(html) ?? jsonLdDescription(event);
}

function ogImage(html: string): string | null {
  const tag = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i)?.[0];
  const content = tag?.match(/content=["']([^"']+)["']/i)?.[1];
  return content ? safeImage(decodeEntities(content)) : null;
}

/** A price range only when every offer has a number and they share one currency. */
function prices(offers: unknown): { priceMin: number; priceMax: number; currency: string } | null {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  if (list.length === 0) return null;
  const values: number[] = [];
  let currency: string | null = null;
  for (const offer of list as Record<string, unknown>[]) {
    const raw = offer?.price;
    const price = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (!Number.isFinite(price) || price < 0) return null;
    const code = typeof offer.priceCurrency === "string" ? offer.priceCurrency.trim().toUpperCase() : "";
    if (!code || (currency && code !== currency)) return null;
    currency = code;
    values.push(price);
  }
  return { priceMin: Math.min(...values), priceMax: Math.max(...values), currency: currency! };
}

/** One Luma event page as an ORBIT event. Used when an admin pastes a single event link. */
export function parseLumaLinkedEvent(html: string, pageUrl: string): NormalizedEvent | null {
  const event = firstJsonLdEvent(html);
  if (!event) return null;

  const title = clamp(oneLine(typeof event.name === "string" ? event.name : ""), LIMITS.title);
  const starts = typeof event.startDate === "string" ? new Date(event.startDate) : null;
  const ends = typeof event.endDate === "string" && event.endDate ? new Date(event.endDate) : null;
  const url = safeHttpUrl(typeof event.url === "string" ? event.url : pageUrl) ?? safeHttpUrl(pageUrl);
  if (title.length < 3 || !starts || Number.isNaN(starts.getTime()) || !url) return null;

  const location = event.location && typeof event.location === "object" ? (event.location as Record<string, unknown>) : null;
  const address = location?.address && typeof location.address === "object" ? (location.address as Record<string, unknown>) : null;
  const geo = (location?.geo && typeof location.geo === "object" ? location.geo : location) as Record<string, unknown> | null;
  const latitude = Number(geo?.latitude);
  const longitude = Number(geo?.longitude);
  const point =
    Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? { latitude, longitude }
      : null;

  const mode = typeof event.eventAttendanceMode === "string" ? event.eventAttendanceMode : "";
  const status = typeof event.eventStatus === "string" ? event.eventStatus : "";
  const description = pageDescription(html, event);
  const timezone = html.match(/"timezone":"([^"]+)"/)?.[1] ?? null;
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? null;
  const apiId = html.match(/"api_id":"(evt-[^"]+)"/)?.[1] ?? null;

  return {
    sourceEventId: apiId ?? (slug ? `link-${slug}` : "link-event"),
    title,
    summary: summarise(description),
    description,
    startsAt: starts.toISOString(),
    endsAt: ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : null,
    allDay: false,
    timezone: timezone && isValidTimezone(timezone) ? timezone : "Europe/London",
    format: mode.includes("Online") ? "online" : mode.includes("Mixed") ? "hybrid" : "in_person",
    venueName: orNull(clamp(oneLine(typeof location?.name === "string" ? location.name : ""), LIMITS.venue)),
    address: orNull(clamp(oneLine(typeof address?.streetAddress === "string" ? address.streetAddress : ""), LIMITS.address)),
    city: orNull(clamp(oneLine(typeof address?.addressLocality === "string" ? address.addressLocality : ""), LIMITS.venue)),
    country: addressCountry(address),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    url,
    cancelled: status.includes("Cancelled"),
    interestHints: lumaHints(html),
    imageUrl: (Array.isArray(event.image) ? event.image : [event.image]).map(safeImage).find((u): u is string => u !== null) ?? ogImage(html),
  };
}

/** Cover, full description and price from a Luma event page, or null when the page has none. */
export function parseLumaEventPage(html: string): LumaPageDetails | null {
  const event = firstJsonLdEvent(html);
  const images = event ? (Array.isArray(event.image) ? event.image : [event.image]) : [];
  const coverUrl = images.map(safeImage).find((u): u is string => u !== null) ?? ogImage(html);
  const description = pageDescription(html, event);
  const price = event ? prices(event.offers) : null;

  const location = event?.location && typeof event.location === "object" ? (event.location as Record<string, unknown>) : null;
  const address = location?.address && typeof location.address === "object" ? (location.address as Record<string, unknown>) : null;
  const geo = (location?.geo && typeof location.geo === "object" ? location.geo : location) as Record<string, unknown> | null;
  const latitude = Number(geo?.latitude);
  const longitude = Number(geo?.longitude);
  const point =
    Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? { latitude, longitude }
      : null;

  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const venueName = orNull(clamp(text(location?.name), LIMITS.venue));
  const street = orNull(clamp(text(address?.streetAddress), LIMITS.address));
  const city = orNull(clamp(text(address?.addressLocality), LIMITS.venue));

  const interestHints = lumaHints(html);
  if (!coverUrl && !description && !price && !venueName && !street && !point && interestHints.length === 0) return null;
  return {
    coverUrl,
    description,
    priceMin: price?.priceMin ?? null,
    priceMax: price?.priceMax ?? null,
    currency: price?.currency ?? null,
    venueName,
    address: street,
    city,
    country: addressCountry(address),
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
    flatDescription: jsonLdDescription(event),
    interestHints,
  };
}
