import { describe, expect, it } from "vitest";
import {
  addDays, datePresetRange, formatMonth, isDayKey, isMonthKey, monthGrid, monthRange, shiftMonth, ukOffsetMinutes,
  ukStartOfDay, weekdayIndex,
} from "./dates";

describe("UK day boundaries", () => {
  it("knows the UK offset either side of the clock change", () => {
    expect(ukOffsetMinutes(new Date("2026-10-20T12:00:00Z"))).toBe(60);
    expect(ukOffsetMinutes(new Date("2026-12-20T12:00:00Z"))).toBe(0);
  });
  it("finds UK midnight in summer and winter", () => {
    expect(ukStartOfDay("2026-10-16").toISOString()).toBe("2026-10-15T23:00:00.000Z");
    expect(ukStartOfDay("2026-12-01").toISOString()).toBe("2026-12-01T00:00:00.000Z");
    // Clocks go back at 02:00 on 25 Oct 2026; midnight is still BST
    expect(ukStartOfDay("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(ukStartOfDay("2026-10-26").toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
  it("does day and month arithmetic", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekdayIndex("2026-10-19")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-18")).toBe(6); // Sunday
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(formatMonth("2026-10")).toBe("October 2026");
  });
  it("validates keys", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("26-10")).toBe(false);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-10-16")).toBe(true);
  });
});

describe("monthGrid", () => {
  it("builds Monday-first weeks covering the month", () => {
    const grid = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday
    expect(grid[0][0].key).toBe("2026-09-28");
    expect(grid[0][3]).toEqual({ key: "2026-10-01", day: 1, inMonth: true });
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.at(-1)!.some((d) => d.key === "2026-10-31")).toBe(true);
    expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(31);
  });
  it("covers the month in UK time", () => {
    const { start, end } = monthRange("2026-10");
    expect(start.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("datePresetRange", () => {
  const friday = new Date("2026-10-16T11:00:00Z");
  it("today ends at UK midnight", () => {
    expect(datePresetRange("today", friday).to.toISOString()).toBe("2026-10-16T23:00:00.000Z");
  });
  it("this weekend is Saturday and Sunday", () => {
    const r = datePresetRange("weekend", friday);
    expect(r.from.toISOString()).toBe("2026-10-16T23:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-18T23:00:00.000Z"); // Monday 00:00 BST
    const sunday = new Date("2026-10-18T12:00:00Z");
    const s = datePresetRange("weekend", sunday);
    expect(s.from).toEqual(sunday);
    expect(s.to.toISOString()).toBe("2026-10-18T23:00:00.000Z");
  });
  it("week and month are rolling windows", () => {
    expect(datePresetRange("week", friday).to.toISOString()).toBe("2026-10-23T11:00:00.000Z");
    expect(datePresetRange("month", friday).to.toISOString()).toBe("2026-11-15T11:00:00.000Z");
  });
});
