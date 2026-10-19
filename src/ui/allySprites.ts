// The three allies and Chet Valentine's hologram portrait, drawn in code like
// everyone else. Allies are side views facing right; the renderer flips them.

import { type Rect, renderRects } from './spriteKit';

const MARJORIE = (eye: string, mouth: string): Rect[] => [
  [10, 1, 4, 2, '#b0b0b0'], [8, 2, 8, 3, '#9a9a9a'], [7, 4, 3, 4, '#9a9a9a'], // grey bun and curls
  [10, 5, 7, 5, '#e0a882'], [15, 6, 1, 1, eye], [17, 7, 1, 1, '#c8906a'], [14, 9, 3, 1, mouth], // face
  [6, 10, 12, 8, '#2e4a8a'], [6, 10, 12, 4, '#f0c020'], [6, 12, 12, 1, '#e8e8e8'], // overalls, hi-vis vest
  [15, 10, 4, 4, '#2e4a8a'], [16, 13, 4, 4, '#e0a882'], [17, 16, 3, 2, '#d0986e'], // big arm
  [7, 18, 4, 3, '#24386a'], [12, 18, 4, 3, '#24386a'], [7, 21, 5, 2, '#5a3a1a'], [12, 21, 5, 2, '#5a3a1a'], // legs, boots
];

const SPRITES: Record<string, Rect[]> = {
  marjorie: MARJORIE('#111', '#7a3a2a'),
  marjorie_grievance: MARJORIE('#ff2a1a', '#ff2a1a'),
  moss: [
    [11, 1, 5, 1, '#5a5a5a'], [12, 1, 3, 2, '#c8d0d8'], [13, 2, 1, 1, '#ffffff'], // head mirror
    [10, 3, 6, 6, '#d8c0a0'], [9, 4, 1, 3, '#8a8a8a'], [14, 5, 1, 1, '#111'], [16, 6, 1, 2, '#c0a080'], [11, 8, 5, 1, '#8a7a6a'], // head, stubble
    [9, 9, 7, 11, '#e8e8e0'], [9, 9, 1, 11, '#c8c8c0'], [10, 14, 2, 2, '#8aa040'], [13, 11, 1, 2, '#a04040'], // stained lab coat
    [14, 10, 2, 6, '#d8d8d0'], [15, 15, 2, 2, '#d8c0a0'], [17, 13, 4, 1, '#a0e0f0'], [21, 13, 2, 1, '#c0c0c0'], // arm, syringe
    [10, 20, 2, 2, '#3a3a4a'], [13, 20, 2, 2, '#3a3a4a'], [10, 22, 3, 1, '#1a1a1a'], [13, 22, 3, 1, '#1a1a1a'],
  ],
  skitch: [
    [2, 18, 4, 1, '#d98a8a'], [4, 17, 2, 1, '#d98a8a'], // tail
    [6, 11, 8, 9, '#8a7d70'], [9, 13, 4, 6, '#a89a8a'], // body, belly
    [10, 6, 7, 6, '#8a7d70'], [17, 8, 3, 3, '#8a7d70'], [20, 9, 1, 1, '#e8a0a0'], // head, snout, nose
    [11, 3, 3, 3, '#8a7d70'], [12, 4, 1, 1, '#e8a0a0'], [15, 7, 1, 1, '#111'], [18, 11, 2, 1, '#cccccc'], // ear, eye, whiskers
    [10, 11, 6, 1, '#c8282a'], // bandana
    [13, 13, 7, 3, '#e8a020'], [19, 13, 2, 2, '#404040'], [14, 16, 2, 2, '#303030'], [13, 14, 1, 2, '#d98a8a'], // nail gun
    [7, 20, 2, 3, '#6e6258'], [11, 20, 2, 3, '#6e6258'],
  ],
};

/** The same rects, for the enemy sprite table (Skitch before he defects, Marjorie after). */
export const ALLY_ENEMY_RECTS: Record<string, Rect[]> = { skitch: SPRITES.skitch, marjorie_grievance: SPRITES.marjorie_grievance };

export type AllySprites = (defId: string) => HTMLCanvasElement;

export function buildAllySprites(): AllySprites {
  const cache = new Map<string, HTMLCanvasElement>();
  for (const [id, rects] of Object.entries(SPRITES)) cache.set(id, renderRects(rects));
  const fallback = renderRects([[6, 8, 12, 12, '#00ffff']]);
  return (defId) => cache.get(defId) ?? fallback;
}

/** Chet Valentine: pompadour, tan, teeth, velvet. Facing you, as hosts do. */
const CHET: Rect[] = [
  [5, 1, 14, 4, '#3a2414'], [4, 3, 3, 4, '#3a2414'], [17, 3, 3, 4, '#3a2414'], [8, 1, 6, 1, '#6a4424'], // the hair
  [6, 4, 12, 10, '#d8905a'], [6, 12, 12, 2, '#c07a48'], // face
  [8, 6, 3, 1, '#3a2414'], [13, 6, 3, 1, '#3a2414'], [9, 7, 1, 1, '#111'], [14, 7, 1, 1, '#111'], [11, 8, 2, 2, '#c07a48'], // brows, eyes, nose
  [8, 10, 8, 2, '#ffffff'], [10, 10, 1, 2, '#d8d8e0'], [13, 10, 1, 2, '#d8d8e0'], [8, 12, 8, 1, '#a05030'], // the teeth
  [10, 14, 4, 2, '#c07a48'],
  [3, 16, 18, 8, '#6a1a4a'], [8, 16, 2, 6, '#8a2a6a'], [14, 16, 2, 6, '#8a2a6a'], [10, 16, 4, 6, '#fff0f0'], // velvet suit
  [9, 16, 6, 2, '#ffd23a'], [11, 16, 2, 2, '#c8a010'], // bow tie
];

export function buildChetPortrait(): HTMLCanvasElement {
  return renderRects(CHET);
}
