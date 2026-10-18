// The 0x72 DungeonTileset II sheet (CC0, see src/assets/0x72/LICENSE.md),
// loaded once at startup. Map tiles are 16x16; taller sprites are drawn
// bottom-aligned to their tile.

import sheetUrl from '../assets/0x72/sheet.png';
import tileList from '../assets/0x72/tile_list.txt?raw';
import { parseTileList, type SheetRect } from './tileset';

/** Map grid size in art pixels. */
export const TILE = 16;
/** Box size of our hand-drawn character sprites (they stand taller than a tile). */
export const SPRITE = 24;

export type Atlas = {
  image: HTMLImageElement;
  rect: (name: string) => SheetRect;
  /** Draw a sprite with its bottom edge on the bottom of the tile at (x, y). */
  draw: (ctx: CanvasRenderingContext2D, name: string, x: number, y: number) => void;
};

export async function loadAtlas(): Promise<Atlas> {
  const image = new Image();
  image.src = sheetUrl;
  await image.decode();
  const rects = parseTileList(tileList);
  const rect = (name: string) => {
    const r = rects.get(name);
    if (!r) throw new Error(`Unknown sprite: ${name}`);
    return r;
  };
  return {
    image,
    rect,
    draw: (ctx, name, x, y) => {
      const r = rect(name);
      ctx.drawImage(image, r.x, r.y, r.w, r.h, x + (TILE - r.w) / 2, y + TILE - r.h, r.w, r.h);
    },
  };
}
