// Reads a Luma event page's schema.org Event data (the JSON-LD Luma publishes for search engines).

import { LIMITS, clamp, cleanProse, decodeEntities, orNull, stripHtml } from "./text";

export type LumaPageDetails = {
  coverUrl: string | null;
  description: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string | null;
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

/** Cover, full description and price from a Luma event page, or null when the page has none. */
export function parseLumaEventPage(html: string): LumaPageDetails | null {
  const event = firstEvent(html);
  const images = event ? (Array.isArray(event.image) ? event.image : [event.image]) : [];
  const coverUrl = images.map(safeImage).find((u): u is string => u !== null) ?? ogImage(html);
  const description = orNull(clamp(cleanProse(stripHtml(typeof event?.description === "string" ? event.description : "")), LIMITS.description));
  const price = event ? prices(event.offers) : null;
  if (!coverUrl && !description && !price) return null;
  return {
    coverUrl,
    description,
    priceMin: price?.priceMin ?? null,
    priceMax: price?.priceMax ?? null,
    currency: price?.currency ?? null,
  };
}
