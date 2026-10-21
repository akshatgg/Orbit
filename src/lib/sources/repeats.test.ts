import { describe, expect, it } from "vitest";
import { groupRepeats } from "./repeats";
import type { NormalizedEvent } from "./types";

const ev = (id: string, title: string, startsAt: string, over: Partial<NormalizedEvent> = {}): NormalizedEvent => ({
  sourceEventId: id, title, summary: null, description: null, startsAt, endsAt: null, allDay: false,
  timezone: "Asia/Kolkata", format: "in_person", venueName: "Sanjay Gandhi National Park", address: null, city: "Mumbai",
  latitude: null, longitude: null, url: null, cancelled: false, ...over,
});

describe("groupRepeats", () => {
  it("groups dates with the same title and place, leaving one-offs alone", () => {
    const out = groupRepeats([
      ev("a", "Cycle, Connect & Grow – Sanjay Gandhi National Park", "2026-10-24T03:30:00Z"),
      ev("b", "Cycle, Connect & Grow – Sanjay Gandhi National Park", "2026-10-26T02:30:00Z"),
      ev("c", "Founders Running Club :: Mumbai", "2026-10-24T02:00:00Z", { venueName: "Marine Drive" }),
      ev("d", "Cycle, Connect & Grow – Sanjay Gandhi National Park", "2026-10-28T02:30:00Z"),
    ], "source:s1");
    const key = "source:s1:cycle connect grow sanjay gandhi national park:sanjay gandhi national park";
    expect(out.map((e) => e.seriesKey ?? null)).toEqual([key, key, null, key]);
  });

  it("keeps a platform series key, and doesn't group the same title at different places", () => {
    const out = groupRepeats([
      ev("a", "Run club", "2026-10-24T02:00:00Z", { seriesKey: "meetup:g:run club" }),
      ev("b", "Run club", "2026-10-25T02:00:00Z", { venueName: "Bandra" }),
      ev("c", "Run club", "2026-10-26T02:00:00Z", { venueName: "Juhu" }),
    ], "source:s1");
    expect(out.map((e) => e.seriesKey ?? null)).toEqual(["meetup:g:run club", null, null]);
  });

  it("treats online dates of the same title as one series", () => {
    const out = groupRepeats([
      ev("a", "Book Club {Online} Meet", "2026-10-24T13:00:00Z", { format: "online", venueName: null }),
      ev("b", "Book Club {Online} Meet", "2026-10-31T13:00:00Z", { format: "online", venueName: null }),
    ], "source:s1");
    expect(out[0].seriesKey).toBe("source:s1:book club online meet:online");
    expect(out[1].seriesKey).toBe(out[0].seriesKey);
  });
});
