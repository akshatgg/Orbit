import { describe, expect, it } from "vitest";
import { londonLocalToUtcIso, londonZoneLabel, utcIsoToLondonLocal } from "./time";

describe("londonLocalToUtcIso", () => {
  it("treats winter times as GMT (UTC+0)", () => {
    expect(londonLocalToUtcIso("2026-12-01T18:00")).toBe("2026-12-01T18:00:00.000Z");
    expect(londonLocalToUtcIso("2027-01-15T09:30")).toBe("2027-01-15T09:30:00.000Z");
  });

  it("treats summer times as BST (UTC+1)", () => {
    expect(londonLocalToUtcIso("2026-10-20T18:00")).toBe("2026-10-20T17:00:00.000Z");
    expect(londonLocalToUtcIso("2027-06-01T00:30")).toBe("2027-05-31T23:30:00.000Z");
  });

  it("switches on the right side of the clock changes", () => {
    // BST ends 01:00 UTC on Sunday 25 October 2026.
    expect(londonLocalToUtcIso("2026-10-24T23:00")).toBe("2026-10-24T22:00:00.000Z");
    expect(londonLocalToUtcIso("2026-10-25T03:00")).toBe("2026-10-25T03:00:00.000Z");
    // BST starts 01:00 UTC on Sunday 28 March 2027.
    expect(londonLocalToUtcIso("2027-03-28T00:30")).toBe("2027-03-28T00:30:00.000Z");
    expect(londonLocalToUtcIso("2027-03-28T03:00")).toBe("2027-03-28T02:00:00.000Z");
  });

  it("resolves the repeated autumn hour to its first (BST) occurrence", () => {
    expect(londonLocalToUtcIso("2026-10-25T01:30")).toBe("2026-10-25T00:30:00.000Z");
  });

  it("moves the skipped spring hour forward", () => {
    // 01:30 doesn't exist on 28 March 2027 — it becomes 02:30 BST.
    const iso = londonLocalToUtcIso("2027-03-28T01:30");
    expect(iso).toBe("2027-03-28T01:30:00.000Z");
    expect(utcIsoToLondonLocal(iso)).toBe("2027-03-28T02:30");
  });

  it("accepts seconds and rejects junk", () => {
    expect(londonLocalToUtcIso("2026-12-01T18:00:30")).toBe("2026-12-01T18:00:30.000Z");
    expect(londonLocalToUtcIso("")).toBeNull();
    expect(londonLocalToUtcIso(null)).toBeNull();
    expect(londonLocalToUtcIso("tomorrow")).toBeNull();
    expect(londonLocalToUtcIso("2026-02-31T10:00")).toBeNull();
    expect(londonLocalToUtcIso("2026-13-01T10:00")).toBeNull();
  });
});

describe("utcIsoToLondonLocal", () => {
  it("round-trips through London time", () => {
    for (const local of ["2026-10-20T18:00", "2026-12-24T07:15", "2027-03-28T03:00", "2027-07-04T23:59"]) {
      expect(utcIsoToLondonLocal(londonLocalToUtcIso(local))).toBe(local);
    }
  });

  it("formats database timestamps", () => {
    expect(utcIsoToLondonLocal("2026-10-20T17:00:00+00:00")).toBe("2026-10-20T18:00");
    expect(utcIsoToLondonLocal("2026-11-20T17:00:00Z")).toBe("2026-11-20T17:00");
    expect(utcIsoToLondonLocal(null)).toBe("");
    expect(utcIsoToLondonLocal("nope")).toBe("");
  });
});

describe("londonZoneLabel", () => {
  it("names the zone in force", () => {
    expect(londonZoneLabel("2026-10-20T18:00")).toBe("BST");
    expect(londonZoneLabel("2026-11-20T18:00")).toBe("GMT");
    expect(londonZoneLabel("")).toBeNull();
  });
});
