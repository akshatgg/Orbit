import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  eventDetailsUrl, eventbriteIdOf, searchPageUrl, organizerEventsUrl, parseEventbriteDescription, parseEventbriteEvents,
  parseEventbriteSearchPage, parseOrganizerEvents,
} from "./eventbrite";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

describe("Eventbrite listings", () => {
  it("reads event ids from a search page's JSON-LD list", () => {
    expect(parseEventbriteSearchPage(fixture("eventbrite-search.html"))).toEqual(["1983164153368", "1989612185606", "1998897627613"]);
    expect(parseEventbriteSearchPage("<html></html>")).toEqual([]);
  });

  it("reads an organiser's event ids and the cursor for the next page", () => {
    expect(parseOrganizerEvents(fixture("eventbrite-organizer.json"))).toEqual({
      ids: ["1415351557609", "1979855212236", "1979855522163"],
      continuation: "eyJwYWdlIjogMn0",
    });
    expect(parseOrganizerEvents('{"events":[],"pagination":{"has_more_items":false,"continuation":"x"}}')).toEqual({ ids: [], continuation: null });
    expect(parseOrganizerEvents("not json")).toBeNull();
  });

  it("builds the API links on the UK host", () => {
    expect(organizerEventsUrl("78436165503", null)).toBe(
      "https://www.eventbrite.co.uk/api/v3/organizers/78436165503/events/?status=live&order_by=start_asc",
    );
    expect(organizerEventsUrl("1", "eyJ")).toContain("&continuation=eyJ");
    expect(eventDetailsUrl(["1", "2"])).toContain("/api/v3/destination/events/?event_ids=1%2C2&expand=");
  });

  it("asks for each search page by number, page 1 included", () => {
    expect(searchPageUrl("https://www.eventbrite.co.uk/d/united-kingdom--london/music--events/", 1)).toBe(
      "https://www.eventbrite.co.uk/d/united-kingdom--london/music--events/?page=1",
    );
    expect(searchPageUrl("https://www.eventbrite.co.uk/d/united-kingdom--london/events/?page=4&q=x", 2)).toBe(
      "https://www.eventbrite.co.uk/d/united-kingdom--london/events/?page=2&q=x",
    );
  });

  it("only takes its own ids back out of a source event id", () => {
    expect(eventbriteIdOf("eventbrite-1983164153368")).toBe("1983164153368");
    expect(eventbriteIdOf("fatsoma-1983164153368")).toBeNull();
    expect(eventbriteIdOf("eventbrite-../x")).toBeNull();
  });
});

describe("parseEventbriteEvents", () => {
  const { events, errors } = parseEventbriteEvents(fixture("eventbrite-destination.json"))!;
  const [camp, synthony, webinar] = events;

  it("maps every event in the response", () => {
    expect(errors).toEqual([]);
    expect(events.map((e) => e.sourceEventId)).toEqual(["eventbrite-1983164153368", "eventbrite-1989612185606", "eventbrite-2002231587577"]);
  });

  it("turns local time + zone into UTC, with venue, coordinates and the event link", () => {
    expect(camp).toMatchObject({
      title: "Global Camp Meeting London",
      startsAt: "2026-10-23T09:00:00.000Z", // 10:00 BST
      endsAt: "2026-10-25T20:00:00.000Z", // 20:00 GMT, after the clocks go back
      timezone: "Europe/London",
      format: "in_person",
      venueName: "Gaumont State Cinema",
      address: "197-199 Kilburn High Road",
      city: "London",
      latitude: 51.5412085,
      longitude: -0.1979899,
      url: "https://www.eventbrite.com/e/global-camp-meeting-london-tickets-1983164153368",
      cancelled: false,
      seriesKey: null,
    });
  });

  it("uses the summary as the first description, and the full-size image as given", () => {
    expect(camp.summary).toBe("Get ready to gather in London for the Global Camp Meeting, a time to pray, worship, and be sent.");
    expect(camp.description).toBe(camp.summary);
    expect(camp.imageUrl).toMatch(/^https:\/\/img\.evbuc\.com\/https%3A%2F%2Fcdn\.evbuc\.com%2Fimages%2F1177620042%2F.*original.*&s=/);
  });

  it("reads the price range in the ticket currency", () => {
    expect(camp.price).toEqual({ min: 0, max: 0, currency: "GBP" });
    expect(synthony.price).toMatchObject({ currency: "GBP" });
    expect(synthony.price!.max).toBeGreaterThan(synthony.price!.min);
    expect(webinar.price).toEqual({ min: 0, max: 11.68, currency: "EUR" });
  });

  it("drops the venue of online events", () => {
    expect(webinar).toMatchObject({ format: "online", venueName: null, address: null, latitude: null });
  });

  it("passes Eventbrite's category, subcategory and format as interest hints", () => {
    expect(camp.interestHints).toEqual([
      { label: "Christianity", weight: 2 },
      { label: "Religion & Spirituality", weight: 3 },
      { label: "Conference", weight: 1 },
    ]);
  });

  it("skips protected events and reports rows it can't use", () => {
    const raw = JSON.stringify({
      events: [
        { id: "1000000001", name: "Secret", is_protected_event: true, start_date: "2026-11-01", start_time: "10:00", timezone: "Europe/London" },
        { id: "1000000002", name: "No start", timezone: "Europe/London" },
        { id: "1000000003", name: "Cancelled gig", is_cancelled: true, start_date: "2026-11-01", start_time: "19:30", timezone: "Nowhere/Bad" },
      ],
    });
    const result = parseEventbriteEvents(raw)!;
    expect(result.events.map((e) => [e.sourceEventId, e.cancelled, e.timezone, e.startsAt])).toEqual([
      ["eventbrite-1000000003", true, "Europe/London", "2026-11-01T19:30:00.000Z"],
    ]);
    expect(result.errors).toEqual([{ event: "eventbrite-1000000002", message: "Skipped: no start time." }]);
    expect(parseEventbriteEvents("{}")).toBeNull();
  });
});

describe("parseEventbriteDescription", () => {
  it("keeps the organiser's formatting from the text modules", () => {
    const description = parseEventbriteDescription(fixture("eventbrite-structured.json"))!;
    expect(description.startsWith("The **Global Camp Meeting London** is a three-day gathering")).toBe(true);
    expect(description).toContain("\n\n**Theme:** SENT (John 20:21)\n\n");
    expect(description).not.toMatch(/<|img\.evbuc/);
  });

  it("returns null without text modules", () => {
    expect(parseEventbriteDescription('{"modules":[{"type":"image","data":{}}]}')).toBeNull();
    expect(parseEventbriteDescription("nope")).toBeNull();
  });
});
