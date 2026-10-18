// Props drawn in code, in the same style as the characters (24px box,
// outlined, standing on the bottom of their tile).

import { type Rect, renderRects } from './spriteKit';

const SPRITES: Record<string, Rect[]> = {
  barrel: [
    [6, 10, 12, 14, '#8a5a2a'], [7, 9, 10, 2, '#a8743a'], [6, 12, 12, 1, '#4a3a2a'], [6, 17, 12, 1, '#4a3a2a'], [6, 21, 12, 1, '#4a3a2a'],
    [9, 13, 1, 8, '#a8743a'],
  ],
  vending_machine: [
    [5, 2, 14, 22, '#b8322a'], [6, 3, 12, 1, '#d84a3a'], [7, 5, 7, 10, '#2a3a44'],
    [8, 6, 2, 2, '#e8c040'], [11, 6, 2, 2, '#6ab0f0'], [8, 9, 2, 2, '#9fd68a'], [11, 9, 2, 2, '#e86a20'], [8, 12, 2, 2, '#e8e0d0'],
    [15, 5, 3, 1, '#e8e0d0'], [15, 7, 3, 1, '#e8e0d0'], [15, 9, 3, 1, '#e8e0d0'], [7, 18, 8, 3, '#141414'],
  ],
  fire_extinguisher: [
    [9, 9, 6, 15, '#d03a2a'], [10, 8, 4, 1, '#e85a4a'], [10, 5, 4, 3, '#2a2a2a'], [14, 6, 3, 1, '#2a2a2a'], [16, 7, 1, 7, '#2a2a2a'],
    [10, 14, 4, 4, '#e8e0d0'], [11, 15, 2, 1, '#d03a2a'],
  ],
  folding_chair: [
    [7, 5, 10, 1, '#9aa0a8'], [7, 5, 1, 11, '#9aa0a8'], [16, 5, 1, 11, '#9aa0a8'], [8, 7, 8, 5, '#6a7078'],
    [6, 15, 12, 2, '#b8bec6'], [7, 17, 1, 7, '#9aa0a8'], [16, 17, 1, 7, '#9aa0a8'], [9, 17, 1, 6, '#6a7078'], [14, 17, 1, 6, '#6a7078'],
  ],
  corpse: [[4, 18, 16, 5, '#7a1414'], [6, 16, 5, 3, '#b02a2a'], [13, 17, 4, 2, '#b02a2a'], [9, 19, 6, 1, '#e8e0d0']],
  sludge_puddle: [[3, 18, 18, 5, '#5a8c28'], [5, 17, 12, 2, '#6aa030'], [7, 19, 2, 1, '#a0d060'], [14, 20, 2, 1, '#a0d060']],
};

export type PropSprites = (defId: string) => HTMLCanvasElement;

export function buildPropSprites(): PropSprites {
  const cache = new Map(Object.entries(SPRITES).map(([id, r]) => [id, renderRects(r)]));
  return (defId) => cache.get(defId)!;
}
