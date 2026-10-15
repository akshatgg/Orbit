import { describe, expect, it } from "vitest";
import { buildInsertRow, changedFields, planSync, provenanceUrl, syncedFields, type ExistingSourceEvent } from "./sync-plan";
import type { NormalizedEvent } from "./types";

const NOW = new Date("2026-10-16T12:00:00Z");
const FEED = "https://calendar.example.com/private-abc123/basic.ics";

const incoming = (id: string, over: Partial<NormalizedEvent> = {}): NormalizedEvent => ({
  sourceEventId: id,
  title: `Event ${id}`,
  summary: null,
  description: null,
  startsAt: "2026-10-20T18:00:00.000Z",
  endsAt: "2026-10-20T20:00:00.000Z",
  allDay: false,
  timezone: "Europe/London",
  format: "in_person",
  venueName: "Room 1",
  address: null,
  url: `https://example.com/${id}`,
  cancelled: false,
  ...over,
});

const existingFrom = (n: NormalizedEvent, over: Partial<ExistingSourceEvent> = {}): ExistingSourceEvent => {
  const f = syncedFields(n, FEED);
  return {
    id: `db-${n.sourceEventId}`,
    source_event_id: n.sourceEventId,
    title: f.title,
    summary: f.summary,
    description: f.description,
    starts_at: f.starts_at.replace(".000Z", "+00:00"), // Postgres format
    ends_at: f.ends_at?.replace(".000Z", "+00:00") ?? null,
    timezone: f.timezone,
    format: f.format,
    venue_name: f.venue_name,
    address: f.address,
    registration_mode: f.registration_mode!,
    external_url: f.external_url ?? null,
    source_url: f.source_url,
    status: "published",
    needs_review: false,
    last_verified_at: "2026-10-15T03:00:00+00:00",
    ...over,
  };
};

const previousRunStartedAt = new Date("2026-10-15T03:00:00Z");

describe("provenance", () => {
  it("uses the event link, else only the feed's origin (feed URLs can hold private tokens)", () => {
    expect(provenanceUrl({ url: "https://example.com/e" }, FEED)).toBe("https://example.com/e");
    expect(provenanceUrl({ url: null }, FEED)).toBe("https://calendar.example.com");
  });

  it("builds inserts with source defaults and external registration only when there's a link", () => {
    const source = { id: "s1", url: FEED, default_organiser_id: "org", default_category_id: "cat", default_tags: ["careers"] };
    const withLink = buildInsertRow(incoming("a"), source, NOW);
    expect(withLink).toMatchObject({
      source: "source:s1", source_event_id: "a", status: "published", registration_mode: "external",
      external_url: "https://example.com/a", external_label: "View details", organiser_id: "org",
      category_id: "cat", tags: ["careers"], source_url: "https://example.com/a", last_verified_at: NOW.toISOString(),
    });
    const noLink = buildInsertRow(incoming("b", { url: null }), source, NOW);
    expect(noLink.registration_mode).toBe("none");
    expect(noLink.external_url).toBeNull();
  });
});

describe("changedFields", () => {
  it("ignores timestamp formatting differences", () => {
    const n = incoming("a");
    expect(changedFields(existingFrom(n), syncedFields(n, FEED))).toEqual({});
  });

  it("returns only what changed", () => {
    const n = incoming("a");
    const moved = incoming("a", { startsAt: "2026-10-21T18:00:00.000Z", title: "Renamed" });
    expect(changedFields(existingFrom(n), syncedFields(moved, FEED))).toEqual({
      title: "Renamed", starts_at: "2026-10-21T18:00:00.000Z",
    });
  });

  it("leaves registration alone when an admin switched to ORBIT tickets", () => {
    const n = incoming("a", { url: "https://example.com/new" });
    const current = existingFrom(incoming("a"), { registration_mode: "tickets", external_url: null });
    expect(changedFields(current, syncedFields(n, FEED))).toEqual({ source_url: "https://example.com/new" });
  });
});

describe("planSync", () => {
  it("inserts new, updates changed and touches unchanged", () => {
    const a = incoming("a");
    const b = incoming("b");
    const existing = [existingFrom(a), existingFrom(b)];
    const plan = planSync(existing, [a, incoming("b", { venueName: "Room 2" }), incoming("c")], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(plan.inserts.map((e) => e.sourceEventId)).toEqual(["c"]);
    expect(plan.updates).toEqual([{ id: "db-b", sourceEventId: "b", patch: { venue_name: "Room 2" } }]);
    expect(plan.unchanged).toEqual(["db-a"]);
    expect(plan.flagged).toEqual([]);
  });

  it("flags upcoming events that disappeared, but not past ones", () => {
    const future = existingFrom(incoming("gone"));
    const past = existingFrom(incoming("old", { startsAt: "2026-10-10T18:00:00.000Z", endsAt: null }));
    const plan = planSync([future, past], [], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(plan.flagged).toEqual([{ id: "db-gone", reason: "missing" }]);
  });

  it("flags only once: not when already flagged, reviewed earlier, or cancelled/removed in ORBIT", () => {
    const flagged = existingFrom(incoming("a"), { needs_review: true });
    const reviewedEarlier = existingFrom(incoming("b"), { last_verified_at: "2026-10-14T03:00:00+00:00" });
    const removed = existingFrom(incoming("c"), { status: "removed" });
    const plan = planSync([flagged, reviewedEarlier, removed], [], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(plan.flagged).toEqual([]);
  });

  it("never auto-cancels: cancelled upstream is flagged, and never inserted", () => {
    const a = incoming("a");
    const plan = planSync([existingFrom(a)], [{ ...a, cancelled: true }, incoming("new", { cancelled: true })], {
      now: NOW, feedUrl: FEED, previousRunStartedAt,
    });
    expect(plan.flagged).toEqual([{ id: "db-a", reason: "cancelled" }]);
    expect(plan.inserts).toEqual([]);
    expect(plan.updates).toEqual([]);
  });

  it("ignores duplicate ids within one fetch", () => {
    const plan = planSync([], [incoming("a"), incoming("a")], { now: NOW, feedUrl: FEED, previousRunStartedAt: null });
    expect(plan.inserts).toHaveLength(1);
  });
});
