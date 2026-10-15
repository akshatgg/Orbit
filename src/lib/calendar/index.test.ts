import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from ".";

const ev = { id: "e1", title: "Case, Bootcamp; Night", starts_at: "2026-10-18T17:00:00Z", location: "Room 220" };

describe("calendar", () => {
  it("builds a valid ics with escaped text and a default 1h end", () => {
    const ics = buildIcs([ev], new Date("2026-10-16T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261018T170000Z");
    expect(ics).toContain("DTEND:20261018T180000Z");
    expect(ics).toContain(String.raw`SUMMARY:Case\, Bootcamp\; Night`);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
  it("builds a google link", () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.searchParams.get("dates")).toBe("20261018T170000Z/20261018T180000Z");
  });
});
