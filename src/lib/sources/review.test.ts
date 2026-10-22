import { describe, expect, it } from "vitest";
import { daysAway, parseIdList, startsInLabel } from "./review";

describe("daysAway", () => {
  const now = new Date("2026-10-22T09:30:00Z"); // Thu 22 Oct, 10:30 in London (BST)

  it("counts calendar days in UK time, not 24-hour blocks", () => {
    expect(daysAway("2026-10-22T21:00:00Z", now)).toBe(0); // tonight
    expect(daysAway("2026-10-22T23:30:00Z", now)).toBe(1); // 00:30 on the 23rd in London
    expect(daysAway("2026-10-27T11:00:00Z", now)).toBe(5); // after the clocks go back
    expect(daysAway("2026-10-21T18:00:00Z", now)).toBe(-1);
  });
});

describe("startsInLabel", () => {
  it.each([[-2, "Started"], [0, "Today"], [1, "Tomorrow"], [5, "In 5 days"]] as const)("%i → %s", (days, label) => {
    expect(startsInLabel(days)).toBe(label);
  });
});

describe("parseIdList", () => {
  const a = "6f9619ff-8b86-d011-b42d-00c04fc964ff";
  const b = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

  it("reads a comma-separated list, dropping repeats and blanks", () => {
    expect(parseIdList(`${a}, ${b},,${a}`)).toEqual([a, b]);
  });

  it("refuses anything that isn't a list of uuids, or too many", () => {
    expect(parseIdList("")).toBeNull();
    expect(parseIdList(`${a},not-an-id`)).toBeNull();
    expect(parseIdList(null)).toBeNull();
    expect(parseIdList(`${a},${b}`, 1)).toBeNull();
  });
});
