// Walkability and breadth-first distances over a floor's tiles.

import type { Floor, Terrain, Vec } from '../game/types';

const WALKABLE: Record<Terrain, boolean> = { floor: true, stairs: true, door: true, hazard: true, wall: false };

export function isWalkable(floor: Pick<Floor, 'tiles' | 'width' | 'height'>, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= floor.width || y >= floor.height) return false;
  return WALKABLE[floor.tiles[y][x].terrain];
}

/** Steps from `from` to every tile (4-way), -1 where unreachable. Flat y * width + x. */
export function bfsDistances(floor: Pick<Floor, 'tiles' | 'width' | 'height'>, from: Vec): Int32Array {
  const { width, height } = floor;
  const dist = new Int32Array(width * height).fill(-1);
  if (!isWalkable(floor, from.x, from.y)) return dist;
  const queue = [from.y * width + from.x];
  dist[queue[0]] = 0;
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % width;
    const y = (i - x) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isWalkable(floor, nx, ny)) continue;
      const ni = ny * width + nx;
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[i] + 1;
      queue.push(ni);
    }
  }
  return dist;
}
