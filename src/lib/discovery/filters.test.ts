import { describe, expect, it } from "vitest";
import {
  activeFilterChips, activeFilterCount, cleanLocation, clearFiltersHref, isSearching, parseSearchFilters, searchHref,
} from "./filters";

describe("parseSearchFilters", () => {
  it("defaults to an empty search", () => {
    const f = parseSearchFilters({});
    expect(f).toEqual({ q: "", date: null, categories: [], interests: [], formats: [], price: null, location: "", sort: "relevance" });
    expect(isSearching(f)).toBe(false);
  });

  it("keeps valid values and drops the rest", () => {
    const f = parseSearchFilters({
      q: "  case interview ",
      date: "weekend",
      category: ["workshop", "Bad Slug!", "workshop"],
      interest: ["consulting", "astrology"],
      format: ["online", "teleport"],
      price: "free",
      location: "South Ken, (SW7)%",
      sort: "deadline",
    });
    expect(f.q).toBe("case interview");
    expect(f.date).toBe("weekend");
    expect(f.categories).toEqual(["workshop"]);
    expect(f.interests).toEqual(["consulting"]);
    expect(f.formats).toEqual(["online"]);
    expect(f.price).toBe("free");
    expect(f.location).toBe("South Ken SW7");
    expect(f.sort).toBe("deadline");
    expect(activeFilterCount(f)).toBe(6);
  });

  it("falls back on garbage", () => {
    const f = parseSearchFilters({ date: "yesterday", price: "cheap", sort: "random", q: "x".repeat(500) });
    expect(f.date).toBeNull();
    expect(f.price).toBeNull();
    expect(f.sort).toBe("relevance");
    expect(f.q).toBe("");
  });
});

describe("URLs", () => {
  const f = parseSearchFilters({ q: "finance", category: ["networking", "workshop"], price: "paid", sort: "date" });

  it("round-trips through the query string", () => {
    const href = searchHref(f);
    expect(href).toBe("/search?q=finance&category=networking&category=workshop&price=paid&sort=date");
    const back = parseSearchFilters(Object.fromEntries(
      [...new URL(href, "http://x").searchParams.keys()].map((k) => [k, new URL(href, "http://x").searchParams.getAll(k)]),
    ));
    expect(back).toEqual(f);
  });

  it("builds removable chips", () => {
    const chips = activeFilterChips(f, new Map([["networking", "Networking"]]));
    expect(chips.map((c) => c.label)).toEqual(["Networking", "workshop", "Paid"]);
    expect(chips[0].href).toBe("/search?q=finance&category=workshop&price=paid&sort=date");
    expect(clearFiltersHref(f)).toBe("/search?q=finance&sort=date");
  });

  it("cleans location text for safe filtering", () => {
    expect(cleanLocation("King's Cross, London")).toBe("King's Cross London");
    expect(cleanLocation("*,()%")).toBe("");
  });
});
