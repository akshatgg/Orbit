import { describe, expect, it } from "vitest";
import {
  activeFilterChips, activeFilterCount, cleanLocation, clearFiltersHref, isSearching, parseSearchFilters, searchHref,
} from "./filters";

describe("parseSearchFilters", () => {
  it("defaults to an empty search", () => {
    const f = parseSearchFilters({});
    expect(f).toEqual({ q: "", date: null, categories: [], interests: [], formats: [], country: null, city: "", sort: "relevance" });
    expect(isSearching(f)).toBe(false);
  });

  it("keeps valid values and drops the rest", () => {
    const f = parseSearchFilters({
      q: "  case interview ",
      date: "weekend",
      category: ["workshop", "Bad Slug!", "workshop"],
      interest: ["consulting", "astrology"],
      format: ["online", "teleport"],
      price: "free", // no longer a filter: ignored
      country: "in",
      city: "Navi Mumbai, (MH)%",
      sort: "deadline",
    });
    expect(f.q).toBe("case interview");
    expect(f.date).toBe("weekend");
    expect(f.categories).toEqual(["workshop"]);
    expect(f.interests).toEqual(["consulting"]);
    expect(f.formats).toEqual(["online"]);
    expect(f).not.toHaveProperty("price");
    expect(f.country).toBe("IN");
    expect(f.city).toBe("Navi Mumbai MH");
    expect(f.sort).toBe("deadline");
    expect(activeFilterCount(f)).toBe(5);
  });

  it("accepts personal interests too, with readable chips", () => {
    const f = parseSearchFilters({ interest: ["socialising", "fitness", "consulting"] });
    expect(f.interests).toEqual(["socialising", "fitness", "consulting"]);
    expect(activeFilterChips(f, new Map()).map((c) => c.label)).toEqual(["Socialising", "Fitness & sport", "Consulting"]);
  });

  it("falls back on garbage", () => {
    const f = parseSearchFilters({ date: "yesterday", sort: "random", q: "x".repeat(500) });
    expect(f.date).toBeNull();
    expect(f.sort).toBe("relevance");
    expect(f.q).toBe("");
  });
});

describe("URLs", () => {
  const f = parseSearchFilters({ q: "finance", category: ["networking", "workshop"], format: "online", sort: "date" });

  it("round-trips through the query string", () => {
    const href = searchHref(f);
    expect(href).toBe("/search?q=finance&category=networking&category=workshop&format=online&sort=date");
    const back = parseSearchFilters(Object.fromEntries(
      [...new URL(href, "http://x").searchParams.keys()].map((k) => [k, new URL(href, "http://x").searchParams.getAll(k)]),
    ));
    expect(back).toEqual(f);
  });

  it("keeps a picked place in the URL and names it on the chip", () => {
    const place = parseSearchFilters({ country: "IN", city: "Bengaluru" });
    expect(searchHref(place)).toBe("/search?country=IN&city=Bengaluru");
    expect(activeFilterChips(place, new Map()).map((c) => c.label)).toEqual(["Bengaluru"]);
    expect(activeFilterChips(parseSearchFilters({ country: "IN" }), new Map()).map((c) => c.label)).toEqual(["India"]);
    expect(activeFilterCount(place)).toBe(1);
    expect(parseSearchFilters({ country: "India!", location: "Soho" })).toMatchObject({ country: null, city: "" });
  });

  it("builds removable chips", () => {
    const chips = activeFilterChips(f, new Map([["networking", "Networking"]]));
    expect(chips.map((c) => c.label)).toEqual(["Networking", "workshop", "Online"]);
    expect(chips[0].href).toBe("/search?q=finance&category=workshop&format=online&sort=date");
    expect(clearFiltersHref(f)).toBe("/search?q=finance&sort=date");
  });

  it("cleans location text for safe filtering", () => {
    expect(cleanLocation("King's Cross, London")).toBe("King's Cross London");
    expect(cleanLocation("*,()%")).toBe("");
  });
});
