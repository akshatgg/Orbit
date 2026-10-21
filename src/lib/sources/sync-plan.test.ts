import { describe, expect, it } from "vitest";
import { EXTERNAL_LABELS, SKIPPED_FIELDS, buildInsertRow, changedFields, planSync, provenanceUrl, syncedFields, type ExistingSourceEvent } from "./sync-plan";

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
  city: null,
  latitude: null,
  longitude: null,
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
    city: f.city,
    latitude: f.latitude,
    longitude: f.longitude,
    registration_mode: f.registration_mode!,
    external_url: f.external_url ?? null,
    source_url: f.source_url,
    series_key: f.series_key,
    series_label: f.series_label,
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

  it("lets the classifier override the default category, including clearing it", () => {
    const source = { id: "s1", url: FEED, default_organiser_id: null, default_category_id: "fallback", default_tags: [] };
    expect(buildInsertRow(incoming("a"), source, NOW, "matched").category_id).toBe("matched");
    expect(buildInsertRow(incoming("a"), source, NOW, null).category_id).toBeNull();
    expect(buildInsertRow(incoming("a"), source, NOW).category_id).toBe("fallback");
  });
});

describe("source kind metadata", () => {
  it("labels discovery events and skips fields their feeds don't own", () => {
    expect(EXTERNAL_LABELS["luma-discover"]).toBe("Register on Luma");
    expect(EXTERNAL_LABELS["meetup-search"]).toBe("Register on Meetup");
    expect(SKIPPED_FIELDS["luma-discover"]).toEqual(["description", "city"]);
    expect(SKIPPED_FIELDS["meetup-search"]).toEqual(["venue_name", "address", "city", "latitude", "longitude"]);
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

  it("syncs coordinates from the feed and ignores unchanged ones", () => {
    const withGeo = incoming("a", { latitude: 51.52, longitude: -0.09 });
    expect(changedFields(existingFrom(incoming("a")), syncedFields(withGeo, FEED))).toEqual({
      latitude: 51.52, longitude: -0.09,
    });
    expect(changedFields(existingFrom(withGeo), syncedFields(withGeo, FEED))).toEqual({});
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

  it("never wipes a Meetup location the feed doesn't carry", () => {
    const located = existingFrom(incoming("a"), {
      venue_name: "Codurance", address: "3 Sutton Lane", latitude: 51.522907, longitude: -0.101072,
    });
    const fromFeed = incoming("a", { venueName: null, address: null, latitude: null, longitude: null });
    const plan = planSync([located], [fromFeed], {
      now: NOW, feedUrl: FEED, previousRunStartedAt, skip: SKIPPED_FIELDS.meetup,
    });
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toEqual(["db-a"]);
  });

  it("ignores duplicate ids within one fetch", () => {
    const plan = planSync([], [incoming("a"), incoming("a")], { now: NOW, feedUrl: FEED, previousRunStartedAt: null });
    expect(plan.inserts).toHaveLength(1);
  });
});

describe("luma sources", () => {
  const source = { id: "src-1", url: FEED, default_organiser_id: null, default_category_id: null, default_tags: [] };

  it("labels the register button by kind", () => {
    expect(buildInsertRow(incoming("a"), { ...source, kind: "luma" }, NOW).external_label).toBe("Register on Luma");
    expect(buildInsertRow(incoming("a"), { ...source, kind: "meetup" }, NOW).external_label).toBe("Register on Meetup");
    expect(buildInsertRow(incoming("a"), source, NOW).external_label).toBe("View details");
    expect(EXTERNAL_LABELS.ical).toBe("View details");
  });

  it("never overwrites a description the feed doesn't have", () => {
    const n = incoming("a", { description: null });
    const existing = existingFrom(n, { description: "Pasted by an admin" });
    const plan = planSync([existing], [n], { now: NOW, feedUrl: FEED, previousRunStartedAt, skip: SKIPPED_FIELDS.luma });
    expect(plan.updates).toEqual([]);
    expect(plan.unchanged).toEqual([existing.id]);

    const withoutSkip = planSync([existing], [n], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(withoutSkip.updates[0].patch).toEqual({ description: null });
  });

  it("still updates the fields the feed owns, and never touches cover or price", () => {
    const n = incoming("a", { description: null, title: "New title" });
    const existing = existingFrom(incoming("a", { description: null }), { description: "Pasted" });
    const patch = changedFields(existing, syncedFields(n, FEED), SKIPPED_FIELDS.luma);
    expect(patch).toEqual({ title: "New title" });
    expect(Object.keys(patch)).not.toContain("cover_url");
    expect(Object.keys(patch)).not.toContain("price_min");
  });
});

describe("planSync: recurring series", () => {
  const series = { seriesKey: "meetup:group:weekly referral", seriesLabel: "Every week on Wednesday" };
  const temp = incoming("event_fbrkztyjcpbgb@meetup.com", { ...series, startsAt: "2026-11-04T11:30:00.000Z", endsAt: "2026-11-04T12:30:00.000Z" });

  it("re-keys a date whose Meetup id changed (same series, same start) instead of inserting a copy", () => {
    const announced = { ...temp, sourceEventId: "event_317000001@meetup.com", url: "https://example.com/event_317000001@meetup.com" };
    const plan = planSync([existingFrom(temp)], [announced], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(plan.inserts).toEqual([]);
    expect(plan.flagged).toEqual([]);
    expect(plan.updates).toEqual([
      {
        id: "db-event_fbrkztyjcpbgb@meetup.com",
        sourceEventId: "event_317000001@meetup.com",
        patch: { external_url: announced.url, source_url: announced.url, source_event_id: "event_317000001@meetup.com" },
      },
    ]);
  });

  it("treats a different start as a different date", () => {
    const moved = { ...temp, sourceEventId: "event_317000001@meetup.com", startsAt: "2026-11-05T11:30:00.000Z" };
    const plan = planSync([existingFrom(temp)], [moved], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(plan.inserts.map((e) => e.sourceEventId)).toEqual(["event_317000001@meetup.com"]);
    expect(plan.flagged).toEqual([{ id: "db-event_fbrkztyjcpbgb@meetup.com", reason: "missing" }]);
  });

  it("stores the series key and label on new dates and keeps them in sync", () => {
    expect(syncedFields(temp, FEED)).toMatchObject({ series_key: series.seriesKey, series_label: series.seriesLabel });
    const relabelled = { ...temp, seriesLabel: "Every week on Wednesday until January 14, 2027" };
    const plan = planSync([existingFrom(temp)], [relabelled], { now: NOW, feedUrl: FEED, previousRunStartedAt });
    expect(plan.updates[0].patch).toEqual({ series_label: relabelled.seriesLabel });
  });
});
