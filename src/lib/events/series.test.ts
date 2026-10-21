import { describe, expect, it } from "vitest";
import { nextOfEachSeries, seriesBlocks, seriesDayLabel, shortSeriesLabel } from "./series";

const e = (id: string, startsAt: string, seriesKey: string | null = null) => ({ id, starts_at: startsAt, series_key: seriesKey });

describe("nextOfEachSeries", () => {
  it("keeps the soonest date of each series and every one-off event, in order", () => {
    const rows = [
      e("talk", "2026-10-27T10:00:00Z"),
      e("nov4", "2026-11-04T11:30:00Z", "meetup:mohali:referral"),
      e("oct28", "2026-10-28T11:30:00Z", "meetup:mohali:referral"),
      e("swift", "2026-10-24T04:00:00Z"),
      e("nov11", "2026-11-11T11:30:00Z", "meetup:mohali:referral"),
      e("other", "2026-11-01T09:00:00Z", "meetup:blr:runs"),
    ];
    expect(nextOfEachSeries(rows).map((r) => r.id)).toEqual(["talk", "oct28", "swift", "other"]);
  });

  it("moves on to the next date once the first one has dropped out", () => {
    const afterOct28 = [e("nov4", "2026-11-04T11:30:00Z", "s"), e("nov11", "2026-11-11T11:30:00Z", "s")];
    expect(nextOfEachSeries(afterOct28).map((r) => r.id)).toEqual(["nov4"]);
  });
});

describe("shortSeriesLabel", () => {
  it("drops the end date for cards", () => {
    expect(shortSeriesLabel("Every week on Wednesday until December 10, 2026")).toBe("Every week on Wednesday");
    expect(shortSeriesLabel("Every 2nd Monday of the month")).toBe("Every 2nd Monday of the month");
    expect(shortSeriesLabel(null)).toBeNull();
  });
});

describe("seriesDayLabel", () => {
  it("names the day in the event's own timezone", () => {
    expect(seriesDayLabel("2026-10-28T11:30:00Z", "Asia/Kolkata")).toBe("Wed 28 Oct");
    // 23:30 UTC on the 3rd is already the 4th in India.
    expect(seriesDayLabel("2026-11-03T23:30:00Z", "Asia/Kolkata")).toBe("Wed 4 Nov");
    expect(seriesDayLabel("2026-11-03T23:30:00Z", "Not/AZone")).toBe("Tue 3 Nov");
  });
});

describe("seriesBlocks", () => {
  it("folds each series into one entry led by its soonest date, keeping one-offs as they are", () => {
    const rows = [
      e("talk", "2026-10-27T10:00:00Z"),
      e("oct28", "2026-10-28T18:00:00Z", "orbit:x"),
      e("nov4", "2026-11-04T18:00:00Z", "orbit:x"),
      e("fair", "2026-10-30T11:00:00Z"),
    ];
    expect(seriesBlocks(rows).map((b) => [b.lead.id, b.dates.map((d) => d.id)])).toEqual([
      ["talk", ["talk"]],
      ["oct28", ["oct28", "nov4"]],
      ["fair", ["fair"]],
    ]);
  });
});
