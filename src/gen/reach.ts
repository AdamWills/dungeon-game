// Walkability and breadth-first distances over a floor's tiles.

import type { Floor, Terrain, Vec } from '../game/types';

const WALKABLE: Record<Terrain, boolean> = { floor: true, stairs: true, door: true, hazard: true, wall: false };

export function isWalkable(floor: Pick<Floor, 'tiles' | 'width' | 'height'>, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return WALKABLE[floor.tiles[y][x].terrain];
}

/**
 * Steps from `from` to every tile (4-way), -1 where unreachable. Flat y * width + x.
 * `avoid` marks tiles to route around (e.g. hazards); the start is never avoided.
 * Hot path on big floors: flat arrays, no allocation per step.
 */
export function bfsDistances(floor: Pick<Floor, 'tiles' | 'width' | 'height'>, from: Vec, avoid?: (x: number, y: number) => boolean): Int32Array {
  const { width, height, tiles } = floor;
  const n = width * height;
  const dist = new Int32Array(n).fill(-1);
  if (!isWalkable(floor, from.x, from.y)) return dist;
  const open = new Uint8Array(n);
  for (let y = 0; y < height; y++) {
    const row = tiles[y];
    for (let x = 0; x < width; x++) if (WALKABLE[row[x].terrain] && !avoid?.(x, y)) open[y * width + x] = 1;
  }
  const queue = new Int32Array(n);
  let tail = 0;
  const start = from.y * width + from.x;
  queue[tail++] = start;
  dist[start] = 0;
  for (let head = 0; head < tail; head++) {
    const i = queue[head];
    const x = i % width;
    const d = dist[i] + 1;
    if (x + 1 < width && open[i + 1] && dist[i + 1] === -1) (dist[i + 1] = d), (queue[tail++] = i + 1);
    if (x > 0 && open[i - 1] && dist[i - 1] === -1) (dist[i - 1] = d), (queue[tail++] = i - 1);
    if (i + width < n && open[i + width] && dist[i + width] === -1) (dist[i + width] = d), (queue[tail++] = i + width);
    if (i - width >= 0 && open[i - width] && dist[i - width] === -1) (dist[i - width] = d), (queue[tail++] = i - width);
  }
  return dist;
}

/**
 * Can this room be closed off with a door per way in? Not if a corridor runs
 * along its wall (two walkable wall-ring tiles side by side): sealing that
 * would make a line of doors (user report).
 */
export function enclosable(floor: Pick<Floor, 'tiles' | 'width' | 'height'>, room: { x1: number; y1: number; x2: number; y2: number }): boolean {
  const ring = (x: number, y: number) => (x === room.x1 - 1 || x === room.x2 + 1 || y === room.y1 - 1 || y === room.y2 + 1) && x >= room.x1 - 1 && x <= room.x2 + 1 && y >= room.y1 - 1 && y <= room.y2 + 1;
  for (let y = room.y1 - 1; y <= room.y2 + 1; y++)
    for (let x = room.x1 - 1; x <= room.x2 + 1; x++) {
      if (!ring(x, y) || !isWalkable(floor, x, y)) continue;
      if ((ring(x + 1, y) && isWalkable(floor, x + 1, y)) || (ring(x, y + 1) && isWalkable(floor, x, y + 1))) return false;
    }
  return true;
}
