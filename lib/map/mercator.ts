import type { GeoPoint } from "@/lib/types/replay";

export const TILE_SIZE = 256;

export interface WorldPoint {
  x: number;
  y: number;
}

export interface MapSize {
  width: number;
  height: number;
}

export interface MapTile {
  key: string;
  url: string;
  left: number;
  top: number;
}

export function toWorld({ lat, lng }: GeoPoint): WorldPoint {
  const boundedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const sin = Math.sin((boundedLat * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

export function fromWorld({ x, y }: WorldPoint): GeoPoint {
  const n = Math.PI - 2 * Math.PI * y;
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lng: x * 360 - 180,
  };
}

export function getVisibleTiles(
  centerWorld: WorldPoint,
  zoom: number,
  size: MapSize,
): MapTile[] {
  const count = 2 ** zoom;
  const scale = TILE_SIZE * count;
  const centerPixel = { x: centerWorld.x * scale, y: centerWorld.y * scale };
  const left = centerPixel.x - size.width / 2;
  const top = centerPixel.y - size.height / 2;
  const minX = Math.floor(left / TILE_SIZE);
  const maxX = Math.floor((left + size.width) / TILE_SIZE);
  const minY = Math.max(0, Math.floor(top / TILE_SIZE));
  const maxY = Math.min(count - 1, Math.floor((top + size.height) / TILE_SIZE));
  const tiles: MapTile[] = [];

  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const wrappedX = ((x % count) + count) % count;
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: x * TILE_SIZE - left,
        top: y * TILE_SIZE - top,
      });
    }
  }
  return tiles;
}

export function projectToViewport(
  point: GeoPoint,
  centerWorld: WorldPoint,
  zoom: number,
  size: MapSize,
) {
  const world = toWorld(point);
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    x: (world.x - centerWorld.x) * scale + size.width / 2,
    y: (world.y - centerWorld.y) * scale + size.height / 2,
  };
}
