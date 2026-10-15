import { describe, expect, it } from "vitest";
import type { RegistrationStatus } from "@/types/database";
import {
  WEIGHTS, buildReason, dayPartFor, eventTopics, exclusionFor, parseAvailability, rankEvents, scoreEvent,
  ukWeekdayHour, type RankContext, type RankProfile, type RankableEvent,
} from ".";

// Friday 16 Oct 2026, 12:00 UK (BST = UTC+1)
const NOW = new Date("2026-10-16T11:00:00Z");
const ICS = "org-ics";

const profile: RankProfile = {
  career_interests: ["consulting", "finance"],
  personal_interests: ["fitness", "socialising"],
  preferred_categories: ["employer-presentation", "networking", "workshop"],
  preferred_formats: ["in_person", "hybrid"],
  availability: { mon: ["evening"], tue: ["evening"], wed: ["evening"], thu: ["evening"], sat: ["day"] },
  university: "Imperial College London",
  department: "Business School",
  course: "MSc Management",
};

let seq = 0;
function ev(over: Partial<RankableEvent> = {}): RankableEvent {
  seq += 1;
  return {
    id: over.id ?? `e${String(seq).padStart(3, "0")}`,
    title: "Event",
    summary: null,
    cover_url: null,
    starts_at: "2026-10-30T10:00:00Z", // Friday morning — fits no availability slot
    ends_at: null,
    timezone: "Europe/London",
    format: "online",
    venue_name: null,
    address: null,
    city: "London",
    tags: [],
    university: null,
    registration_mode: "tickets",
    external_url: null,
    external_label: "Apply now",
    requires_approval: false,
    capacity: null,
    registration_deadline: null,
    price_min: 0,
    price_max: 0,
    currency: "GBP",
    status: "published",
    is_featured: false,
    organiser_id: "org-other",
    category_id: null,
    source: "orbit",
    source_url: null,
    published_at: null,
    created_at: "2026-10-01T00:00:00Z",
    organiser: { id: "org-other", slug: "other", name: "Other Org", logo_url: null, is_verified: false, kind: "society" },
    category: null,
    ...over,
  };
}

const ctx = (over: Partial<RankContext> = {}): RankContext => ({
  followedOrganiserIds: new Set([ICS]),
  state: { dismissed: new Set(), registrations: new Map() },
  now: NOW,
  ...over,
});

const keys = (e: RankableEvent, c = ctx()) => scoreEvent(e, profile, c).signals.map((s) => s.key);

describe("UK time helpers", () => {
  it("reads weekday and hour in UK local time across the clock change", () => {
    expect(ukWeekdayHour(new Date("2026-10-20T18:00:00Z"))).toEqual({ weekday: "tue", hour: 19 }); // BST
    expect(ukWeekdayHour(new Date("2026-11-03T18:00:00Z"))).toEqual({ weekday: "tue", hour: 18 }); // GMT
    expect(ukWeekdayHour(new Date("2026-10-20T23:30:00Z"))).toEqual({ weekday: "wed", hour: 0 });
  });
  it("maps hours to day parts", () => {
    expect(dayPartFor(5)).toBeNull();
    expect(dayPartFor(9)).toBe("morning");
    expect(dayPartFor(12)).toBe("day");
    expect(dayPartFor(17)).toBe("evening");
    expect(dayPartFor(23)).toBe("evening");
  });
  it("parses availability defensively", () => {
    expect(parseAvailability(null).size).toBe(0);
    expect(parseAvailability(["mon"]).size).toBe(0);
    const a = parseAvailability({ mon: ["evening", 3], tue: "x", wed: [] });
    expect([...a.keys()]).toEqual(["mon"]);
    expect([...a.get("mon")!]).toEqual(["evening"]);
  });
});

