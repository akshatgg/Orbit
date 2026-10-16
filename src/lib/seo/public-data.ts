import "server-only";
import { cacheLife } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/** Cookie-less client with the publishable key, so RLS applies exactly as for a signed-out visitor. */
function anon() {
  // Without keys (e.g. a build with no env) behave like an empty database instead of crashing.
  if (!isSupabaseConfigured) return createClient("http://127.0.0.1:1", "unconfigured");
  return createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

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
  const nowIso = new Date().toISOString();
  const { data } = await anon()
    .from("events")
    .select("id, title, starts_at, city, venue_name, format, cover_url, price_min, currency, organiser:organisers ( name )")
    .eq("status", "published")
    .is("duplicate_of", null)
    .or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})`)
    .order("starts_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as PublicEvent[];
}

export type SitemapData = {
  events: { id: string; updated_at: string }[];
  organisers: { slug: string; updated_at: string | null }[];
};

/** Everything the sitemap lists. Cached for an hour. */
export async function getSitemapData(): Promise<SitemapData> {
  "use cache";
  cacheLife("hours");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const db = anon();
  const [events, organisers] = await Promise.all([
    db.from("events").select("id, updated_at").eq("status", "published").is("duplicate_of", null)
      .gte("starts_at", since).order("starts_at", { ascending: true }).limit(5000),
    db.from("organisers").select("slug, updated_at").eq("status", "approved").limit(5000),
  ]);
  return {
    events: (events.data ?? []) as SitemapData["events"],
    organisers: (organisers.data ?? []) as SitemapData["organisers"],
  };
}

/** Event fields for generated share images. Cached for an hour. */
export async function getEventForOg(id: string) {
  "use cache";
  cacheLife("hours");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await anon()
    .from("events")
    .select("id, title, starts_at, city, venue_name, format, cover_url, status, organiser:organisers ( name )")
    .eq("id", id)
    .in("status", ["published", "cancelled"])
    .maybeSingle();
  return data as unknown as (Omit<PublicEvent, "price_min" | "currency"> & { status: string }) | null;
}
