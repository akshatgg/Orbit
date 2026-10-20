import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseMeetupEventPage, parseMeetupLinkedEvent } from "./meetup-page";
import { meetupPageUrl } from "./platforms";

const fixture = readFileSync(fileURLToPath(new URL("./__fixtures__/meetup-event.html", import.meta.url)), "utf8");

describe("parseMeetupEventPage", () => {
  it("reads the venue, clean street address, city and coordinates", () => {
    expect(parseMeetupEventPage(fixture)).toEqual({
      venueName: "Codurance",
      address: "3 Sutton Lane",
      city: "London",
      latitude: 51.522907,
      longitude: -0.101072,
    });
  });

  it("returns null when the page has no location", () => {
    expect(parseMeetupEventPage("<html><body>No event here</body></html>")).toBeNull();
  });

  it("ignores malformed JSON-LD and falls back to the venue data", () => {
    const html = fixture.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      '<script type="application/ld+json">{not json}</script>',
    );
    expect(parseMeetupEventPage(html)).toMatchObject({ venueName: "Codurance", latitude: 51.522907 });
  });
});

describe("parseMeetupLinkedEvent", () => {
  it("turns a single event page into an ORBIT event", () => {
    expect(parseMeetupLinkedEvent(fixture, "https://www.meetup.com/london-software-craftsmanship/events/317008447/")).toMatchObject({
      sourceEventId: "event_317008447@meetup.com",
      title: "The Hottest New Programming Language is Ubiquitous",
      startsAt: "2026-11-19T18:00:00.000Z",
      endsAt: "2026-11-19T20:00:00.000Z",
      timezone: "Europe/London",
      format: "in_person",
      venueName: "Codurance",
      address: "3 Sutton Lane",
      latitude: 51.522907,
      longitude: -0.101072,
      url: "https://www.meetup.com/london-software-craftsmanship/events/317008447/",
      cancelled: false,
    });
  });

  it("returns null without event JSON-LD", () => {
    expect(parseMeetupLinkedEvent("<html></html>", "https://www.meetup.com/a/events/1/")).toBeNull();
  });
});

describe("meetupPageUrl", () => {
  it("only gives an event page on meetup.com", () => {
    expect(meetupPageUrl({ source_event_id: "event_1@meetup.com", external_url: "https://www.meetup.com/london-software-craftsmanship/events/317008447/" })).toBe(
      "https://www.meetup.com/london-software-craftsmanship/events/317008447/",
    );
    expect(meetupPageUrl({ source_event_id: null, external_url: "https://meetup.com/a-group/events/123" })).toBe("https://meetup.com/a-group/events/123");
    expect(meetupPageUrl({ source_event_id: null, external_url: "https://www.meetup.com/a-group/" })).toBeNull();
    expect(meetupPageUrl({ source_event_id: null, external_url: "https://evil.example.com/a/events/123" })).toBeNull();
    expect(meetupPageUrl({ source_event_id: null, external_url: "http://www.meetup.com/a/events/123" })).toBeNull();
  });
});
