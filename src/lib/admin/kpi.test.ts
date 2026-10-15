import { describe, expect, it } from "vitest";
import { barHeights, compactNumber, fillDailySeries, percent, periodDelta, toStats } from "./kpi";

describe("toStats", () => {
  it("coerces strings and fills missing keys", () => {
    const s = toStats({ users: "12", onboarded: 9, junk: 1 });
    expect(s.users).toBe(12);
    expect(s.onboarded).toBe(9);
    expect(s.check_ins).toBe(0);
    expect(toStats(null).users).toBe(0);
  });
});

describe("percent", () => {
  it("rounds and guards against zero", () => {
    expect(percent(7, 8)).toBe(88);
    expect(percent(0, 0)).toBe(0);
    expect(percent(3, 3)).toBe(100);
  });
});

describe("compactNumber", () => {
  it("abbreviates", () => {
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(1234)).toBe("1.2k");
    expect(compactNumber(25300)).toBe("25k");
    expect(compactNumber(1_200_000)).toBe("1.2m");
  });
});

describe("fillDailySeries", () => {
  it("zero-fills and ends on today", () => {
    const s = fillDailySeries([{ day: "2026-10-15", count: 3 }, { day: "2026-10-13T00:00:00", count: 1 }], 4, "2026-10-16");
    expect(s).toEqual([
      { day: "2026-10-13", count: 1 },
      { day: "2026-10-14", count: 0 },
      { day: "2026-10-15", count: 3 },
      { day: "2026-10-16", count: 0 },
    ]);
  });
  it("crosses month boundaries", () => {
    const s = fillDailySeries([], 3, "2026-11-01");
    expect(s.map((p) => p.day)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});

describe("barHeights", () => {
  it("scales to the max and keeps small values visible", () => {
    expect(barHeights([0, 1, 50, 100])).toEqual([0, 4, 50, 100]);
    expect(barHeights([0, 0])).toEqual([0, 0]);
    expect(barHeights([])).toEqual([]);
  });
});

describe("periodDelta", () => {
  it("compares the last n days with the n before", () => {
    const series = [1, 1, 1, 2, 2, 2].map((count, i) => ({ day: `d${i}`, count }));
    expect(periodDelta(series, 3)).toEqual({ current: 6, previous: 3, change: 3 });
  });
});
