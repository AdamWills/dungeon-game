// Tiny pixel-art kit: draw a list of rectangles into a SPRITE x SPRITE canvas and
// wrap the result in a 1px dark outline so it reads on any floor.

import { SPRITE } from './atlas';

export type Rect = [x: number, y: number, w: number, h: number, color: string];

const OUTLINE = '#120d0a';

export function renderRects(rects: Rect[]): HTMLCanvasElement {
  const body = document.createElement('canvas');
  body.width = body.height = SPRITE;
  const g = body.getContext('2d')!;
  for (const [x, y, w, h, color] of rects) {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }
  const alpha = g.getImageData(0, 0, SPRITE, SPRITE).data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < SPRITE && y < SPRITE && alpha[(y * SPRITE + x) * 4 + 3] > 0;

  const out = document.createElement('canvas');
  out.width = out.height = SPRITE;
  const o = out.getContext('2d')!;
  o.fillStyle = OUTLINE;
  for (let y = 0; y < SPRITE; y++)
    for (let x = 0; x < SPRITE; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) o.fillRect(x, y, 1, 1);
  o.drawImage(body, 0, 0);
  return out;
}
