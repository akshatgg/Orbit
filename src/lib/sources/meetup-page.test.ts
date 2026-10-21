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
      coverUrl: null,
    });
  });

  it("reads the event photo at full size, falling back to og:image", () => {
    const og = '<meta property="og:image" content="https://secure.meetupstatic.com/photos/event/5/2/c/2/600_536061186.jpeg"/>';
    const featured =
      '"featuredEventPhoto":{"__typename":"PhotoInfo","id":"536061186","source":"https://secure.meetupstatic.com/photos/event/5/2/c/2/highres_536061186.jpeg","baseUrl":"https://secure-content.meetupstatic.com/images/classic-events/"}';
    expect(parseMeetupEventPage(`<head>${og}</head><script>${featured}</script>`)?.coverUrl).toBe(
      "https://secure.meetupstatic.com/photos/event/5/2/c/2/highres_536061186.jpeg",
    );
    expect(parseMeetupEventPage(fixture.replace("</head>", `${og}</head>`))).toMatchObject({
      venueName: "Codurance",
      coverUrl: "https://secure.meetupstatic.com/photos/event/5/2/c/2/600_536061186.jpeg",
    });
  });

  it("ignores images that aren't on Meetup's image hosts", () => {
    const og = '<meta property="og:image" content="https://evil.example/x.jpg"/>';
    expect(parseMeetupEventPage(fixture.replace("</head>", `${og}</head>`))?.coverUrl).toBeNull();
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

  it("takes the full description from the page data, not the cut-off JSON-LD copy (real page)", () => {
    const full = readFileSync(fileURLToPath(new URL("./__fixtures__/meetup-event-full.html", import.meta.url)), "utf8");
    const description = parseMeetupLinkedEvent(full, "https://www.meetup.com/chennai-artificial-intelligence-meetup-group/events/316428279/")!.description!;
    expect(description.length).toBeGreaterThan(3000);
    expect(description).toContain("**Please note that only those who complete the payment through Luma would be considered as confirmed registrations.**");
    expect(description).toContain("Steps:\n1. Choose the workshop cohort for your preferred date on the Luma calendar.\n2. Complete registration and payment.");
    expect(description).toContain("**Workshop Details:**\n\n• **Date:** **New Cohort every Tuesday**\n• **Time:** 12:30 pm - 2:30 pm IST");
    expect(description).toContain("**Santosh Rout** - is the founder of navan.ai (https://navan.ai/)");
  });

  it("reads events Meetup files as a schema.org subtype (BusinessEvent), with cover and no placeholder venue (real page)", () => {
    const html = readFileSync(fileURLToPath(new URL("./__fixtures__/meetup-business-event.html", import.meta.url)), "utf8");
    const url = "https://www.meetup.com/mohali-business-networking-community/events/316894987/";
    expect(parseMeetupLinkedEvent(html, url)).toMatchObject({
      sourceEventId: "event_316894987@meetup.com",
      title: "Business Networking & Referral Meetup ( 5 PM )",
      startsAt: "2026-10-28T11:30:00.000Z",
      format: "online",
      venueName: null,
      latitude: null,
      longitude: null,
    });
    expect(parseMeetupLinkedEvent(html, url)?.description).toContain("This is an **online meetup** designed for business owners");
    expect(parseMeetupEventPage(html)).toEqual({
      venueName: null, address: null, city: null, latitude: null, longitude: null,
      coverUrl: "https://secure.meetupstatic.com/photos/event/d/e/5/6/highres_533996918.jpeg",
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
