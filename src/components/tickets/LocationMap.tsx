/* eslint-disable @next/next/no-img-element */
import { MAP_ZOOM, OSM_COPYRIGHT, TILE_SIZE, mapPlaceLabel, staticMapTiles, type MapPlace } from "@/lib/tickets/map";

/**
 * A static OpenStreetMap preview: nine standard tiles with a pin on the venue. No iframe, no
 * WebGL and no key, so it renders on every device. Tiles load lazily; attribution is required.
 */
export function LocationMap({ place, className = "" }: { place: MapPlace; className?: string }) {
  const map = staticMapTiles(place);
  const label = mapPlaceLabel(place);
  if (!map || !label) return null;

  return (
    <div
      role="group"
      aria-label={`Map of ${label}`}
      className={`relative h-44 overflow-clip rounded-[16px] border border-line bg-[#e9e5dc] sm:h-52 ${className}`}
    >
      <div
        className="absolute h-[768px] w-[768px] select-none"
        style={{ left: `calc(50% - ${TILE_SIZE + map.offsetX}px)`, top: `calc(50% - ${TILE_SIZE + map.offsetY}px)` }}
        aria-hidden
      >
        {map.tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            width={TILE_SIZE}
            height={TILE_SIZE}
            loading="lazy"
            draggable={false}
            className="absolute h-64 w-64 select-none"
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
      </div>

      {/* Pin */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-[0_0_0_5px_rgb(0_0_0/0.18)]"
      />
      <a
        href={OSM_COPYRIGHT}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-1 right-1 rounded bg-bg/85 px-1.5 py-0.5 text-[9px] text-muted backdrop-blur transition-colors hover:text-fg"
      >
        © OpenStreetMap
      </a>

      <span className="sr-only">Map data © OpenStreetMap contributors, zoom {MAP_ZOOM}.</span>
    </div>
  );
}
