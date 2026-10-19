// Neon Nights: the look for the game-show screens. A night-time stage with a
// glowing grid floor, black panels framed in neon tubes, neon-sign badges and
// pixel-font titles. Everything is drawn at pixel-art resolution on a small
// canvas and scaled up with hard edges, so it matches the map. UI only;
// animation runs off the clock.

import { drawText, textHeight, type TextStyle } from './pixelFont';

/** A neon colour: the soft glow around a tube and its bright core. */
export interface Neon {
  glow: string;
  core: string;
  /** For words lit in this colour. */
  text: string;
}

export const NEON = {
  pink: { glow: '#a01a8a', core: '#ffb0e0', text: '#ff3ea5' },
  cyan: { glow: '#1a6ae8', core: '#b0f0ff', text: '#38c8ff' },
  gold: { glow: '#c8a010', core: '#fff8b0', text: '#ffd23a' },
  red: { glow: '#a01a1a', core: '#ffb8a8', text: '#ff4a3a' },
  purple: { glow: '#6a1aa0', core: '#e8c0ff', text: '#c060ff' },
  green: { glow: '#2a8a2a', core: '#c8ffb0', text: '#7aea5a' },
  dud: { glow: '#5a4a3a', core: '#c8b8a0', text: '#a89878' },
} satisfies Record<string, Neon>;

export const INK = '#06020e';

/** Ease out with a little overshoot, for things popping onto the screen. */
export function popIn(t: number): number {
  const c = 1.9;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

/** True on the "on" half of a steady blink. */
export function blink(now: number, period = 900): boolean {
  return Math.floor(now / (period / 2)) % 2 === 0;
}

const layers: CanvasRenderingContext2D[] = [];

/**
 * Draw a scene in art pixels on a small canvas and blow it up with hard
 * edges. `pixel` is CSS pixels per art pixel; it shrinks if the scene needs
 * at least `minH` art pixels of height. `pop` scales the result around
 * `origin` (CSS pixels) for pop-in animations. Use a different `slot` for
 * each layer drawn in the same frame.
 */
export function lowRes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pixel: number,
  draw: (g: CanvasRenderingContext2D, lw: number, lh: number) => void,
  opts: { minH?: number; pop?: number; origin?: [number, number]; slot?: number } = {},
): void {
  const p = Math.max(1, Math.min(pixel, Math.floor(h / (opts.minH ?? 0)) || pixel));
  const lw = Math.ceil(w / p);
  const lh = Math.ceil(h / p);
  const slot = opts.slot ?? 0;
  let g = layers[slot];
  if (!g || g.canvas.width !== lw || g.canvas.height !== lh) {
    const c = document.createElement('canvas');
    c.width = lw;
    c.height = lh;
    g = layers[slot] = c.getContext('2d')!;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, lw, lh);
  g.imageSmoothingEnabled = false;
  draw(g, lw, lh);
  const pop = opts.pop ?? 1;
  const [ox, oy] = opts.origin ?? [w / 2, h / 2];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(ox, oy);
  ctx.scale(pop, pop);
  ctx.translate(-ox, -oy);
  ctx.drawImage(g.canvas, 0, 0, lw * p, lh * p);
  ctx.restore();
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Every other pixel in a checkerboard, for pixel-art shading. */
function dither(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  for (let j = 0; j < h; j++) for (let i = j % 2; i < w; i += 2) g.fillRect(x + i, y + j, 1, 1);
}

/** A filled ellipse with hard pixel edges. */
export function disc(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string): void {
  g.fillStyle = color;
  for (let j = -ry; j <= ry; j++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j / (ry + 0.5)) ** 2)));
    g.fillRect(Math.round(cx - half), Math.round(cy + j), half * 2 + 1, 1);
  }
}

/** A lit pedestal: rings of glow under a prize. */
export function glowPad(g: CanvasRenderingContext2D, cx: number, cy: number, color: Neon): void {
  disc(g, cx, cy, 34, 7, color.glow);
  disc(g, cx, cy, 26, 5, color.text);
  disc(g, cx, cy - 1, 18, 3, color.core);
}

/**
 * The stage: a night sky in dithered bands with twinkling stars, over a neon
 * grid floor that rolls towards the viewer.
 */
