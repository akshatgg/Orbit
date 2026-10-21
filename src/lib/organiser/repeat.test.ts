import { describe, expect, it } from "vitest";
import { MAX_EXTRA_DATES, daysBetween, nextWeek, shiftLocalDays, weeklyLabel, weeklyUntil } from "./repeat";

let n = 0;
const key = () => `k${++n}`;

describe("shiftLocalDays", () => {
  it("keeps the wall-clock time, across months and the clocks going back", () => {
    expect(shiftLocalDays("2026-10-21T17:00", 7)).toBe("2026-10-28T17:00"); // BST → GMT on 25 Oct
    expect(shiftLocalDays("2026-12-30T09:30", 7)).toBe("2027-01-06T09:30");
    expect(shiftLocalDays("2026-10-28", -1)).toBe("2026-10-27");
    expect(shiftLocalDays("", 7)).toBe("");
  });
});

describe("weeklyUntil", () => {
  it("adds a slot each week up to and including the end date", () => {
    const slots = weeklyUntil({ starts_at: "2026-10-28T17:00", ends_at: "2026-10-28T18:00" }, "2026-12-09", key);
    expect(slots.map((s) => s.starts_at)).toEqual([
      "2026-11-04T17:00", "2026-11-11T17:00", "2026-11-18T17:00", "2026-11-25T17:00", "2026-12-02T17:00", "2026-12-09T17:00",
    ]);
    expect(slots[0].ends_at).toBe("2026-11-04T18:00");
  });

  it("is capped, and empty for an end before the next week or missing input", () => {
    expect(weeklyUntil({ starts_at: "2026-10-28T17:00", ends_at: "" }, "2030-01-01", key)).toHaveLength(MAX_EXTRA_DATES);
    expect(weeklyUntil({ starts_at: "2026-10-28T17:00", ends_at: "" }, "2026-11-03", key)).toEqual([]);
    expect(weeklyUntil({ starts_at: "", ends_at: "" }, "2026-12-09", key)).toEqual([]);
  });
});

describe("nextWeek / daysBetween", () => {
  it("moves a slot one week and counts calendar days", () => {
    expect(nextWeek({ starts_at: "2026-10-28T17:00", ends_at: "" }, "x")).toEqual({ key: "x", starts_at: "2026-11-04T17:00", ends_at: "" });
    expect(daysBetween("2026-10-28T23:00", "2026-11-04T01:00")).toBe(7);
  });
});

describe("weeklyLabel", () => {
  it("names a weekly run, in any order", () => {
    expect(weeklyLabel(["2026-11-04T17:00", "2026-10-28T17:00", "2026-11-11T17:00"])).toBe("Every week on Wednesday until 11 November 2026");
  });
  it("is null for irregular dates or a single date", () => {
    expect(weeklyLabel(["2026-10-28T17:00", "2026-10-30T17:00"])).toBeNull();
    expect(weeklyLabel(["2026-10-28T17:00"])).toBeNull();
  });
});
