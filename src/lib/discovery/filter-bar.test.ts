import { describe, expect, it } from "vitest";
import { clearKeyHref, isActive, pickHref, pillLabel, showClearAll } from "./filter-bar";
import { parseSearchFilters } from "./filters";

const cats = [{ value: "workshop", label: "Workshop" }, { value: "talk", label: "Talk" }, { value: "social", label: "Social" }];
const f = (raw: Record<string, string | string[]>) => parseSearchFilters(raw);

describe("pillLabel", () => {
  it("shows the title when inactive", () => {
    expect(pillLabel(f({}), "date", cats)).toBe("When");
    expect(pillLabel(f({}), "sort", cats)).toBe("Sort");
  });
  it("shows the value when active", () => {
    expect(pillLabel(f({ date: "weekend" }), "date", cats)).toBe("This weekend");
    expect(pillLabel(f({ category: "workshop" }), "category", cats)).toBe("Workshop");
    expect(pillLabel(f({ category: ["workshop", "talk", "social"] }), "category", cats)).toBe("Workshop +2");
    expect(pillLabel(f({ location: "Kensington" }), "location", cats)).toBe("Kensington");
    expect(pillLabel(f({ sort: "date" }), "sort", cats)).toBe("Date");
  });
});

describe("pickHref", () => {
  it("sets and unsets single values, keeping q", () => {
    expect(pickHref(f({ q: "ai" }), "date", "week")).toBe("/search?q=ai&date=week");
    expect(pickHref(f({ date: "week" }), "date", "week")).toBe("/search");
  });
  it("toggles multi values", () => {
    expect(pickHref(f({ category: "workshop" }), "category", "talk")).toBe("/search?category=workshop&category=talk");
    expect(pickHref(f({ category: ["workshop", "talk"] }), "category", "talk")).toBe("/search?category=workshop");
  });
  it("sort and location", () => {
    expect(pickHref(f({}), "sort", "date")).toBe("/search?sort=date");
    expect(pickHref(f({ sort: "date" }), "sort", "relevance")).toBe("/search");
    expect(pickHref(f({}), "location", " South  Ken!! ")).toBe("/search?location=South+Ken");
  });
});

describe("clearKeyHref / showClearAll", () => {
  it("clears only one filter", () => {
    const s = f({ q: "x", date: "today", format: "online", category: ["workshop", "talk"] });
    expect(clearKeyHref(s, "category")).toBe("/search?q=x&date=today&format=online");
    expect(clearKeyHref(s, "date")).toBe("/search?q=x&category=workshop&category=talk&format=online");
  });
  it("flags active state", () => {
    expect(isActive(f({}), "sort")).toBe(false);
    expect(showClearAll(f({ sort: "date" }))).toBe(false);
    expect(showClearAll(f({ format: "online" }))).toBe(true);
  });
});
