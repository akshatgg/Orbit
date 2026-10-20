import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseIcal } from "./ical";
import { cleanEvent, lumaPageUrl, resolveFeedUrl } from "./platforms";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8");

describe("resolveFeedUrl — meetup", () => {
  it.each([
    "https://www.meetup.com/pydata-london-meetup/",
    "https://www.meetup.com/pydata-london-meetup",
    "meetup.com/pydata-london-meetup",
    "www.meetup.com/pydata-london-meetup/events/",
    "https://www.meetup.com/pydata-london-meetup/events/ical/",
    "https://www.meetup.com/en-AU/pydata-london-meetup/",
  ])("turns %s into the group's iCal feed", (input) => {
    expect(resolveFeedUrl("meetup", input)).toEqual({ ok: true, url: "https://www.meetup.com/pydata-london-meetup/events/ical/" });
  });

  it.each(["https://lu.ma/abc", "https://www.meetup.com/", "https://www.meetup.com/find/?location=london", "not a url at all"])(
    "rejects %s",
    (input) => {
      expect(resolveFeedUrl("meetup", input).ok).toBe(false);
    },
  );
});

describe("resolveFeedUrl — luma", () => {
  it("accepts the Subscribe → iCal link and turns webcal into https", () => {
    expect(resolveFeedUrl("luma", "webcal://api.lu.ma/ics/get?entity=calendar&id=cal-7iVMZ4JmmJwQtYl")).toEqual({
      ok: true,
      url: "https://api.lu.ma/ics/get?entity=calendar&id=cal-7iVMZ4JmmJwQtYl",
    });
    expect(resolveFeedUrl("luma", "https://api.luma.com/ics/get?entity=calendar&id=cal-x")).toEqual({
      ok: true,
      url: "https://api.luma.com/ics/get?entity=calendar&id=cal-x",
    });
  });

  it("rejects a calendar page with a hint to paste the iCal link", () => {
    const result = resolveFeedUrl("luma", "https://lu.ma/dwebyvr");
    expect(result).toEqual({ ok: false, error: "That's a Luma page, not its feed. Paste the calendar's Subscribe → iCal link instead." });
  });

  it("rejects other hosts", () => {
    expect(resolveFeedUrl("luma", "https://evil.example.com/ics/get?id=1").ok).toBe(false);
  });
});

describe("resolveFeedUrl — ical", () => {
  it("keeps today's behaviour", () => {
    expect(resolveFeedUrl("ical", "webcal://calendar.example.com/a.ics")).toEqual({ ok: true, url: "https://calendar.example.com/a.ics" });
    expect(resolveFeedUrl("ical", "ftp://calendar.example.com/a.ics").ok).toBe(false);
  });
});

describe("cleanEvent — luma feed fixture", () => {
  it("takes the event link from the stub, sets 'Hosted by' as summary and drops the stub", () => {
    const { events } = parseIcal(fixture("luma-calendar.ics"), { now: new Date("2026-10-20T00:00:00Z") });
    expect(events).toHaveLength(1);
    const event = cleanEvent("luma", events[0]);
    expect(event).toMatchObject({
      sourceEventId: "evt-q9Djl0hCCeyuDPT@events.lu.ma",
      title: "Open By Design: Tools for Participation - An Evening with Internet Archive Canada",
      url: "https://luma.com/58wdnop2",
      summary: "Hosted by Andrea Mills",
      description: null,
      venueName: "330 W Pender St",
      format: "in_person",
    });
  });

  it("handles external calendar entries (calev-) and all-day events", () => {
    const { events } = parseIcal(fixture("luma-calendar.ics"), { now: new Date("2023-01-01T00:00:00Z") });
    const byId = new Map(events.map((e) => [e.sourceEventId, cleanEvent("luma", e)]));
    expect(byId.get("calev-Nf58gy9UbnWjXJF@events.lu.ma")).toMatchObject({
      url: "https://luma.com/dwebyvr",
      summary: null,
      description: null,
      format: "online",
    });
    expect(byId.get("evt-h2KaQ3yMes8pjKz@events.lu.ma")).toMatchObject({
      allDay: true,
      url: "https://luma.com/ko0jlg5x",
      summary: "Hosted by Kenta Otani",
    });
  });

  it("leaves other kinds untouched", () => {
    const { events } = parseIcal(fixture("luma-calendar.ics"), { now: new Date("2026-10-20T00:00:00Z") });
    expect(cleanEvent("meetup", events[0])).toBe(events[0]);
    expect(cleanEvent("ical", events[0])).toBe(events[0]);
  });
});

describe("meetup feed fixture", () => {
  const parse = () => parseIcal(fixture("meetup-group.ics"), { now: new Date("2026-10-20T00:00:00Z") });

  it("parses real group feeds into events with Meetup event links", () => {
    const { events, errors } = parse();
    expect(errors).toEqual([]);
    expect(events).toHaveLength(2);
    for (const e of events) {
      const event = cleanEvent("meetup", e);
      expect(event).toBe(e);
      expect(event.url).toMatch(/^https:\/\/www\.meetup\.com\/[A-Za-z0-9-]+\/events\/\d+\/?$/);
      expect(event.sourceEventId).toMatch(/^event_\d+@meetup\.com$/);
    }
  });

  it("keeps the London time zone and details of the Software Craftsmanship event", () => {
    const { events } = parse();
    const event = cleanEvent("meetup", events.find((e) => e.title === "The Hottest New Programming Language is Ubiquitous")!);
    expect(event).toMatchObject({ timezone: "Europe/London", startsAt: "2026-11-19T18:00:00.000Z" });
    expect(event.description).toContain("Hemal Varambhia");
  });
});

describe("lumaPageUrl", () => {
  it("only gives a page for evt- events on luma hosts", () => {
    expect(lumaPageUrl({ source_event_id: "evt-q9Djl0hCCeyuDPT@events.lu.ma", external_url: "https://luma.com/58wdnop2" })).toBe("https://luma.com/58wdnop2");
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: "https://lu.ma/abc" })).toBe("https://lu.ma/abc");
    expect(lumaPageUrl({ source_event_id: "calev-x@events.lu.ma", external_url: "https://luma.com/dwebyvr" })).toBeNull();
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: "https://evil.example.com/abc" })).toBeNull();
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: "http://luma.com/abc" })).toBeNull();
    expect(lumaPageUrl({ source_event_id: "evt-a@events.lu.ma", external_url: null })).toBeNull();
  });
});
