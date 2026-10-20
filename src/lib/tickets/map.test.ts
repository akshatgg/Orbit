import { describe, expect, it } from "vitest";
import { hasMapPoint, mapPlaceLabel, staticMapTiles } from "./map";

describe("map", () => {
  it("accepts valid coordinates and rejects bad ones", () => {
    expect(hasMapPoint({ latitude: 51.52, longitude: -0.09 })).toBe(true);
    expect(hasMapPoint({ latitude: 200, longitude: -0.09 })).toBe(false);
    expect(hasMapPoint({ latitude: 51.52, longitude: null })).toBe(false);
  });

  it("builds a 3×3 OpenStreetMap tile grid around the venue", () => {
    const map = staticMapTiles({ latitude: 51.522907, longitude: -0.101072 })!;
    expect(map.tiles).toHaveLength(9);
    expect(map.tiles[4]).toEqual({
      key: "17/65499/43575",
      src: "https://tile.openstreetmap.org/17/65499/43575.png",
      left: 256,
      top: 256,
    });
    expect(map.offsetX).toBeCloseTo(51.41, 2);
    expect(map.offsetY).toBeCloseTo(182.46, 2);
  });

  it("returns null without coordinates and describes the place", () => {
    expect(staticMapTiles({ venue: "Codurance", address: "3 Sutton Lane", city: "London" })).toBeNull();
    expect(mapPlaceLabel({ venue: "Codurance", address: "3 Sutton Lane", city: "London" })).toBe("Codurance, 3 Sutton Lane, London");
    expect(mapPlaceLabel({})).toBeNull();
  });
});
