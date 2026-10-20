import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "./site";

export type JsonLd = Record<string, unknown>;

/** Serialises JSON-LD for a script tag; `<` is escaped so content can never close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Drops undefined / null / empty values so the output stays valid and compact. */
function clean<T extends JsonLd>(obj: T): T {
  const out: JsonLd = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out as T;
}

export type EventLd = {
  id: string;
  title: string;
  summary: string | null;
  description: string | null;
  cover_url: string | null;
  starts_at: string;
  ends_at: string | null;
  format: string;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  published_at?: string | null;
  external_url?: string | null;
  organiser: { slug: string; name: string } | null;
  /** True when a capacity is set and no places remain. */
  soldOut?: boolean;
};

const iso = (d: string) => new Date(d).toISOString();
const http = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : undefined);

/** Whether the event page should carry Event structured data. */
export function isEventIndexable(status: string) {
  return status === "published" || status === "cancelled";
}

export function buildEventJsonLd(e: EventLd): JsonLd | null {
  if (!isEventIndexable(e.status)) return null;
  const url = absoluteUrl(`/events/${e.id}`);
  const physical = e.format !== "online";
  const online = e.format !== "in_person";

  const place = physical
    ? clean({
        "@type": "Place",
        name: e.venue_name ?? e.city ?? undefined,
        address: clean({
          "@type": "PostalAddress",
          streetAddress: e.address ?? undefined,
          addressLocality: e.city ?? undefined,
          addressCountry: "GB",
        }),
        geo:
          typeof e.latitude === "number" && typeof e.longitude === "number"
            ? { "@type": "GeoCoordinates", latitude: e.latitude, longitude: e.longitude }
            : undefined,
      })
    : null;
  // The real online link is private; point at the public event page instead.
  const virtual = online ? { "@type": "VirtualLocation", url } : null;
  const location = place && virtual ? [place, virtual] : (place ?? virtual);

  const attendance =
    e.format === "online"
      ? "https://schema.org/OnlineEventAttendanceMode"
      : e.format === "hybrid"
        ? "https://schema.org/MixedEventAttendanceMode"
        : "https://schema.org/OfflineEventAttendanceMode";

  const price = e.price_min ?? 0;
  const offers = clean({
    "@type": "Offer",
    url,
    price,
    priceCurrency: e.currency || "GBP",
    availability: e.soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    validFrom: e.published_at ? iso(e.published_at) : undefined,
  });

  const description = (e.summary || e.description || "").replace(/\s+/g, " ").trim().slice(0, 500);

  return clean({
    "@context": "https://schema.org",
    "@type": "Event",
    name: e.title,
    description,
    url,
    startDate: iso(e.starts_at),
    endDate: e.ends_at ? iso(e.ends_at) : undefined,
    eventStatus: e.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: attendance,
    location,
    image: http(e.cover_url) ? [http(e.cover_url)] : undefined,
    organizer: e.organiser
      ? { "@type": "Organization", name: e.organiser.name, url: absoluteUrl(`/o/${e.organiser.slug}`) }
      : undefined,
    offers,
  });
}

export function buildOrganisationJsonLd(o: {
  slug: string;
  name: string;
  logo_url: string | null;
  bio: string | null;
  website: string | null;
}): JsonLd {
  return clean({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: o.name,
    url: absoluteUrl(`/o/${o.slug}`),
    logo: http(o.logo_url),
    description: o.bio ? o.bio.replace(/\s+/g, " ").trim().slice(0, 300) : undefined,
    sameAs: http(o.website) ? [http(o.website)] : undefined,
  });
}

/** WebSite + Organization for the landing page. */
export function buildSiteJsonLd(): JsonLd[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      description: SITE_DESCRIPTION,
      inLanguage: "en-GB",
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: absoluteUrl("/brand/orbit-emblem.png"),
    },
  ];
}
