// Static OpenStreetMap preview for the event page. No API key and no WebGL: the browser loads
// a 3×3 grid of standard OSM tiles and we centre a pin on the venue.

export type MapPlace = {
  latitude?: number | null;
  longitude?: number | null;
  venue?: string | null;
  address?: string | null;
  city?: string | null;
};

export const OSM_COPYRIGHT = "https://www.openstreetmap.org/copyright";
export const TILE_SIZE = 256;
export const MAP_ZOOM = 17;

/** A usable point: both numbers, in range. */
export function hasMapPoint(place: MapPlace): boolean {
  return (
    typeof place.latitude === "number" &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    Math.abs(place.latitude) <= 90 &&
    Math.abs(place.longitude) <= 180
  );
}

/** A human-readable place, used for the "Open in Maps" link and the map label. */
export function mapPlaceLabel(place: MapPlace): string | null {
  const parts = [place.venue, place.address, place.city]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part);
  return parts.length ? parts.join(", ") : null;
}

export type MapTile = { key: string; src: string; left: number; top: number };

/** Tiles for a 3×3 grid and the pixel offset of the venue within the centre tile. */
export function staticMapTiles(place: MapPlace, zoom = MAP_ZOOM): { tiles: MapTile[]; offsetX: number; offsetY: number } | null {
  if (!hasMapPoint(place)) return null;
  const latitude = place.latitude as number;
  const longitude = place.longitude as number;

  const n = 2 ** zoom;
  const latRad = (latitude * Math.PI) / 180;
  const x = ((longitude + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const centreX = Math.floor(x);
  const centreY = Math.floor(y);
  const offsetX = (x - centreX) * TILE_SIZE;
  const offsetY = (y - centreY) * TILE_SIZE;

  const tiles: MapTile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = centreX + dx;
      const ty = centreY + dy;
      if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        src: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
        left: (dx + 1) * TILE_SIZE,
        top: (dy + 1) * TILE_SIZE,
      });
    }
  }
  return { tiles, offsetX, offsetY };
}