describe("eventTopics", () => {
  it("normalises tags, adds synonyms and category topics", () => {
    const t = eventTopics({ tags: ["Consulting", "Startups", "case interviews"], category: { id: "c", slug: "fitness", name: "Fitness", group: "other" } });
    expect(t.has("consulting")).toBe(true);
    expect(t.has("entrepreneurship")).toBe(true);
    expect(t.has("case-interviews")).toBe(true);
    expect(t.has("fitness")).toBe(true);
  });
});

describe("signals", () => {
  it("matches career interests with a readable reason", () => {
    const s = scoreEvent(ev({ tags: ["consulting"] }), profile, ctx());
    expect(s.signals[0]).toEqual({ key: "careerInterest", weight: WEIGHTS.careerInterest, reason: "you're into consulting" });
    const two = scoreEvent(ev({ tags: ["consulting", "finance"] }), profile, ctx());
    expect(two.signals[0].weight).toBe(WEIGHTS.careerInterest + WEIGHTS.careerInterestExtra);
    expect(two.signals[0].reason).toBe("you're into consulting & finance");
  });

  it("matches personal interests, also via the category", () => {
    const s = scoreEvent(ev({ category: { id: "c", slug: "fitness", name: "Fitness & sport", group: "other" } }), profile, ctx());
    expect(s.signals.find((x) => x.key === "personalInterest")?.reason).toBe("you enjoy fitness");
  });

  it("does not double count an interest that is both career and personal", () => {
    const p = { ...profile, career_interests: ["sustainability"], personal_interests: ["sustainability"] };
    const s = scoreEvent(ev({ tags: ["sustainability"] }), p, ctx());
    expect(s.signals.filter((x) => x.key === "personalInterest")).toHaveLength(0);
    expect(s.signals.filter((x) => x.key === "careerInterest")).toHaveLength(1);
  });

  it("boosts followed organisers", () => {
    const s = scoreEvent(ev({ organiser_id: ICS, organiser: { id: ICS, slug: "ics", name: "Imperial Consulting Society", logo_url: null, is_verified: true, kind: "society" } }), profile, ctx());
    expect(s.signals[0]).toMatchObject({ key: "followedOrganiser", reason: "you follow Imperial Consulting Society" });
  });

  it("matches preferred category, format, university and course", () => {
    const e = ev({
      category: { id: "c", slug: "workshop", name: "Workshop", group: "career" },
      format: "hybrid",
      university: "Imperial College London",
      tags: ["MSc Management"],
    });
    const k = keys(e);
    expect(k).toContain("preferredCategory");
    expect(k).toContain("preferredFormat");
    expect(k).toContain("sameUniversity");
    expect(k).toContain("courseMatch");
    expect(scoreEvent(e, profile, ctx()).signals.find((s) => s.key === "preferredCategory")?.reason).toBe("you like workshop events");
    expect(keys(ev({ format: "online" }))).not.toContain("preferredFormat");
  });

  it("checks availability in UK local time", () => {
    // Tue 20 Oct 19:00 BST → Tuesday evening
    const s = scoreEvent(ev({ starts_at: "2026-10-20T18:00:00Z" }), profile, ctx());
    expect(s.signals.find((x) => x.key === "availability")?.reason).toBe("you're free on Tuesday evenings");
    // Friday evening isn't in the profile
    expect(keys(ev({ starts_at: "2026-10-23T18:00:00Z" }))).not.toContain("availability");
    // No availability set → no signal, no penalty
    const noAvail = scoreEvent(ev({ starts_at: "2026-10-20T18:00:00Z" }), { ...profile, availability: null }, ctx());
    expect(noAvail.signals.map((s) => s.key)).not.toContain("availability");
  });

  it("boosts deadlines within 3 days and sinks closed registration", () => {
    const soon = scoreEvent(ev({ registration_deadline: "2026-10-18T11:00:00Z" }), profile, ctx());
    expect(soon.signals.find((s) => s.key === "deadlineSoon")?.reason).toBe("registration closes in 2 days");
    const hours = scoreEvent(ev({ registration_deadline: "2026-10-16T16:00:00Z" }), profile, ctx());
    expect(hours.signals.find((s) => s.key === "deadlineSoon")?.reason).toBe("registration closes in 5 hours");
    expect(keys(ev({ registration_deadline: "2026-10-25T11:00:00Z" }))).not.toContain("deadlineSoon");
    const closed = scoreEvent(ev({ registration_deadline: "2026-10-15T11:00:00Z" }), profile, ctx());
    expect(closed.signals.find((s) => s.key === "registrationClosed")?.weight).toBe(WEIGHTS.registrationClosed);
    // Info-only events have no registration to close
    expect(keys(ev({ registration_mode: "none", registration_deadline: "2026-10-15T11:00:00Z" }))).not.toContain("registrationClosed");
  });

  it("gives a small boost to events starting soon", () => {
    expect(keys(ev({ starts_at: "2026-10-17T10:00:00Z" }))).toContain("startingSoon");
    expect(keys(ev({ starts_at: "2026-10-20T10:00:00Z" }))).not.toContain("startingSoon");
  });

  it("caps popularity and only explains it for busy events", () => {
    const busy = scoreEvent(ev({ counts: { going: 500, waitlisted: 0, pending: 0 } }), profile, ctx());
    const pop = busy.signals.find((s) => s.key === "popularity")!;
    expect(pop.weight).toBe(WEIGHTS.popularityMax);
    expect(pop.reason).toBe("500 people are going");
    const quiet = scoreEvent(ev({ counts: { going: 3, waitlisted: 0, pending: 0 } }), profile, ctx());
    expect(quiet.signals.find((s) => s.key === "popularity")?.reason).toBeNull();
  });

  it("boosts featured events", () => {
    expect(keys(ev({ is_featured: true }))).toContain("featured");
  });

  it("penalises full events, more so without a waitlist", () => {
    const full = { capacity: 2, counts: { going: 2, waitlisted: 0, pending: 0 } };
    const withWl = scoreEvent(ev(full), profile, ctx()).signals.find((s) => s.key === "full")!;
    const noWl = scoreEvent(ev({ ...full, waitlist_enabled: false }), profile, ctx()).signals.find((s) => s.key === "full")!;
    expect(withWl.weight).toBe(WEIGHTS.fullWithWaitlist);
    expect(noWl.weight).toBe(WEIGHTS.fullNoWaitlist);
    expect(keys(ev({ capacity: 10, counts: { going: 2, waitlisted: 0, pending: 0 } }))).not.toContain("full");
  });
});

