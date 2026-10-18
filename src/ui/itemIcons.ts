// 16x16 item icons: hand-drawn per kind of item, tinted by what it does,
// with 0x72 flasks and the bomb where they fit.

import { ITEMS, type ItemDef } from '../data/items';
import type { Atlas } from './atlas';
import { type Rect, renderRects } from './spriteKit';

const ICON = 16;

const SHAPES: Record<string, Rect[]> = {
  weapon: [[3, 11, 2, 2, '#6a4a2a'], [4, 10, 2, 2, '#6a4a2a'], [5, 9, 2, 2, '#8a8a90'], [6, 8, 2, 2, '#8a8a90'], [7, 7, 2, 2, '#a0a0a8'], [8, 6, 2, 2, '#a0a0a8'], [9, 5, 2, 2, '#b8b8c0'], [10, 4, 2, 2, '#c8c8d0'], [11, 3, 2, 2, '#d8d8e0']],
  armor: [[4, 4, 8, 9, '#c86a3a'], [2, 4, 3, 4, '#c86a3a'], [11, 4, 3, 4, '#c86a3a'], [6, 4, 4, 2, '#e8e0d0'], [7, 6, 2, 7, '#a8542a']],
  trinket: [[6, 3, 4, 2, '#e8c040'], [5, 5, 6, 6, '#e8c040'], [7, 7, 2, 2, '#fff2a0'], [6, 11, 4, 2, '#c09a20']],
  junk: [[3, 6, 10, 7, '#8a7a5a'], [3, 5, 10, 2, '#a8946a'], [6, 8, 4, 2, '#5a4a32']],
  chicken: [[3, 7, 9, 4, '#f0d040'], [11, 5, 3, 3, '#f0d040'], [13, 6, 2, 1, '#e86a20'], [12, 4, 1, 1, '#e84040'], [4, 11, 1, 3, '#e86a20'], [8, 11, 1, 3, '#e86a20']],
  check: [[1, 5, 14, 7, '#e8f0e0'], [2, 6, 5, 1, '#3a7a3a'], [9, 9, 5, 1, '#3a3a3a'], [2, 9, 3, 1, '#3a7a3a']],
  jar: [[5, 3, 6, 2, '#a0a0a0'], [4, 5, 8, 9, '#a8d0c8'], [6, 7, 4, 4, '#e8b890'], [7, 8, 1, 1, '#222'], [9, 8, 1, 1, '#222']],
  sandwich: [[2, 6, 12, 2, '#d8a858'], [2, 8, 12, 2, '#6aa84a'], [2, 10, 12, 2, '#d8a858']],
  scroll: [[3, 3, 10, 10, '#e8dcb0'], [3, 3, 10, 2, '#b89a60'], [3, 11, 10, 2, '#b89a60'], [5, 6, 6, 1, '#7a3a8a'], [5, 8, 5, 1, '#7a3a8a']],
};

/** Per-item overrides: a hand-drawn shape or a 0x72 sprite name. */
const OVERRIDES: Record<string, { shape?: string; sprite?: string }> = {
  rubber_chicken: { shape: 'chicken' },
  giant_novelty_check: { shape: 'check' },
  previous_contestant_jar: { shape: 'jar' },
  craft_services_sandwich: { shape: 'sandwich' },
  hex_scroll: { shape: 'scroll' },
  pipe_bomb: { sprite: 'bomb_f0' },
  glitter_bomb: { sprite: 'bomb_f1' },
};

function flaskFor(def: ItemDef): string {
  const effects = def.use?.effects ?? [];
  if (effects.some((e) => e.kind === 'status' && e.status === 'burning')) return 'flask_big_red';
  if (effects.some((e) => e.kind === 'status')) return 'flask_yellow';
  if (effects.some((e) => e.kind === 'cleanse')) return 'flask_green';
  if (effects.some((e) => e.kind === 'heal')) return 'flask_red';
  return 'flask_blue';
}

export type ItemIcons = (ctx: CanvasRenderingContext2D, defId: string, x: number, y: number, scale?: number) => void;

export function buildItemIcons(atlas: Atlas): ItemIcons {
  const shapes = new Map(Object.entries(SHAPES).map(([k, r]) => [k, renderRects(r, ICON)]));
  return (ctx, defId, x, y, scale = 1) => {
    const def = ITEMS[defId];
    const o = OVERRIDES[defId] ?? {};
    let sprite = o.sprite;
    let shape = o.shape;
    if (!sprite && !shape) {
      if (def?.slot) shape = def.slot;
      else if (def?.use) sprite = flaskFor(def);
      else shape = 'junk';
    }
    if (sprite) {
      const r = atlas.rect(sprite);
      ctx.drawImage(atlas.image, r.x, r.y, r.w, r.h, x + (ICON - r.w) * scale / 2, y + (ICON - r.h) * scale, r.w * scale, r.h * scale);
    } else ctx.drawImage(shapes.get(shape!)!, x, y, ICON * scale, ICON * scale);
  };
}
