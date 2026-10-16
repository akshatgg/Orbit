import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/seo/public-data";
import { absoluteUrl } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { events, organisers } = await getSitemapData();
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/login"), changeFrequency: "yearly", priority: 0.3 },
    ...events.map((e) => ({
      url: absoluteUrl(`/events/${e.id}`),
      lastModified: new Date(e.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...organisers.map((o) => ({
      url: absoluteUrl(`/o/${o.slug}`),
      ...(o.updated_at ? { lastModified: new Date(o.updated_at) } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
