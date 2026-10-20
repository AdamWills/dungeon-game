// The contestant: orange intake jumpsuit, numbered badge, bad haircut. Drawn in
// code at 24x24 art pixels per pose, with a dark outline so it reads on the
// sewer floor. Replaced when real art arrives.

import type { Frame, PlayerDir } from './animation';
import { type Rect, renderRects } from './spriteKit';

const C = {
  hair: '#4a2e1e',
  hairHi: '#6b4430',
  skin: '#f2c9a0',
  skinShade: '#d9a77c',
  eye: '#1a1210',
  mouth: '#9a5040',
  suit: '#e8762c',
  suitShade: '#b85a1c',
  suitHi: '#ffa050',
  badge: '#ecebe0',
  badgeInk: '#2a2a2a',
  boot: '#2b2622',
  bootHi: '#4a423b',
};

function down(frame: Frame, blink: boolean): Rect[] {
  const lUp = frame === 'stepA' ? 1 : 0; // raised leg / swung arm
  const rUp = frame === 'stepB' ? 1 : 0;
  return [
    // head
    [9, 2, 6, 1, C.hair], [8, 3, 8, 1, C.hair], [7, 4, 10, 1, C.hair],
    [7, 5, 10, 5, C.skin], [7, 5, 1, 2, C.hair], [16, 5, 1, 2, C.hair],
    [9, 3, 2, 1, C.hairHi],
    [8, 10, 8, 1, C.skinShade],
    ...(blink
      ? ([[10, 7, 1, 1, C.skinShade], [13, 7, 1, 1, C.skinShade]] as Rect[])
      : ([[10, 6, 1, 2, C.eye], [13, 6, 1, 2, C.eye]] as Rect[])),
    [11, 9, 2, 1, C.mouth],
    // body
    [7, 11, 10, 7, C.suit], [16, 11, 1, 7, C.suitShade], [7, 17, 10, 1, C.suitShade],
    [10, 11, 4, 1, C.suitHi], [11, 12, 1, 5, C.suitShade],
    [13, 13, 3, 2, C.badge], [14, 13, 1, 1, C.badgeInk],
    // arms and hands
    [5, 11 - rUp, 2, 6, C.suit], [5, 17 - rUp, 2, 1, C.skin],
    [17, 11 - lUp, 2, 6, C.suitShade], [17, 17 - lUp, 2, 1, C.skin],
    // legs and boots
    [8, 18, 3, 3 - lUp, C.suitShade], [8, 21 - lUp, 3, 2, C.boot],
    [13, 18, 3, 3 - rUp, C.suitShade], [13, 21 - rUp, 3, 2, C.boot],
  ];
}

function up(frame: Frame): Rect[] {
  const lUp = frame === 'stepA' ? 1 : 0;
  const rUp = frame === 'stepB' ? 1 : 0;
  return [
    [9, 2, 6, 1, C.hair], [8, 3, 8, 1, C.hair], [7, 4, 10, 6, C.hair],
    [10, 4, 3, 1, C.hairHi], [9, 10, 6, 1, C.skinShade],
    [7, 11, 10, 7, C.suit], [7, 11, 1, 7, C.suitShade], [7, 17, 10, 1, C.suitShade],
    [9, 13, 6, 1, C.suitShade],
    [5, 11 - lUp, 2, 6, C.suitShade], [5, 17 - lUp, 2, 1, C.skin],
    [17, 11 - rUp, 2, 6, C.suit], [17, 17 - rUp, 2, 1, C.skin],
    [8, 18, 3, 3 - lUp, C.suitShade], [8, 21 - lUp, 3, 2, C.boot],
    [13, 18, 3, 3 - rUp, C.suitShade], [13, 21 - rUp, 3, 2, C.boot],
  ];
}

