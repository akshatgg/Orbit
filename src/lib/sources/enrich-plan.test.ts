import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS, PAGE_WORST_CASE_MS, detailsPatch, hasTimeFor, hintedTags, importedDescription, isBlockedStatus,
  pickEventsToEnrich, type EnrichCandidate,
} from "./enrich-plan";
import type { SourceEventDetails } from "./types";

const NOW = new Date("2026-10-20T03:00:00Z");

const event = (id: string, over: Partial<EnrichCandidate> = {}): EnrichCandidate => ({
  id,
  source_event_id: `evt-${id}@events.lu.ma`,
  external_url: `https://luma.com/${id}`,
  starts_at: "2026-10-28T18:00:00+00:00",
  created_at: "2026-10-19T03:00:00+00:00",
  cover_url: null,
  description: null,
  price_min: null,
  ...over,
});

const row = (id: string, over: Partial<SourceEventDetails> = {}): [string, SourceEventDetails] => [
  id,
  { event_id: id, status: "failed", attempts: 1, last_error: "x", fetched_at: "2026-10-18T03:00:00+00:00", ...over },
];

describe("pickEventsToEnrich", () => {
  it("picks upcoming Luma event pages that were never read", () => {
    const picked = pickEventsToEnrich(
      [event("a"), event("past", { starts_at: "2026-10-01T18:00:00+00:00" }), event("calev", { source_event_id: "calev-x@events.lu.ma" })],
      new Map(),
      NOW,
    );
    expect(picked.map((e) => e.id)).toEqual(["a"]);
  });

  it("retries failed rows after a day, up to the attempt limit, and never ok/blocked rows", () => {
    const details = new Map([
      row("old-fail"),
      row("fresh-fail", { fetched_at: "2026-10-20T01:00:00+00:00" }),
      row("too-many", { attempts: MAX_ATTEMPTS }),
      row("done", { status: "ok" }),
      row("blocked", { status: "blocked" }),
    ]);
    const picked = pickEventsToEnrich(["old-fail", "fresh-fail", "too-many", "done", "blocked"].map((id) => event(id)), details, NOW);
    expect(picked.map((e) => e.id)).toEqual(["old-fail"]);
  });

  it("takes the newest first, up to the limit", () => {
    const events = Array.from({ length: 30 }, (_, i) => event(`e${i}`, { created_at: `2026-10-${String(i % 28 + 1).padStart(2, "0")}T00:00:00+00:00` }));
    const picked = pickEventsToEnrich(events, new Map(), NOW, 25);
    expect(picked).toHaveLength(25);
    expect(picked[0].created_at >= picked[24].created_at).toBe(true);
  });
});

describe("isBlockedStatus", () => {
  it("treats 403, 429 and 503 as blocking", () => {
    expect([403, 429, 503].every(isBlockedStatus)).toBe(true);
    expect([404, 500].some(isBlockedStatus)).toBe(false);
  });
});

describe("detailsPatch", () => {
  const page = {
    coverUrl: "https://cdn.lu.ma/x", description: "Full text", priceMin: 0, priceMax: 10, currency: "GBP",
    venueName: null, address: null, city: null, latitude: null, longitude: null,
  };

  it("fills empty fields", () => {
    expect(detailsPatch(event("a"), page, "https://res.cloudinary.com/demo/image/upload/x.jpg")).toEqual({
      cover_url: "https://res.cloudinary.com/demo/image/upload/x.jpg",
      description: "Full text",
      price_min: 0,
      price_max: 10,
      currency: "GBP",
    });
  });

  it("never overwrites what an admin set", () => {
    const current = event("a", { cover_url: "https://res.cloudinary.com/mine.jpg", description: "Mine", price_min: 5 });
    expect(detailsPatch(current, page, "https://res.cloudinary.com/other.jpg")).toEqual({});
  });

  it("upgrades a description that is still exactly the old flattened import", () => {
    const formatted = "**Agenda**\n\n• Founder demos\n\nApply here (https://example.com/apply)";
    const flat = "Agenda\n• Founder demos\n\nApply here";
    const withFlat = { ...page, description: formatted, flatDescription: flat };
    expect(detailsPatch(event("a", { description: flat }), withFlat, null)).toMatchObject({ description: formatted });
    // Anything else in the column is someone's edit: left alone, even a near copy.
    expect(detailsPatch(event("a", { description: `${flat} Edited.` }), withFlat, null)).not.toHaveProperty("description");
    // Already formatted: nothing to do.
    expect(detailsPatch(event("a", { description: formatted }), withFlat, null)).not.toHaveProperty("description");
  });

  it("skips the cover when the import failed", () => {
    expect(detailsPatch(event("a"), page, null)).not.toHaveProperty("cover_url");
  });
});

describe("hasTimeFor", () => {
  const deadline = 1_000_000;
  it("allows a page that fits just inside the deadline", () => {
    expect(hasTimeFor(deadline - PAGE_WORST_CASE_MS - 1, deadline)).toBe(true);
  });
  it("allows a page that ends exactly at the deadline", () => {
    expect(hasTimeFor(deadline - PAGE_WORST_CASE_MS, deadline)).toBe(true);
  });
  it("refuses a page that could overrun the deadline", () => {
    expect(hasTimeFor(deadline - PAGE_WORST_CASE_MS + 1, deadline)).toBe(false);
  });
});

describe("hintedTags", () => {
  const tech = [{ label: "Tech", weight: 3 }];
  it("adds what the page's platform hints point to", () => {
    expect(hintedTags(event("a", { title: "Embedded Swift workshop", tags: ["workshop"] }), tech)).toEqual(["workshop", "technology"]);
  });
  it("leaves admin-edited tags and pages without hints alone", () => {
    expect(hintedTags(event("a", { title: "Embedded Swift", tags: [], tags_locked: true }), tech)).toBeNull();
    expect(hintedTags(event("a", { title: "Embedded Swift", tags: [] }), [])).toBeNull();
    expect(hintedTags(event("a", { title: "Embedded Swift", tags: ["technology"] }), tech)).toBeNull();
  });
});

describe("importedDescription", () => {
  const full = "The **Global Camp Meeting London** is a three-day gathering.\n\n**Theme:** SENT";

  it("replaces an empty description or the imported summary", () => {
    expect(importedDescription({ description: null, summary: "Short" }, full)).toBe(full);
    expect(importedDescription({ description: "Short", summary: "Short" }, full)).toBe(full);
  });

  it("keeps an admin's own description, and changes nothing without a new one", () => {
    expect(importedDescription({ description: "Written by an admin", summary: "Short" }, full)).toBeNull();
    expect(importedDescription({ description: full, summary: "Short" }, full)).toBeNull();
    expect(importedDescription({ description: null, summary: null }, null)).toBeNull();
  });
});
