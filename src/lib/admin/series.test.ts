import { describe, expect, it } from "vitest";
import { seriesEntries } from "./series";

describe("seriesEntries", () => {
  it("keeps one-off events in order and gathers each series where its first date sits", () => {
    const rows = [
      { id: "a1", series_key: "a" },
      { id: "x", series_key: null },
      { id: "a2", series_key: "a" },
      { id: "b1", series_key: "b" },
      { id: "y", series_key: null },
      { id: "a3", series_key: "a" },
      { id: "b2", series_key: "b" },
    ];
    expect(seriesEntries(rows)).toEqual([["a1", "a2", "a3"], ["x"], ["b1", "b2"], ["y"]]);
  });

  it("returns nothing for an empty listing", () => {
    expect(seriesEntries([])).toEqual([]);
  });
});
