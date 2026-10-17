// Field of view and fog of war. Visible tiles are recomputed from scratch;
// anything ever visible becomes explored and stays that way for the floor.

import { FOV } from 'rot-js';
import type { Floor, Vec } from '../game/types';

export function updateFov(floor: Floor, from: Vec, radius: number): void {
  const { width, height, tiles, visible } = floor;
  visible.fill(0);
  const lightPasses = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && tiles[y][x].terrain !== 'wall';
  const fov = new FOV.PreciseShadowcasting(lightPasses, { topology: 8 });
  fov.compute(from.x, from.y, radius, (x, y, _r, vis) => {
    if (vis <= 0 || x < 0 || y < 0 || x >= width || y >= height) return;
    visible[y * width + x] = 1;
    tiles[y][x].explored = true;
  });
}

export function isVisible(floor: Floor, x: number, y: number): boolean {
  return floor.visible[y * floor.width + x] === 1;
}