describe("buildReason", () => {
  it("uses the top two positive reasons", () => {
    expect(buildReason([
      { key: "preferredFormat", weight: 5, reason: "it's in person" },
      { key: "careerInterest", weight: 30, reason: "you're into consulting" },
      { key: "followedOrganiser", weight: 25, reason: "you follow Imperial Consulting Society" },
    ])).toBe("Recommended because you're into consulting and you follow Imperial Consulting Society");
  });
  it("skips penalties and reasonless signals, and returns null when nothing matches", () => {
    expect(buildReason([
      { key: "popularity", weight: 3, reason: null },
      { key: "full", weight: -20, reason: null },
      { key: "featured", weight: 5, reason: "it's featured on ORBIT" },
    ])).toBe("Recommended because it's featured on ORBIT");
    expect(buildReason([])).toBeNull();
  });
});

describe("exclusions", () => {
  const reg = (status: RegistrationStatus, id: string) => ctx({ state: { dismissed: new Set(), registrations: new Map([[id, status]]) } });

  it("drops dismissed, unpublished and finished events", () => {
    expect(exclusionFor(ev({ id: "x" }), ctx({ state: { dismissed: new Set(["x"]), registrations: new Map() } }))).toBe("dismissed");
    expect(exclusionFor(ev({ status: "cancelled" }), ctx())).toBe("unavailable");
    expect(exclusionFor(ev({ status: "removed" }), ctx())).toBe("unavailable");
    expect(exclusionFor(ev({ status: "expired" }), ctx())).toBe("unavailable");
    expect(exclusionFor(ev({ starts_at: "2026-10-15T10:00:00Z" }), ctx())).toBe("ended");
    // Started but still running → still shown
    expect(exclusionFor(ev({ starts_at: "2026-10-16T09:00:00Z", ends_at: "2026-10-16T15:00:00Z" }), ctx())).toBeNull();
  });

  it("drops events already in Tickets but keeps declined / cancelled ones", () => {
    for (const s of ["going", "pending", "waitlisted", "awaiting_payment"] as const) {
      expect(exclusionFor(ev({ id: "r" }), reg(s, "r"))).toBe("registered");
    }
    expect(exclusionFor(ev({ id: "r" }), reg("cancelled", "r"))).toBeNull();
    expect(exclusionFor(ev({ id: "r" }), reg("declined", "r"))).toBeNull();
    expect(exclusionFor(ev({ id: "r" }), ctx({ state: { dismissed: new Set(), registrations: new Map(), externalRegistered: new Set(["r"]) } }))).toBe("registered");
  });
});

