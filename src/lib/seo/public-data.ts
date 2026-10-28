import "server-only";
import { cacheLife } from "next/cache";
import { api, ApiError } from "@/lib/api/client";

// Public reads for the landing page, sitemap and share images: anonymous calls to the Orbit API,
// cached here so crawlers and link previews don't reach the API on every request.

export type PublicEvent = {
  id: string;
  title: string;
  starts_at: string;
  city: string | null;
  venue_name: string | null;
  format: "in_person" | "online" | "hybrid";
  cover_url: string | null;
  price_min: number | null;
  currency: string | null;
  organiser: { name: string } | null;
};

/** Next published events for the landing page. Cached for 15 minutes. */
export async function listLandingEvents(limit = 6): Promise<PublicEvent[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  try {
    const page = await api.get<{ items: PublicEvent[] }>("/public/landing-events", { query: { limit } });
    return page.items;
  } catch (error) {
    // Without the API (e.g. a build with no backend) the landing page renders without events.
    if (error instanceof ApiError) return [];
    throw error;
  }
}

export type SitemapData = {
  events: { id: string; updated_at: string }[];
  organisers: { slug: string; updated_at: string | null }[];
};

/** Everything the sitemap lists. Cached for an hour. */
export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheLife("hours");
  try {
    return await api.get<SitemapData>("/public/sitemap-data");
  } catch (error) {
    if (error instanceof ApiError) return { events: [], organisers: [] };
    throw error;
  }
}

type OgEvent = {
  id: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  starts_at: string;
  venue_name: string | null;
  city: string | null;
  organiser_name: string | null;
  format: PublicEvent["format"];
  status: string;
};

/** Event fields for generated share images. Cached for an hour. */
export async function getEventForOg(id: string) {
  "use cache";
  cacheLife("hours");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let og: OgEvent;
  try {
    og = await api.get<OgEvent>(`/public/og/events/${id}`);
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
  return {
    id: og.id,
    title: og.title,
    starts_at: og.starts_at,
    city: og.city,
    venue_name: og.venue_name,
    cover_url: og.cover_url,
    format: og.format,
    status: og.status,
    organiser: og.organiser_name ? { name: og.organiser_name } : null,
  };
}
