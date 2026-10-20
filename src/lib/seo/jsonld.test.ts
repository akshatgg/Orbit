import { describe, expect, it } from "vitest";
import { buildEventJsonLd, buildOrganisationJsonLd, buildSiteJsonLd, serializeJsonLd, type EventLd } from "./jsonld";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LD = Record<string, any>;

const base: EventLd = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Careers Fair",
  summary: "Meet employers",
  description: null,
  cover_url: "https://img.test/c.jpg",
  starts_at: "2030-01-01T10:00:00+00:00",
  ends_at: "2030-01-01T12:00:00+00:00",
  format: "in_person",
  venue_name: "Great Hall",
  address: "1 High St",
  city: "Leeds",
  status: "published",
  price_min: null,
  price_max: null,
  currency: "GBP",
  organiser: { slug: "careers", name: "Careers Service" },
};

describe("buildEventJsonLd", () => {
  it("builds an in-person event with free offer", () => {
    const ld = buildEventJsonLd(base) as LD;
    expect(ld["@type"]).toBe("Event");
    expect(ld.startDate).toBe("2030-01-01T10:00:00.000Z");
    expect(ld.eventAttendanceMode).toContain("Offline");
    expect(ld.eventStatus).toContain("EventScheduled");
    expect(ld.location["@type"]).toBe("Place");
    expect(ld.offers.price).toBe(0);
    expect(ld.offers.availability).toContain("InStock");
    expect(ld.organizer.url).toMatch(/\/o\/careers$/);
  });
  it("includes a geo point when the venue has coordinates", () => {
    const ld = buildEventJsonLd({ ...base, latitude: 51.52, longitude: -0.09 }) as LD;
    expect(ld.location.geo).toEqual({ "@type": "GeoCoordinates", latitude: 51.52, longitude: -0.09 });
  });
  it("uses the public page for online events, never a private link", () => {
    const ld = buildEventJsonLd({ ...base, format: "online" }) as LD;
    expect(ld.location["@type"]).toBe("VirtualLocation");
    expect(ld.location.url).toContain(`/events/${base.id}`);
    expect(ld.eventAttendanceMode).toContain("Online");
  });
  it("mixes for hybrid, handles cancelled and sold out", () => {
    const ld = buildEventJsonLd({ ...base, format: "hybrid", status: "cancelled", soldOut: true, price_min: 5 }) as LD;
    expect(ld.eventAttendanceMode).toContain("Mixed");
    expect(Array.isArray(ld.location)).toBe(true);
    expect(ld.eventStatus).toContain("EventCancelled");
    expect(ld.offers.availability).toContain("SoldOut");
    expect(ld.offers.price).toBe(5);
  });
  it("skips non-public statuses", () => {
    expect(buildEventJsonLd({ ...base, status: "draft" })).toBeNull();
    expect(buildEventJsonLd({ ...base, status: "removed" })).toBeNull();
  });
});

describe("other builders", () => {
  it("builds an organisation", () => {
    const ld = buildOrganisationJsonLd({ slug: "x", name: "X", logo_url: null, bio: " hi  there ", website: "https://x.test" }) as LD;
    expect(ld.description).toBe("hi there");
    expect(ld.sameAs).toEqual(["https://x.test"]);
    expect(ld.logo).toBeUndefined();
  });
  it("builds the site graph", () => {
    expect(buildSiteJsonLd().map((n) => n["@type"])).toEqual(["WebSite", "Organization"]);
  });
  it("escapes < when serialising", () => {
    const s = serializeJsonLd({ a: "</script><b>" });
    expect(s).not.toContain("<");
    expect(JSON.parse(s).a).toBe("</script><b>");
  });
});
