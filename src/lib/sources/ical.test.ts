import { describe, expect, it } from "vitest";
import { parseIcal } from "./ical";

const NOW = new Date("2026-10-16T12:00:00Z");

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Test//Fixture//EN",
  "X-WR-TIMEZONE:Europe/London",
  "BEGIN:VTIMEZONE",
  "TZID:America/New_York",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0400",
  "TZNAME:EDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0500",
  "TZNAME:EST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  // Floating time with an IANA TZID but no VTIMEZONE → resolved with Intl (BST, UTC+1).
  "BEGIN:VEVENT",
  "UID:talk-1@example.com",
  "DTSTART;TZID=Europe/London:20261020T183000",
  "DTEND;TZID=Europe/London:20261020T200000",
  "SUMMARY:Consulting   Careers Talk",
  "DESCRIPTION:<p>Join us for <b>drinks</b> &amp; networking.</p><p>Second paragraph</p>",
  "LOCATION:Business School Room 220, Exhibition Road, London",
  "URL:https://example.com/events/talk-1",
  "END:VEVENT",
  // VTIMEZONE-defined zone.
  "BEGIN:VEVENT",
  "UID:ny-1@example.com",
  "DTSTART;TZID=America/New_York:20261021T090000",
  "DTEND;TZID=America/New_York:20261021T100000",
  "SUMMARY:New York Alumni Call",
  "LOCATION:https://zoom.us/j/123",
  "END:VEVENT",
  // UTC
  "BEGIN:VEVENT",
  "UID:utc-1@example.com",
  "DTSTART:20261022T080000Z",
  "SUMMARY:Breakfast Briefing",
  "END:VEVENT",
  // All-day, two days (DTEND exclusive), after the clocks change (GMT).
  "BEGIN:VEVENT",
  "UID:fair-1@example.com",
  "DTSTART;VALUE=DATE:20261102",
  "DTEND;VALUE=DATE:20261104",
  "SUMMARY:Careers Fair Week",
  "END:VEVENT",
  // Weekly recurrence with one moved occurrence and one cancelled date.
  "BEGIN:VEVENT",
  "UID:run-club@example.com",
  "DTSTART;TZID=Europe/London:20260906T090000",
  "DTEND;TZID=Europe/London:20260906T100000",
  "RRULE:FREQ=WEEKLY;BYDAY=SU",
  "EXDATE;TZID=Europe/London:20261025T090000",
  "SUMMARY:Sunday Run Club",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:run-club@example.com",
  "RECURRENCE-ID;TZID=Europe/London:20261101T090000",
  "DTSTART;TZID=Europe/London:20261101T110000",
  "DTEND;TZID=Europe/London:20261101T120000",
  "SUMMARY:Sunday Run Club (late start)",
  "END:VEVENT",
  // Past event → dropped.
  "BEGIN:VEVENT",
  "UID:past-1@example.com",
  "DTSTART:20261001T080000Z",
  "DTEND:20261001T090000Z",
  "SUMMARY:Old Event",
  "END:VEVENT",
  // Cancelled upstream.
  "BEGIN:VEVENT",
  "UID:cancelled-1@example.com",
  "DTSTART:20261028T180000Z",
  "SUMMARY:Cancelled Mixer",
  "STATUS:CANCELLED",
  "END:VEVENT",
  // Title too short → reported, not imported.
  "BEGIN:VEVENT",
  "UID:short-1@example.com",
  "DTSTART:20261028T180000Z",
  "SUMMARY:Hi",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const parsed = parseIcal(FEED, { now: NOW });
const byId = (id: string) => parsed.events.find((e) => e.sourceEventId === id);

