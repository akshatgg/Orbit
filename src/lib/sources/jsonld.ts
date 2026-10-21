// The schema.org Event a page publishes as JSON-LD (Luma and Meetup event pages both do).

/** Event and its schema.org subtypes: BusinessEvent, SocialEvent, EducationEvent, Hackathon, Festival… */
function isEventType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && (/Event$/.test(t) || t === "Hackathon" || t === "Festival"));
}

/** The first JSON-LD item on the page that is an event, or null. */
export function firstJsonLdEvent(html: string): Record<string, unknown> | null {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(match[1]);
    } catch {
      continue;
    }
    for (const item of Array.isArray(data) ? data : [data]) {
      if (item && typeof item === "object" && isEventType((item as Record<string, unknown>)["@type"])) {
        return item as Record<string, unknown>;
      }
    }
  }
  return null;
}

/** A schema.org PostalAddress's country: a code ("IN") or a Country object's name. */
export function addressCountry(address: Record<string, unknown> | null | undefined): string | null {
  const value = address?.addressCountry;
  if (typeof value === "string") return value.trim() || null;
  const name = value && typeof value === "object" ? (value as Record<string, unknown>).name : null;
  return typeof name === "string" ? name.trim() || null : null;
}
