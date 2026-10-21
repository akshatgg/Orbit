import { describe, expect, it } from "vitest";
import { dayHeading, groupByDay, reasonSegments, reasonTag } from "./feed-display";

describe("reasonSegments", () => {
  it("lifts the key words and keeps the rest muted", () => {
    expect(reasonSegments("Recommended because you like socials events")).toEqual([
      { text: "Picked because ", strong: false },
      { text: "you like ", strong: false },
      { text: "socials events", strong: true },
    ]);
  });
  it("handles two clauses", () => {
    const parts = reasonSegments("Recommended because you're into consulting & finance and you follow Imperial Consulting Society");
    expect(parts.filter((p) => p.strong).map((p) => p.text)).toEqual(["consulting & finance", "Imperial Consulting Society"]);
  });
  it("is empty without a reason", () => {
    expect(reasonSegments(null)).toEqual([]);
  });
});

describe("reasonTag", () => {
  it("turns reasons into a short chip", () => {
    expect(reasonTag("Recommended because you're into consulting")).toBe("Matches your interest in consulting");
    expect(reasonTag("Recommended because you like socials events")).toBe("Matches your taste for socials events");
    expect(reasonTag("Recommended because it's featured on ORBIT")).toBe("It's featured on ORBIT");
    expect(reasonTag(null)).toBeNull();
  });
});

describe("dayHeading", () => {
  // Wednesday 15 Oct 2025, noon UK time
  const now = new Date("2025-10-15T11:00:00Z");
  it("says today and tomorrow, with the weekday", () => {
    expect(dayHeading("2025-10-15T18:00:00Z", now)).toEqual({ key: "2025-10-15", title: "Today", weekday: "Wednesday" });
    expect(dayHeading("2025-10-16T18:00:00Z", now)).toEqual({ key: "2025-10-16", title: "Tomorrow", weekday: "Thursday" });
  });
  it("gives the date for later days", () => {
    expect(dayHeading("2025-10-18T10:00:00Z", now)).toMatchObject({ title: "18 October", weekday: "Saturday" });
    expect(dayHeading("2025-11-05T10:00:00Z", now)).toMatchObject({ title: "5 November", weekday: "Wednesday" });
  });
  it("uses the UK day, not UTC", () => {
    // 23:30 UTC on 18 Oct is 00:30 on Sunday 19 Oct in London (BST).
    expect(dayHeading("2025-10-18T23:30:00Z", now)).toMatchObject({ key: "2025-10-19", weekday: "Sunday" });
  });
});

describe("groupByDay", () => {
  it("groups events on the same day under one heading", () => {
    const now = new Date("2025-10-15T11:00:00Z");
    const groups = groupByDay(
      [{ starts_at: "2025-10-17T10:00:00Z" }, { starts_at: "2025-10-17T18:00:00Z" }, { starts_at: "2025-10-21T10:00:00Z" }],
      now,
    );
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([["17 October", 2], ["21 October", 1]]);
  });
});