describe("parseIcal", () => {
  it("resolves TZIDs without a VTIMEZONE using the IANA name", () => {
    const e = byId("talk-1@example.com")!;
    expect(e.startsAt).toBe("2026-10-20T17:30:00.000Z");
    expect(e.endsAt).toBe("2026-10-20T19:00:00.000Z");
    expect(e.timezone).toBe("Europe/London");
  });

  it("uses VTIMEZONE definitions from the feed", () => {
    const e = byId("ny-1@example.com")!;
    expect(e.startsAt).toBe("2026-10-21T13:00:00.000Z");
    expect(e.timezone).toBe("America/New_York");
  });

  it("handles UTC times and missing DTEND", () => {
    const e = byId("utc-1@example.com")!;
    expect(e.startsAt).toBe("2026-10-22T08:00:00.000Z");
    expect(e.endsAt).toBeNull();
  });

  it("handles all-day events in the calendar's zone", () => {
    const e = byId("fair-1@example.com")!;
    expect(e.allDay).toBe(true);
    expect(e.startsAt).toBe("2026-11-02T00:00:00.000Z");
    expect(e.endsAt).toBe("2026-11-03T23:59:00.000Z");
  });

  it("strips HTML, decodes entities and tidies whitespace", () => {
    const e = byId("talk-1@example.com")!;
    expect(e.title).toBe("Consulting Careers Talk");
    expect(e.description).toBe("Join us for drinks & networking.\nSecond paragraph");
    expect(e.summary).toBe("Join us for drinks & networking.");
  });

  it("splits location and keeps the event URL", () => {
    const e = byId("talk-1@example.com")!;
    expect(e.venueName).toBe("Business School Room 220");
    expect(e.address).toBe("Exhibition Road, London");
    expect(e.format).toBe("in_person");
    expect(e.url).toBe("https://example.com/events/talk-1");
  });

  it("never publishes a meeting link as a venue", () => {
    const e = byId("ny-1@example.com")!;
    expect(e.format).toBe("online");
    expect(e.venueName).toBe("Online");
    expect(e.address).toBeNull();
    expect(e.url).toBeNull();
  });

  it("expands recurring events for the next 60 days with stable per-occurrence ids", () => {
    const runs = parsed.events.filter((e) => e.sourceEventId.startsWith("run-club@example.com#"));
    // Sundays from 18 Oct to 13 Dec (60 days from 16 Oct), minus the EXDATE on 25 Oct.
    expect(runs.map((r) => r.sourceEventId)).toEqual([
      "run-club@example.com#20261018T090000",
      "run-club@example.com#20261101T090000",
      "run-club@example.com#20261108T090000",
      "run-club@example.com#20261115T090000",
      "run-club@example.com#20261122T090000",
      "run-club@example.com#20261129T090000",
      "run-club@example.com#20261206T090000",
      "run-club@example.com#20261213T090000",
    ]);
    // BST before 25 Oct, GMT after.
    expect(runs[0].startsAt).toBe("2026-10-18T08:00:00.000Z");
    expect(runs[2].startsAt).toBe("2026-11-08T09:00:00.000Z");
    // The moved occurrence keeps its original id but takes the new time and title.
    const moved = runs[1];
    expect(moved.title).toBe("Sunday Run Club (late start)");
    expect(moved.startsAt).toBe("2026-11-01T11:00:00.000Z");
    // Ids are stable across parses.
    const again = parseIcal(FEED, { now: NOW }).events.filter((e) => e.sourceEventId.startsWith("run-club"));
    expect(again.map((e) => e.sourceEventId)).toEqual(runs.map((e) => e.sourceEventId));
  });

  it("caps occurrences", () => {
    const daily = FEED.replace("RRULE:FREQ=WEEKLY;BYDAY=SU", "RRULE:FREQ=DAILY");
    const runs = parseIcal(daily, { now: NOW, maxOccurrences: 5 }).events.filter((e) => e.sourceEventId.startsWith("run-club"));
    expect(runs).toHaveLength(5);
  });

  it("drops past events, flags cancelled ones and reports bad entries", () => {
    expect(byId("past-1@example.com")).toBeUndefined();
    expect(byId("cancelled-1@example.com")?.cancelled).toBe(true);
    expect(byId("short-1@example.com")).toBeUndefined();
    expect(parsed.errors).toEqual([{ event: "short-1@example.com", message: "Skipped: title is missing or too short" }]);
  });

  it("rejects things that aren't iCal", () => {
    expect(() => parseIcal("<html>nope</html>", { now: NOW })).toThrow(/iCal/);
  });
});
