import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fatsomaEventsUrl, parseFatsomaCityPage, parseFatsomaEvents, parseFatsomaPageLookup } from "./fatsoma";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");
const NOW = new Date("2026-10-22T03:00:00Z");

describe("Fatsoma lookups", () => {
  it("reads the search coordinates a city page uses", () => {
    expect(parseFatsomaCityPage(fixture("fatsoma-city.html"))).toEqual([51.5074456, -0.1277653]);
    expect(parseFatsomaCityPage("<html>no list here</html>")).toBeNull();
  });

  it("finds the organiser page id from its vanity name", () => {
    expect(parseFatsomaPageLookup(fixture("fatsoma-page.json"))).toBe("78e9cbee-fbc6-4d10-93cd-32ebd31f7927");
    expect(parseFatsomaPageLookup('{"data":[]}')).toBeNull();
    expect(parseFatsomaPageLookup("nope")).toBeNull();
  });

  it("asks for active events starting from now, soonest first, with their venue, organiser and categories", () => {
    const url = new URL(fatsomaEventsUrl({ latLon: [51.5074456, -0.1277653] }, 2, NOW));
    expect(url.origin + url.pathname).toBe("https://api.fatsoma.com/v1/events");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "filter[location.lat-lon]": "51.5074456,-0.1277653",
      "filter[status]": "active",
      "filter[starts-at][gte]": "2026-10-22T03:00:00",
      include: "location,page,categories",
      sort: "starts-at,id",
      "page[size]": "50",
      "page[number]": "2",
    });
    expect(fatsomaEventsUrl({ pageId: "78e9cbee-fbc6-4d10-93cd-32ebd31f7927" }, 1, NOW)).toContain("filter%5Bpage.id%5D=78e9cbee");
    expect(fatsomaEventsUrl({ vanity: "mhrxdx1i" }, 1, NOW)).toContain("filter%5Bvanity-name%5D=mhrxdx1i");
  });
});

describe("parseFatsomaEvents", () => {
  const result = parseFatsomaEvents(fixture("fatsoma-events.json"))!;
  const [cambridge, belfast, halloween] = result.events;

  it("maps every event", () => {
    expect(result.errors).toEqual([]);
    expect(result.total).toBe(3);
    expect(result.events.map((e) => e.sourceEventId)).toEqual([
      "fatsoma-af4ec54e-cf82-4ae7-8410-f40d0d7977e5",
      "fatsoma-e28ff172-ee23-4fa3-b400-844d559ddddf",
      "fatsoma-2ede4cdd-5e52-4250-af87-f63d73183bc5",
    ]);
  });

  it("reads times, venue, coordinates and the event page", () => {
    expect(cambridge).toMatchObject({
      title: "Space Safari Drone Light Show - Cambridge",
      startsAt: "2026-10-24T14:00:00.000Z",
      endsAt: "2026-10-24T19:00:00.000Z",
      timezone: "Europe/London",
      format: "in_person",
      venueName: "Newmarket Rowley Mile Course",
      address: "Rowley Mile Racecourse, Cambridge Road, Newmarket CB8 0TF, UK",
      city: "Newmarket",
      latitude: 52.2380347,
      longitude: 0.3748907,
      url: "https://www.fatsoma.com/e/mhrxdx1i/space-safari-drone-light-show-cambridge",
      cancelled: false,
    });
    expect(belfast.city).toBe("Lisburn");
  });

  it("turns pence into pounds", () => {
    expect(cambridge.price).toEqual({ min: 0, max: 65, currency: "GBP" });
    expect(halloween.price).toEqual({ min: 19.99, max: 29.99, currency: "GBP" });
  });

  it("keeps the full-size cover and Fatsoma's categories", () => {
    expect(cambridge.imageUrl).toMatch(/^https:\/\/cdn2\.fatsoma\.com\/media\//);
    expect(cambridge.interestHints).toEqual([{ label: "Fun Things", weight: 3 }]);
    expect(halloween.interestHints).toEqual([{ label: "Club Nights", weight: 3 }]);
  });

  it("turns the HTML description into formatted text", () => {
    expect(cambridge.description).toContain("Experience a spectacular drone light show");
    expect(cambridge.description).toContain("**Important Venue Information**");
    expect(cambridge.description).not.toMatch(/<|cdn2\.fatsoma/);
    expect(cambridge.summary!.length).toBeLessThanOrEqual(200);
  });

  it("imports postponed events, flags cancelled ones, and skips rows it can't use", () => {
    expect(halloween.cancelled).toBe(false);
    const raw = JSON.stringify({
      data: [
        { type: "events", id: "00000000-0000-4000-8000-000000000001", attributes: { name: "Gone", "vanity-name": "abc", "starts-at": "2026-11-01T20:00:00Z", health: "cancelled" } },
        { type: "events", id: "00000000-0000-4000-8000-000000000002", attributes: { name: "No date", "vanity-name": "abd" } },
        { type: "events", id: "not-a-uuid", attributes: { name: "Bad id" } },
        { type: "pages", id: "00000000-0000-4000-8000-000000000003", attributes: {} },
      ],
    });
    const parsed = parseFatsomaEvents(raw)!;
    expect(parsed.events.map((e) => [e.title, e.cancelled, e.price, e.imageUrl, e.venueName])).toEqual([["Gone", true, null, null, null]]);
    expect(parsed.errors.map((e) => e.message)).toEqual(["Skipped: no start time.", "Skipped a Fatsoma event without an id."]);
    expect(parseFatsomaEvents("{}")).toBeNull();
  });
});
