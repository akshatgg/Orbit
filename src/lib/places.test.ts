import { describe, expect, it } from "vitest";
import { canonicalCity, cityVariants, countryFlag, countryName, groupPlaces, knownCityNames, normaliseCountry, placeOf } from "./places";

describe("normaliseCountry", () => {
  it("reads codes in any case and country names", () => {
    expect(normaliseCountry("gb")).toBe("GB");
    expect(normaliseCountry("IN")).toBe("IN");
    expect(normaliseCountry("United Kingdom")).toBe("GB");
    expect(normaliseCountry("india")).toBe("IN");
    expect(normaliseCountry("UK")).toBe("GB");
    expect(normaliseCountry("England")).toBe("GB");
  });
  it("rejects anything that isn't a country", () => {
    expect(normaliseCountry("")).toBeNull();
    expect(normaliseCountry(null)).toBeNull();
    expect(normaliseCountry("ZZ")).toBeNull();
    expect(normaliseCountry("Narnia")).toBeNull();
  });
});

describe("cities", () => {
  it("merges other spellings into one name", () => {
    expect(canonicalCity("Bangalore")).toBe("Bengaluru");
    expect(canonicalCity("new delhi")).toBe("Delhi");
    expect(canonicalCity("  Gurgaon ")).toBe("Gurugram");
    expect(canonicalCity("Mohali")).toBe("Mohali");
    expect(canonicalCity("Some  Town")).toBe("Some Town");
  });
  it("matches every spelling of a picked city", () => {
    expect(cityVariants("Bengaluru")).toEqual(["Bengaluru", "Bangalore"]);
    expect(cityVariants("Some Town")).toEqual(["Some Town"]);
    expect(knownCityNames("IN")).toContain("New Delhi");
    expect(knownCityNames("GB")).toContain("London");
  });
  it("finds the country from the event, else from a known city", () => {
    expect(placeOf("Mohali", "in")).toEqual({ country: "IN", city: "Mohali" });
    expect(placeOf("Bangalore", null)).toEqual({ country: "IN", city: "Bengaluru" });
    expect(placeOf("London", null)).toEqual({ country: "GB", city: "London" });
    expect(placeOf("Some Town", null)).toEqual({ country: null, city: "Some Town" });
    expect(placeOf(null, "GB")).toEqual({ country: "GB", city: null });
  });
  it("names and flags countries", () => {
    expect(countryName("IN")).toBe("India");
    expect(countryName("GB")).toBe("United Kingdom");
    expect(countryFlag("IN")).toBe("🇮🇳");
  });
});

describe("groupPlaces", () => {
  it("groups by country, then city, biggest first, counting a series once", () => {
    const groups = groupPlaces([
      { id: "1", city: "London", country: null },
      { id: "2", city: "London", country: "GB" },
      { id: "3", city: "Manchester", country: "GB" },
      { id: "4", city: "Bangalore", country: null },
      { id: "5", city: "Bengaluru", country: "IN" },
      { id: "6", city: "Delhi", country: "IN" },
      { id: "7", city: "Hyderabad", country: "IN", series_key: "s" },
      { id: "8", city: "Hyderabad", country: "IN", series_key: "s" },
      { id: "9", city: "Some Town", country: null },
      { id: "10", city: null, country: null },
    ]);
    expect(groups).toEqual([
      { country: "IN", name: "India", flag: "🇮🇳", count: 4, cities: [{ city: "Bengaluru", count: 2 }, { city: "Delhi", count: 1 }, { city: "Hyderabad", count: 1 }] },
      { country: "GB", name: "United Kingdom", flag: "🇬🇧", count: 3, cities: [{ city: "London", count: 2 }, { city: "Manchester", count: 1 }] },
      { country: null, name: "Other places", flag: "", count: 1, cities: [{ city: "Some Town", count: 1 }] },
    ]);
  });
});
