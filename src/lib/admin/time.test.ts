import { describe, expect, it } from "vitest";
import { parseFlexibleDate, ukLocalToUtc, ukOffsetMinutes, utcToUkLocalInput } from "./time";

describe("ukOffsetMinutes", () => {
  it("is 0 in winter and 60 in summer", () => {
    expect(ukOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(0);
    expect(ukOffsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(60);
  });
});

describe("ukLocalToUtc", () => {
  it("converts BST (summer) times", () => {
    expect(ukLocalToUtc("2026-10-20T18:00")?.toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(ukLocalToUtc("2026-07-01 09:30")?.toISOString()).toBe("2026-07-01T08:30:00.000Z");
  });

  it("converts GMT (winter) times", () => {
    expect(ukLocalToUtc("2026-11-03 18:00")?.toISOString()).toBe("2026-11-03T18:00:00.000Z");
    expect(ukLocalToUtc("2027-01-10T00:15")?.toISOString()).toBe("2027-01-10T00:15:00.000Z");
  });

  it("handles the clock changes", () => {
    // Clocks go back 02:00 BST → 01:00 GMT on 25 Oct 2026: 01:30 happens twice, pick BST.
    expect(ukLocalToUtc("2026-10-25 01:30")?.toISOString()).toBe("2026-10-25T00:30:00.000Z");
    expect(ukLocalToUtc("2026-10-25 03:00")?.toISOString()).toBe("2026-10-25T03:00:00.000Z");
    // Clocks go forward 01:00 GMT → 02:00 BST on 29 Mar 2026: 01:30 doesn't exist.
    expect(ukLocalToUtc("2026-03-29 01:30")).not.toBeNull();
    expect(ukLocalToUtc("2026-03-29 03:00")?.toISOString()).toBe("2026-03-29T02:00:00.000Z");
  });

  it("rejects nonsense", () => {
    expect(ukLocalToUtc("2026-02-31 10:00")).toBeNull();
    expect(ukLocalToUtc("2026-13-01 10:00")).toBeNull();
    expect(ukLocalToUtc("2026-10-20 25:00")).toBeNull();
    expect(ukLocalToUtc("tomorrow")).toBeNull();
    expect(ukLocalToUtc("")).toBeNull();
  });
});

describe("utcToUkLocalInput", () => {
  it("round-trips with ukLocalToUtc", () => {
    for (const local of ["2026-10-20T18:00", "2026-12-01T09:05", "2026-10-25T03:00"]) {
      expect(utcToUkLocalInput(ukLocalToUtc(local))).toBe(local);
    }
  });
  it("is empty for missing values", () => {
    expect(utcToUkLocalInput(null)).toBe("");
    expect(utcToUkLocalInput("not a date")).toBe("");
  });
});

describe("parseFlexibleDate", () => {
  it("keeps explicit zones as exact instants", () => {
    expect(parseFlexibleDate("2026-10-20T17:00:00Z")?.toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(parseFlexibleDate("2026-10-20T18:00:00+01:00")?.toISOString()).toBe("2026-10-20T17:00:00.000Z");
  });
  it("reads zone-less values as UK time", () => {
    expect(parseFlexibleDate("2026-10-20 18:00")?.toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(parseFlexibleDate("2026-10-20T18:00")?.toISOString()).toBe("2026-10-20T17:00:00.000Z");
    expect(parseFlexibleDate(" 20/11/2026 18:00 ")?.toISOString()).toBe("2026-11-20T18:00:00.000Z");
  });
  it("returns null for blanks and garbage", () => {
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate(undefined)).toBeNull();
    expect(parseFlexibleDate("next Tuesday")).toBeNull();
    expect(parseFlexibleDate("2026-10-20")).toBeNull();
  });
});
