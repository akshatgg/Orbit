import { describe, expect, it } from "vitest";
import { buildEventStats, countByStatus, countCheckedIn, percent, registrationsByDay } from "./stats";
import { labelledAnswers, formatAnswer } from "./answers";
import { filterGuests } from "./filter";
import type { Guest } from "./types";

const reg = (status: Guest["status"], registeredAt: string, checkedInAt: string | null = null) => ({
  status, registeredAt, checkedInAt,
});

describe("countByStatus", () => {
  it("counts every status, including zeros", () => {
    const counts = countByStatus([reg("going", "2026-10-01T00:00:00Z"), reg("going", "2026-10-01T00:00:00Z"), reg("pending", "2026-10-01T00:00:00Z")]);
    expect(counts).toEqual({ going: 2, pending: 1, waitlisted: 0, awaiting_payment: 0, declined: 0, cancelled: 0 });
  });
});

describe("countCheckedIn", () => {
  it("only counts confirmed guests with a check-in time", () => {
    expect(countCheckedIn([
      reg("going", "x", "2026-10-01T18:00:00Z"),
      reg("going", "x"),
      reg("cancelled", "x", "2026-10-01T18:00:00Z"),
    ])).toBe(1);
  });
});

describe("percent", () => {
  it("rounds and handles zero", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBeNull();
  });
});

describe("registrationsByDay", () => {
  const now = new Date("2026-10-16T10:00:00Z");

  it("returns the last N UK days, oldest first, with zeros", () => {
    const days = registrationsByDay([], 14, now);
    expect(days).toHaveLength(14);
    expect(days[0].key).toBe("2026-10-03");
    expect(days[13].key).toBe("2026-10-16");
    expect(days[13].label).toBe("Fri 16 Oct");
    expect(days.every((d) => d.count === 0)).toBe(true);
  });

  it("buckets by UK date and drops older registrations", () => {
    const days = registrationsByDay([
      { registeredAt: "2026-10-15T23:30:00Z" }, // 00:30 BST on the 16th
      { registeredAt: "2026-10-16T09:00:00Z" },
      { registeredAt: "2026-10-03T12:00:00Z" },
      { registeredAt: "2026-09-01T12:00:00Z" },
    ], 14, now);
    expect(days[13].count).toBe(2);
    expect(days[0].count).toBe(1);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(3);
  });

  it("never skips or repeats a day across the clocks going back", () => {
    const days = registrationsByDay([], 14, new Date("2026-10-26T00:30:00Z"));
    const keys = days.map((d) => d.key);
    expect(new Set(keys).size).toBe(14);
    expect(keys).toContain("2026-10-25");
    expect(keys[13]).toBe("2026-10-26");
  });
});

describe("buildEventStats", () => {
  const regs = [
    reg("going", "2026-10-16T09:00:00Z", "2026-10-16T18:00:00Z"),
    reg("going", "2026-10-15T09:00:00Z"),
    reg("pending", "2026-10-15T09:00:00Z"),
    reg("awaiting_payment", "2026-10-14T09:00:00Z"),
    reg("cancelled", "2026-10-14T09:00:00Z"),
  ];

  it("aggregates counts, capacity and conversion", () => {
    const s = buildEventStats(regs, { views: 50, applyClicks: 0, capacity: 10, mode: "tickets", now: new Date("2026-10-16T12:00:00Z") });
    expect(s.total).toBe(5);
    expect(s.active).toBe(4);
    expect(s.checkedIn).toBe(1);
    expect(s.capacity).toEqual({ cap: 10, going: 2, held: 2, percent: 40 });
    expect(s.conversion).toBe(10);
    expect(s.byDay.at(-1)?.count).toBe(1);
  });

  it("uses Apply-now clicks for external events and caps capacity at 100%", () => {
    const s = buildEventStats(regs, { views: 8, applyClicks: 2, capacity: 2, mode: "external" });
    expect(s.conversion).toBe(25);
    expect(s.capacity?.percent).toBe(100);
  });

  it("has no capacity or conversion without data", () => {
    const s = buildEventStats([], { views: 0, applyClicks: 0, capacity: null, mode: "tickets" });
    expect(s.capacity).toBeNull();
    expect(s.conversion).toBeNull();
  });
});

describe("answers", () => {
  it("formats every answer kind", () => {
    expect(formatAnswer(["A", "B"])).toBe("A, B");
    expect(formatAnswer(true)).toBe("Yes");
    expect(formatAnswer(false)).toBe("No");
    expect(formatAnswer("  hi ")).toBe("hi");
    expect(formatAnswer(null)).toBe("");
  });

  it("labels answers in question order and keeps orphans", () => {
    const rows = labelledAnswers({ b: "two", a: "one", gone: "old", empty: "" }, [
      { id: "a", label: "First?", kind: "short_text" },
      { id: "b", label: "Second?", kind: "short_text" },
      { id: "c", label: "Unanswered?", kind: "short_text" },
    ]);
    expect(rows).toEqual([
      { id: "a", label: "First?", answer: "one" },
      { id: "b", label: "Second?", answer: "two" },
      { id: "gone", label: "gone", answer: "old" },
    ]);
  });
});

describe("filterGuests", () => {
  const guests = [
    { name: "Zoë Adams", email: "zoe@imperial.ac.uk", status: "going" as const, checkedInAt: "2026-10-16T18:00:00Z" },
    { name: "Ben Ito", email: "ben@example.com", status: "going" as const, checkedInAt: null },
    { name: null, email: "pat@example.com", status: "pending" as const, checkedInAt: null },
  ];

  it("filters by status, checked in and search (accent-insensitive)", () => {
    expect(filterGuests(guests, { status: "going" })).toHaveLength(2);
    expect(filterGuests(guests, { status: "checked_in" })).toHaveLength(1);
    expect(filterGuests(guests, { query: "zoe" })[0].name).toBe("Zoë Adams");
    expect(filterGuests(guests, { query: "PAT@" })).toHaveLength(1);
    expect(filterGuests(guests, { status: "pending", query: "ben" })).toHaveLength(0);
  });
});
