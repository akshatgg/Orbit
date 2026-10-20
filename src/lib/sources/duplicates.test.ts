import { describe, expect, it } from "vitest";
import { findDuplicates, jaccard, normaliseTitle, pairKey, titleTokens, titlesSimilar, type DuplicateCandidate } from "./duplicates";

describe("title similarity", () => {
  it("normalises case, accents, punctuation and ampersands", () => {
    expect(normaliseTitle("  Café & Careers: Q&A!! ")).toBe("cafe and careers q and a");
  });

  it("computes token Jaccard without stopwords", () => {
    expect([...titleTokens("The Future of Fintech")]).toEqual(["future", "fintech"]);
    expect(jaccard(new Set(["a", "b"]), new Set(["b", "c"]))).toBeCloseTo(1 / 3);
  });

  it("matches near-identical and contained titles", () => {
    expect(titlesSimilar("Case Interview Bootcamp", "case interview bootcamp")).toBe(true);
    expect(titlesSimilar("Case Interview Bootcamp", "Case Interview Bootcamp (Imperial)")).toBe(true);
    expect(titlesSimilar("Sustainability in Strategy: Panel", "Panel: Sustainability in Strategy")).toBe(true);
    expect(titlesSimilar("Founders Friday: Fundraising 101", "Founders Friday – Fundraising")).toBe(true);
  });

  it("doesn't match different events", () => {
    expect(titlesSimilar("Case Interview Bootcamp", "CV Clinic")).toBe(false);
    expect(titlesSimilar("Workshop A", "Workshop B")).toBe(false);
    // Short titles don't count as "contained" (avoids "Talk" matching everything).
    expect(titlesSimilar("Mixer", "Welcome Mixer and Quiz Night")).toBe(false);
  });
});

const ev = (
  id: string,
  title: string,
  starts_at: string,
  source: string,
  created_at = "2026-10-01T00:00:00Z",
  over: Partial<DuplicateCandidate> = {},
): DuplicateCandidate => ({ id, title, starts_at, source, created_at, ...over });

describe("findDuplicates", () => {
  const native = ev("orbit-1", "Case Interview Bootcamp", "2026-10-17T18:00:00Z", "orbit", "2026-10-10T00:00:00Z");

  it("flags the imported copy, never the ORBIT-native original", () => {
    const imported = ev("feed-1", "Case Interview Bootcamp (Imperial)", "2026-10-17T18:15:00Z", "source:abc", "2026-10-01T00:00:00Z");
    expect(findDuplicates([imported, native])).toEqual([{ id: "feed-1", duplicateOf: "orbit-1", exact: false }]);
  });

  it("respects the ±30 minute window", () => {
    expect(findDuplicates([native, ev("feed-1", "Case Interview Bootcamp", "2026-10-17T18:30:00Z", "source:abc")])).toHaveLength(1);
    expect(findDuplicates([native, ev("feed-1", "Case Interview Bootcamp", "2026-10-17T18:31:00Z", "source:abc")])).toHaveLength(0);
  });

  it("between two imports, keeps the older one; CSV beats feeds", () => {
    const older = ev("feed-old", "Run Club", "2026-10-18T09:00:00Z", "source:a", "2026-10-01T00:00:00Z");
    const newer = ev("feed-new", "Run Club", "2026-10-18T09:00:00Z", "source:b", "2026-10-05T00:00:00Z");
    expect(findDuplicates([newer, older])).toEqual([{ id: "feed-new", duplicateOf: "feed-old", exact: false }]);
    const csv = ev("csv-1", "Run Club", "2026-10-18T09:00:00Z", "csv", "2026-10-09T00:00:00Z");
    expect(findDuplicates([newer, older, csv])).toEqual([
      { id: "feed-old", duplicateOf: "csv-1", exact: false },
      { id: "feed-new", duplicateOf: "csv-1", exact: false },
    ]);
  });

  it("auto-matches the same event URL even when the title or time differs", () => {
    const a = ev("a", "Bangalore Home Cooking Meetup", "2026-10-25T10:00:00Z", "source:a", "2026-10-01T00:00:00Z", {
      external_url: "https://www.meetup.com/bangalore-home-cooking-meetup/events/316849144/",
    });
    const b = ev("b", "Bangalore Home Cooking Meetup — November", "2026-10-25T12:00:00Z", "source:b", "2026-10-02T00:00:00Z", {
      external_url: "https://www.meetup.com/bangalore-home-cooking-meetup/events/316849144/",
    });
    expect(findDuplicates([a, b])).toEqual([{ id: "b", duplicateOf: "a", exact: true }]);
  });

  it("auto-matches the same platform event id across sources", () => {
    const a = ev("a", "One title", "2026-10-25T10:00:00Z", "source:a", "2026-10-01T00:00:00Z", {
      source_event_id: "event_316849144@meetup.com",
    });
    const b = ev("b", "Totally different title", "2026-10-25T13:00:00Z", "source:b", "2026-10-02T00:00:00Z", {
      source_event_id: "event_316849144@meetup.com",
    });
    expect(findDuplicates([a, b])).toEqual([{ id: "b", duplicateOf: "a", exact: true }]);
  });

  it("does not collapse a weekly series that reuses the same page", () => {
    const week1 = ev("w1", "Sunday Run Club", "2026-10-18T09:00:00Z", "source:a", "2026-10-01T00:00:00Z", {
      external_url: "https://www.meetup.com/run-club/events/series/",
    });
    const week2 = ev("w2", "Sunday Run Club", "2026-10-25T09:00:00Z", "source:a", "2026-10-01T00:00:00Z", {
      external_url: "https://www.meetup.com/run-club/events/series/",
    });
    expect(findDuplicates([week1, week2])).toEqual([]);
  });

  it("never pairs two ORBIT-native events", () => {
    const other = ev("orbit-2", "Case Interview Bootcamp", "2026-10-17T18:00:00Z", "orbit");
    expect(findDuplicates([native, other])).toEqual([]);
  });

  it("skips pairs an admin marked as not duplicates", () => {
    const imported = ev("feed-1", "Case Interview Bootcamp", "2026-10-17T18:00:00Z", "source:abc");
    expect(findDuplicates([native, imported], { dismissed: new Set([pairKey("feed-1", "orbit-1")]) })).toEqual([]);
  });
});
