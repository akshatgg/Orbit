import { describe, expect, it } from "vitest";
import { lumaCategoryEventsUrl, parseLumaCategoryEvents, parseLumaCategoryPage, parseLumaDiscoverPage } from "./luma-discover";

const nextData = (initialData: unknown) =>
  `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialData } } })}</script></html>`;

describe("parseLumaDiscoverPage", () => {
  it("reads the current discover-place shape", () => {
    const html = nextData({
      kind: "discover-place",
      data: { place: { api_id: "discplace-QCcNk3HXowOR97j", slug: "london", name: "London", timezone: "Europe/London" } },
    });
    expect(parseLumaDiscoverPage(html, "london")).toEqual({
      apiId: "discplace-QCcNk3HXowOR97j",
      slug: "london",
      name: "London",
      timezone: "Europe/London",
      feedUrl: "https://api.lu.ma/ics/get?entity=discover&id=discplace-QCcNk3HXowOR97j",
    });
  });

  it("reads the older places / featured_place shape", () => {
    const html = nextData({
      places: [{ place: { api_id: "discplace-G0tGUVYwl7T17Sb", slug: "bengaluru", timezone: "Asia/Kolkata" } }],
      featured_place: { place: { api_id: "discplace-G0tGUVYwl7T17Sb", slug: "bengaluru", name: "Bengaluru", timezone: "Asia/Kolkata" } },
    });
    expect(parseLumaDiscoverPage(html, "bengaluru")?.feedUrl).toContain("discplace-G0tGUVYwl7T17Sb");
  });

  it("does not import a different city when the slug doesn't match", () => {
    const html = nextData({ data: { place: { api_id: "discplace-london", slug: "london", timezone: "Europe/London" } } });
    expect(parseLumaDiscoverPage(html, "bengaluru")).toBeNull();
  });

  it("returns null for missing, malformed or non-discover pages", () => {
    expect(parseLumaDiscoverPage("<html></html>", "london")).toBeNull();
    expect(parseLumaDiscoverPage('<script id="__NEXT_DATA__">{bad</script>', "london")).toBeNull();
    expect(parseLumaDiscoverPage(nextData({ data: { place: { api_id: "cal-123", slug: "london" } } }), "london")).toBeNull();
  });
});

describe("parseLumaCategoryPage", () => {
  it("reads the category from a category page", () => {
    const html = nextData({ kind: "category", data: { category: { api_id: "cat-tech", slug: "tech", name: "Tech" } } });
    expect(parseLumaCategoryPage(html)).toEqual({ apiId: "cat-tech", slug: "tech", name: "Tech" });
  });

  it("returns null for city pages and anything else", () => {
    expect(parseLumaCategoryPage(nextData({ kind: "discover-place", data: { place: { api_id: "discplace-1" } } }))).toBeNull();
    expect(parseLumaCategoryPage(nextData({ kind: "category", data: { category: { api_id: "cal-1" } } }))).toBeNull();
    expect(parseLumaCategoryPage("<html></html>")).toBeNull();
  });
});

describe("parseLumaCategoryEvents", () => {
  const tech = { apiId: "cat-tech", slug: "tech", name: "Tech" };
  const entry = (event: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    api_id: event.api_id,
    event: {
      start_at: "2026-10-24T04:00:00.000Z",
      end_at: "2026-10-24T07:00:00.000Z",
      timezone: "Asia/Kolkata",
      location_type: "offline",
      cover_url: "https://images.lumacdn.com/uploads/ab/cover.png",
      ...event,
    },
    hosts: [{ name: "BlrDroid" }, { name: "Kotlin Blr" }],
    ticket_info: { is_free: true, price: null },
    ...extra,
  });

  it("maps entries to events, with the place only when Luma shows it", () => {
    const body = JSON.stringify({
      has_more: true,
      next_cursor: "abc",
      entries: [
        entry({
          api_id: "evt-1", name: "BlrDroid October Meetup", url: "1dfd73wq",
          coordinate: { latitude: 12.97, longitude: 77.64 },
          geo_address_info: { mode: "shown", address: "Google Office", short_address: "Bagmane Tech Park", city: "Bengaluru", country_code: "IN" },
        }),
        entry(
          {
            api_id: "evt-2", name: "Founder Pitches", url: "8y557etr",
            coordinate: { latitude: 12.96, longitude: 77.63 },
            geo_address_info: { mode: "obfuscated", city: "Bengaluru", country_code: "IN" },
          },
          { hosts: [{ name: "CEDAT" }, { name: "Asha" }, { name: "Ravi" }, { name: "Meera" }], ticket_info: { is_free: false, price: { cents: 1000, currency: "inr", min_cents: 0, is_flexible: true } } },
        ),
      ],
    });
    const page = parseLumaCategoryEvents(body, tech);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("abc");
    expect(page.errors).toEqual([]);
    expect(page.events[0]).toEqual({
      sourceEventId: "evt-1@events.lu.ma",
      title: "BlrDroid October Meetup",
      summary: "Hosted by BlrDroid & Kotlin Blr",
      description: null,
      startsAt: "2026-10-24T04:00:00.000Z",
      endsAt: "2026-10-24T07:00:00.000Z",
      allDay: false,
      timezone: "Asia/Kolkata",
      format: "in_person",
      venueName: "Google Office",
      address: "Bagmane Tech Park",
      city: "Bengaluru",
      country: "IN",
      latitude: 12.97,
      longitude: 77.64,
      url: "https://luma.com/1dfd73wq",
      cancelled: false,
      interestHints: [{ label: "Tech", weight: 3 }],
      imageUrl: "https://images.lumacdn.com/uploads/ab/cover.png",
      price: { min: 0, max: 0, currency: "GBP" },
    });
    expect(page.events[1]).toMatchObject({
      summary: "Hosted by CEDAT, Asha and 2 others", venueName: null, address: null, city: "Bengaluru", latitude: null, longitude: null,
      price: { min: 0, max: 10, currency: "INR" },
    });
  });

  it("skips entries it can't use and leaves an unknown price unset", () => {
    const body = JSON.stringify({
      has_more: false,
      next_cursor: "abc",
      entries: [
        entry({ api_id: "evt-1", name: "Hi", url: "x1" }),
        entry({ api_id: "evt-2", name: "Startup night", url: "x2", start_at: "soon" }),
        entry({ api_id: "evt-3", name: "Online AI talk", url: "x3", location_type: "online", cover_url: "https://evil.example/x.png" }, {
          hosts: [], ticket_info: { is_free: false, price: null },
        }),
        { api_id: "x" },
      ],
    });
    const page = parseLumaCategoryEvents(body, tech);
    expect(page.hasMore).toBe(false);
    expect(page.events).toHaveLength(1);
    expect(page.events[0]).toMatchObject({ summary: null, format: "online", imageUrl: null, price: null });
    expect(page.errors.map((e) => e.message)).toEqual([
      "Skipped: title is missing or too short",
      "Skipped: invalid start date",
      "Skipped: Luma entry without an event id",
    ]);
  });

  it("throws on a response that isn't an event list", () => {
    expect(() => parseLumaCategoryEvents(JSON.stringify({ message: "Not found" }), tech)).toThrow();
  });

  it("asks Luma for one city's events in the category", () => {
    const url = new URL(lumaCategoryEventsUrl("cat-tech", "discplace-1", "next"));
    expect(url.origin + url.pathname).toBe("https://api.lu.ma/discover/get-paginated-events");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      discover_category_api_id: "cat-tech", discover_place_api_id: "discplace-1", pagination_limit: "50", pagination_cursor: "next",
    });
  });
});