describe("rankEvents", () => {
  it("orders by score and explains the top pick", () => {
    const consulting = ev({ id: "consulting", tags: ["consulting"], organiser_id: ICS, organiser: { id: ICS, slug: "ics", name: "Imperial Consulting Society", logo_url: null, is_verified: true, kind: "society" } });
    const finance = ev({ id: "finance", tags: ["finance"] });
    const random = ev({ id: "random", tags: ["pottery"] });
    const ranked = rankEvents([random, finance, consulting], profile, ctx());
    expect(ranked.map((r) => r.event.id)).toEqual(["consulting", "finance", "random"]);
    expect(ranked[0].reason).toBe("Recommended because you're into consulting and you follow Imperial Consulting Society");
    expect(ranked[2].reason).toBeNull();
  });

  it("breaks ties by start time, then id, deterministically", () => {
    const later = ev({ id: "b", starts_at: "2026-11-02T10:00:00Z" });
    const sooner = ev({ id: "c", starts_at: "2026-11-01T10:00:00Z" });
    const sameAsSooner = ev({ id: "a", starts_at: "2026-11-01T10:00:00Z" });
    const once = rankEvents([later, sooner, sameAsSooner], profile, ctx()).map((r) => r.event.id);
    const again = rankEvents([sameAsSooner, later, sooner], profile, ctx()).map((r) => r.event.id);
    expect(once).toEqual(["a", "c", "b"]);
    expect(again).toEqual(once);
  });

  it("filters exclusions, or keeps personal ones for search", () => {
    const going = ev({ id: "going" });
    const dismissed = ev({ id: "dismissed" });
    const cancelled = ev({ id: "cancelled", status: "cancelled" });
    const c = ctx({ state: { dismissed: new Set(["dismissed"]), registrations: new Map([["going", "going"]]) } });
    expect(rankEvents([going, dismissed, cancelled], profile, c)).toHaveLength(0);
    const kept = rankEvents([going, dismissed, cancelled], profile, c, { keepPersonal: true }).map((r) => r.event.id);
    expect(kept.sort()).toEqual(["dismissed", "going"]);
  });

  it("works with an empty profile", () => {
    const empty: RankProfile = {
      career_interests: [], personal_interests: [], preferred_categories: [], preferred_formats: [],
      availability: null, university: null, department: null, course: null,
    };
    const ranked = rankEvents([ev({ tags: ["consulting"] })], empty, ctx({ followedOrganiserIds: new Set(), state: undefined }));
    expect(ranked).toHaveLength(1);
    expect(ranked[0].score).toBe(0);
    expect(ranked[0].reason).toBeNull();
  });
});
