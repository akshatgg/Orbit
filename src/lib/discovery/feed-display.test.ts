import { describe, expect, it } from "vitest";
import { dayGroupLabel, groupByDayLabel, reasonSegments, reasonTag } from "./feed-display";

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

describe("dayGroupLabel", () => {
  // Wednesday 15 Oct 2025, noon UK time
  const now = new Date("2025-10-15T11:00:00Z");
  it("labels today, tomorrow and the rest of the week", () => {
    expect(dayGroupLabel("2025-10-15T18:00:00Z", now)).toBe("Today");
    expect(dayGroupLabel("2025-10-16T18:00:00Z", now)).toBe("Tomorrow");
    expect(dayGroupLabel("2025-10-18T10:00:00Z", now)).toBe("This week");
    expect(dayGroupLabel("2025-10-19T10:00:00Z", now)).toBe("This week");
  });
  it("labels next week, then months", () => {
    expect(dayGroupLabel("2025-10-20T10:00:00Z", now)).toBe("Next week");
    expect(dayGroupLabel("2025-10-26T10:00:00Z", now)).toBe("Next week");
    expect(dayGroupLabel("2025-10-27T10:00:00Z", now)).toBe("October 2025");
    expect(dayGroupLabel("2025-11-05T10:00:00Z", now)).toBe("November 2025");
  });
});

describe("groupByDayLabel", () => {
  it("groups consecutive events under one heading", () => {
    const now = new Date("2025-10-15T11:00:00Z");
    const groups = groupByDayLabel(
      [{ starts_at: "2025-10-17T10:00:00Z" }, { starts_at: "2025-10-18T10:00:00Z" }, { starts_at: "2025-10-21T10:00:00Z" }],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([["This week", 2], ["Next week", 1]]);
  });
});
