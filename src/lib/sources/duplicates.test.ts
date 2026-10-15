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

const ev = (id: string, title: string, starts_at: string, source: string, created_at = "2026-10-01T00:00:00Z"): DuplicateCandidate => ({
  id, title, starts_at, source, created_at,
});

describe("findDuplicates", () => {
  const native = ev("orbit-1", "Case Interview Bootcamp", "2026-10-17T18:00:00Z", "orbit", "2026-10-10T00:00:00Z");

  it("flags the imported copy, never the ORBIT-native original", () => {
    const imported = ev("feed-1", "Case Interview Bootcamp (Imperial)", "2026-10-17T18:15:00Z", "source:abc", "2026-10-01T00:00:00Z");
    expect(findDuplicates([imported, native])).toEqual([{ id: "feed-1", duplicateOf: "orbit-1" }]);
  });

  it("respects the ±30 minute window", () => {
    expect(findDuplicates([native, ev("feed-1", "Case Interview Bootcamp", "2026-10-17T18:30:00Z", "source:abc")])).toHaveLength(1);
    expect(findDuplicates([native, ev("feed-1", "Case Interview Bootcamp", "2026-10-17T18:31:00Z", "source:abc")])).toHaveLength(0);
  });

  it("between two imports, keeps the older one; CSV beats feeds", () => {
    const older = ev("feed-old", "Run Club", "2026-10-18T09:00:00Z", "source:a", "2026-10-01T00:00:00Z");
    const newer = ev("feed-new", "Run Club", "2026-10-18T09:00:00Z", "source:b", "2026-10-05T00:00:00Z");
    expect(findDuplicates([newer, older])).toEqual([{ id: "feed-new", duplicateOf: "feed-old" }]);
    const csv = ev("csv-1", "Run Club", "2026-10-18T09:00:00Z", "csv", "2026-10-09T00:00:00Z");
    expect(findDuplicates([newer, older, csv])).toEqual([
      { id: "feed-old", duplicateOf: "csv-1" },
      { id: "feed-new", duplicateOf: "csv-1" },
    ]);
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
