// Tile line of sight (Bresenham). Walls block; doors are open archways for now.

import type { Floor, Vec } from '../game/types';

export function lineOfSight(floor: Floor, a: Vec, b: Vec): boolean {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    if (x0 === x1 && y0 === y1) return true;
    if (floor.tiles[y0]?.[x0]?.terrain === 'wall' || floor.tiles[y0]?.[x0] === undefined) return false;
  }
}
