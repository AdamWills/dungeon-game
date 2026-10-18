// Placeholder sewer fauna, drawn in code like the player. Side views facing
// right; the renderer flips them to face left.

import { type Rect, renderRects } from './spriteKit';

const SPRITES: Record<string, Rect[]> = {
  intake_rat: [
    [1, 17, 4, 1, '#d98a8a'], [3, 16, 2, 1, '#d98a8a'], // tail
    [5, 12, 11, 7, '#7a6d62'], [6, 18, 9, 1, '#5e544b'], [7, 12, 6, 2, '#8f8276'], // body
    [15, 11, 5, 6, '#7a6d62'], [20, 13, 2, 2, '#7a6d62'], [22, 14, 1, 1, '#e8a0a0'], // head, snout, nose
    [16, 9, 2, 3, '#7a6d62'], [17, 10, 1, 1, '#e8a0a0'], // ear
    [19, 12, 1, 1, '#111'], // eye
    [7, 19, 2, 2, '#5e544b'], [13, 19, 2, 2, '#5e544b'], // feet
    [15, 16, 1, 3, '#3a6ad6'], [14, 19, 3, 2, '#f0f0e8'], // lanyard and badge
  ],
  feral_intern: [
    [8, 2, 8, 2, '#3b2a1e'], [7, 4, 9, 2, '#3b2a1e'], [7, 6, 2, 3, '#3b2a1e'], // wild hair
    [9, 5, 7, 6, '#e6b892'], [13, 6, 3, 2, '#cfd8e0'], [13, 6, 1, 1, '#222'], [16, 8, 1, 1, '#d1a07a'], // face, glasses, nose
    [13, 10, 3, 1, '#7a3a2a'], // grimace
    [8, 11, 8, 7, '#e8e8e0'], [11, 11, 2, 6, '#b8242a'], // shirt and tie
    [12, 12, 6, 2, '#e8e8e0'], [17, 11, 4, 3, '#6a7078'], [17, 11, 4, 1, '#8a9098'], // arm holding stapler
    [8, 18, 3, 3, '#2e3440'], [12, 18, 3, 3, '#2e3440'], [8, 21, 3, 2, '#1a1a1a'], [12, 21, 4, 2, '#1a1a1a'],
  ],
  sludge_hopper: [
    [4, 12, 15, 8, '#5b6b2a'], [5, 11, 12, 2, '#6f8233'], [6, 20, 12, 1, '#4a5622'], // body
    [13, 8, 5, 4, '#6f8233'], [14, 9, 3, 3, '#f0e070'], [15, 10, 1, 1, '#111'], // big eye
    [17, 14, 4, 3, '#5b6b2a'], [18, 16, 4, 1, '#b84a5a'], // mouth and tongue
    [3, 18, 4, 3, '#4a5622'], [15, 19, 4, 2, '#4a5622'], // legs
    [7, 14, 2, 2, '#7d8f3e'], [10, 16, 2, 1, '#7d8f3e'], [6, 21, 1, 2, '#6f8233'], [12, 21, 1, 1, '#6f8233'], // spots, drips
  ],
  pipe_leech: [
    [2, 15, 18, 5, '#5a3a5e'], [3, 14, 15, 1, '#6e4a72'], // body
    [5, 15, 1, 5, '#4a2e4e'], [9, 15, 1, 5, '#4a2e4e'], [13, 15, 1, 5, '#4a2e4e'], // segments
    [17, 11, 6, 9, '#6e4a72'], [19, 13, 4, 5, '#2a1018'], // head and mouth
    [19, 13, 1, 1, '#f0f0e0'], [21, 13, 1, 1, '#f0f0e0'], [22, 15, 1, 1, '#f0f0e0'], [19, 17, 1, 1, '#f0f0e0'], [21, 17, 1, 1, '#f0f0e0'], // teeth
    [1, 18, 2, 2, '#5a3a5e'],
  ],
  grudge_gator: [
    [1, 15, 5, 3, '#3f6b3a'], // tail
    [5, 12, 12, 8, '#4a7d42'], [6, 11, 10, 2, '#5b9050'], [6, 19, 10, 1, '#3a5f34'], // body
    [7, 12, 1, 1, '#2e5229'], [10, 12, 1, 1, '#2e5229'], [13, 12, 1, 1, '#2e5229'], // ridges
    [16, 12, 7, 5, '#4a7d42'], [16, 16, 7, 1, '#c8c090'], // snout and jaw
    [17, 15, 1, 1, '#f0f0e0'], [19, 15, 1, 1, '#f0f0e0'], [21, 15, 1, 1, '#f0f0e0'], // teeth
    [16, 10, 3, 3, '#5b9050'], [17, 11, 1, 1, '#e8c020'], // eye bump, eye
    [6, 20, 3, 2, '#3a5f34'], [13, 20, 3, 2, '#3a5f34'],
  ],
};

export type EnemySprites = (defId: string) => HTMLCanvasElement;

export function buildEnemySprites(): EnemySprites {
  const cache = new Map<string, HTMLCanvasElement>();
  for (const [id, rects] of Object.entries(SPRITES)) cache.set(id, renderRects(rects));
  const fallback = renderRects([[6, 8, 12, 12, '#ff00ff']]);
  return (defId) => cache.get(defId) ?? fallback;
}