function side(frame: Frame, blink: boolean): Rect[] {
  const legs: Rect[] =
    frame === 'stand'
      ? [[10, 18, 5, 3, C.suitShade], [10, 21, 6, 2, C.boot], [14, 21, 2, 1, C.bootHi]]
      : [
          // back leg darker, front leg lighter; A and B swap which is which
          [8, 18, 3, 3, frame === 'stepA' ? C.suitShade : C.suit], [7, 21, 4, 2, C.boot],
          [13, 18, 3, 3, frame === 'stepA' ? C.suit : C.suitShade], [14, 21, 4, 2, C.boot],
          [16, 21, 2, 1, C.bootHi],
        ];
  const armShift = frame === 'stepA' ? 2 : frame === 'stepB' ? -2 : 0;
  return [
    // head facing right
    [9, 2, 6, 1, C.hair], [8, 3, 8, 1, C.hair], [8, 4, 9, 1, C.hair],
    [10, 5, 7, 5, C.skin], [8, 5, 2, 4, C.hair], [17, 7, 1, 1, C.skinShade],
    [10, 3, 2, 1, C.hairHi], [9, 10, 6, 1, C.skinShade],
    blink ? [14, 7, 2, 1, C.skinShade] : [15, 6, 1, 2, C.eye],
    [15, 9, 2, 1, C.mouth],
    // body
    [9, 11, 7, 7, C.suit], [9, 11, 1, 7, C.suitShade], [9, 17, 7, 1, C.suitShade],
    [14, 13, 2, 2, C.badge],
    ...legs,
    // near arm drawn last, swinging opposite the front leg
    [11 + armShift, 11, 3, 6, C.suitShade], [11 + armShift, 17, 3, 1, C.skin],
  ];
}

function rects(dir: PlayerDir, frame: Frame, blink: boolean): Rect[] {
  if (dir === 'down') return down(frame, blink);
  if (dir === 'up') return up(frame);
  return side(frame, blink);
}

function render(dir: PlayerDir, frame: Frame, blink: boolean): HTMLCanvasElement {
  return renderRects(rects(dir, frame, blink));
}

export type PlayerSprites = (dir: PlayerDir, frame: Frame, blink: boolean) => HTMLCanvasElement;

export function buildPlayerSprites(): PlayerSprites {
  const cache = new Map<string, HTMLCanvasElement>();
  for (const dir of ['down', 'up', 'side'] as const)
    for (const frame of ['stand', 'stepA', 'stepB'] as const)
      for (const blink of [false, true]) cache.set(`${dir}:${frame}:${blink}`, render(dir, frame, blink));
  return (dir, frame, blink) => cache.get(`${dir}:${frame}:${blink && dir !== 'up'}`)!;
}

/** A worn item's colours, for drawing it on the doll: main, shade, highlight. */
export type GearColor = { main: string; shade: string; hi: string };

/**
 * The paper doll, dressed (user request: the character should look like they
 * are wearing what is equipped). Front view, standing; each worn slot paints
 * its item's colours over the matching part of the body. Weapons and off-hand
 * items are drawn as their icons in the hands by the caller.
 */
export function dressedFront(worn: Partial<Record<string, GearColor>>): HTMLCanvasElement {
  const g = worn;
  const out: Rect[] = [...down('stand', false)];
  const add = (c: GearColor | undefined, rects: [number, number, number, number, keyof GearColor][]) => {
    if (c) for (const [x, y, w, h, k] of rects) out.push([x, y, w, h, c[k]]);
  };
  // Inside out: clothes first, then what goes over them, the hat last.
  add(g.body, [[7, 11, 10, 7, 'main'], [16, 11, 1, 7, 'shade'], [7, 17, 10, 1, 'shade'], [10, 11, 4, 1, 'hi'], [5, 11, 2, 6, 'main'], [17, 11, 2, 6, 'shade']]);
  add(g.legs, [[8, 18, 3, 3, 'main'], [13, 18, 3, 3, 'shade'], [8, 18, 1, 3, 'hi']]);
  add(g.feet, [[7, 21, 4, 2, 'main'], [13, 21, 4, 2, 'shade'], [7, 21, 2, 1, 'hi']]);
  add(g.belt, [[7, 16, 10, 2, 'main'], [11, 16, 2, 2, 'hi']]);
  add(g.shoulders, [[4, 10, 4, 3, 'main'], [16, 10, 4, 3, 'shade'], [5, 10, 2, 1, 'hi']]);
  add(g.neck, [[9, 10, 6, 1, 'main'], [11, 11, 2, 2, 'hi']]);
  add(g.hands, [[4, 16, 3, 2, 'main'], [17, 16, 3, 2, 'shade']]);
  add(g.ring1, [[5, 17, 1, 1, 'hi']]);
  add(g.ring2, [[18, 17, 1, 1, 'hi']]);
  add(g.head, [[7, 1, 10, 3, 'main'], [6, 4, 12, 1, 'shade'], [9, 1, 3, 1, 'hi']]);
  return renderRects(out);
}