export function stage(g: CanvasRenderingContext2D, lw: number, lh: number, now: number, floor: Neon = NEON.pink): void {
  const bands = ['#0a0420', '#120830', '#1a0a44', '#24105a'];
  const horizon = Math.round(lh * 0.66);
  const bh = Math.ceil(horizon / bands.length);
  bands.forEach((c, i) => rect(g, 0, i * bh, lw, bh, c));
  for (let i = 1; i < bands.length; i++) dither(g, 0, i * bh - 4, lw, 4, bands[i]);
  for (let i = 0; i < 24; i++) {
    const x = hash(i, 1) % lw;
    const y = hash(i, 2) % Math.max(1, horizon - 8);
    const twinkle = (Math.floor(now / 400) + i) % 7 === 0;
    rect(g, x, y, 1, 1, '#ffffff');
    if (twinkle) {
      rect(g, x - 1, y, 3, 1, '#7a5aff');
      rect(g, x, y - 1, 1, 3, '#7a5aff');
      rect(g, x, y, 1, 1, '#ffffff');
    }
  }
  rect(g, 0, horizon, lw, lh - horizon, '#0a0420');
  // Floor lines: rays from a vanishing point, and rungs that roll forward.
  g.fillStyle = floor.glow;
  const cx = lw / 2;
  const depth = lh - horizon;
  for (let i = -16; i <= 16; i++) {
    const x0 = cx + i * 6;
    const x1 = cx + i * (lw / 9);
    for (let j = 0; j <= depth; j++) g.fillRect(Math.round(x0 + ((x1 - x0) * j) / depth), horizon + j, 1, 1);
  }
  const roll = (now / 1600) % 1;
  for (let k = 0; k < 7; k++) {
    const t = (k + roll) / 7;
    rect(g, 0, horizon + Math.round(depth * t * t), lw, 1, floor.glow);
  }
  rect(g, 0, horizon, lw, 1, floor.text);
}

function hash(i: number, n: number): number {
  let x = Math.imul(i * 2654435761 + n * 40503, 0x9e3779b1);
  x ^= x >>> 15;
  return x >>> 0;
}

/** A neon tube around a rectangle: a three-pixel glow with a bright core. */
export function tube(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: Neon, lit = true): void {
  const glow = lit ? color.glow : '#2a1a2a';
  const core = lit ? color.core : '#4a3a4a';
  rect(g, x - 1, y - 1, w + 2, 3, glow);
  rect(g, x - 1, y + h - 2, w + 2, 3, glow);
  rect(g, x - 1, y - 1, 3, h + 2, glow);
  rect(g, x + w - 2, y - 1, 3, h + 2, glow);
  rect(g, x, y, w, 1, core);
  rect(g, x, y + h - 1, w, 1, core);
  rect(g, x, y, 1, h, core);
  rect(g, x + w - 1, y, 1, h, core);
}

/** A black panel framed by two neon tubes. */
export function panel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, outer: Neon, inner: Neon, now = 0, flicker = false): void {
  rect(g, x, y, w, h, INK);
  // A dud tube stutters now and then.
  const lit = !flicker || hash(Math.floor(now / 90), 7) % 9 !== 0;
  tube(g, x + 2, y + 2, w - 4, h - 4, outer, lit);
  tube(g, x + 7, y + 7, w - 14, h - 14, inner);
}

export const TITLE_STYLE: TextStyle = { outline: '#000', shadow: '#000' };

/** A big neon title: bright letters with a glowing outline and a dark shadow. Returns its height. */
export function title(g: CanvasRenderingContext2D, text: string, cx: number, y: number, color: Neon, scale: number): number {
  const style = { scale, color: color.core, outline: color.text, shadow: '#2a0a3a' };
  drawText(g, text, cx, y, { ...style, align: 'center' });
  return textHeight(style);
}

/** A small neon sign with a word in it. Returns its width. */
export function sign(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: Neon, now: number, opts: { flicker?: boolean; align?: 'left' | 'center' | 'right' } = {}): number {
  const style: TextStyle = { color: color.text };
  const w = text.length * 6 + 13;
  const left = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
  rect(g, left, y, w, 20, INK);
  const lit = !opts.flicker || hash(Math.floor(now / 120), 3) % 6 !== 0;
  tube(g, left, y, w, 20, color, lit);
  if (lit) drawText(g, text, left + w / 2, y + 7, { ...style, align: 'center' });
  return w;
}

/** Confetti falling from the top; positions come from a hash so it never jitters. */
export function confetti(g: CanvasRenderingContext2D, lw: number, lh: number, since: number, now: number, count = 60): void {
  const t = (now - since) / 1000;
  const colors = ['#ff3ea5', '#38c8ff', '#ffd23a', '#7aea5a', '#ffffff'];
  for (let i = 0; i < count; i++) {
    const r = (n: number) => (hash(i, n) % 10000) / 10000;
    const x = Math.round(r(1) * lw + Math.sin(t * 2 + i) * 6);
    const y = Math.round(((r(2) * lh * 0.6 + t * (25 + r(3) * 40)) % (lh + 10)) - 5);
    const flat = Math.floor(t * 6 + i) % 2 === 0;
    rect(g, x, y, flat ? 2 : 1, flat ? 1 : 2, colors[i % colors.length]);
  }
}
