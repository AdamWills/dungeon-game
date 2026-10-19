// Showbiz kit: the big, corny, 1970s game-show look for the moments that
// matter, in pixel art. Sunbursts, chasing marquee bulbs, chunky gold titles,
// spinning starbursts and confetti, drawn at low resolution with a reduced
// palette. UI only; animation runs off the clock.

export const SHOW_FONT = '"Impact", "Haettenschweiler", "Arial Black", "Franklin Gothic Heavy", sans-serif';

export const PALETTE = {
  gold: ['#fff4b0', '#ffd23a', '#e8901a'],
  hotPink: '#ff3ea5',
  electric: '#38c8ff',
  orange: '#ff7a1a',
  purple: '#5a1a8a',
  night: '#12061e',
};

/** Ease out with a little overshoot, for things popping onto the screen. */
export function popIn(t: number): number {
  const c = 1.9;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

/** Rotating rays behind something important. */
export function sunburst(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, colors: [string, string], now: number, rays = 24): void {
  const spin = now / 9000;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = colors[1];
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors[0];
  for (let i = 0; i < rays; i += 2) {
    const a0 = spin + (i / rays) * Math.PI * 2;
    const a1 = spin + ((i + 1) / rays) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  // Darken towards the edge in a few flat steps (pixel art has no smooth fades).
  ctx.fillStyle = 'rgba(10, 4, 18, 0.32)';
  for (const f of [0.62, 0.8, 0.92]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(0, 0, r * f, 0, Math.PI * 2, true);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A panel framed in chrome with a ring of chasing light bulbs. */
export function marquee(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  now: number,
  opts: { fill?: string; frame?: string; bulb?: string; spacing?: number } = {},
): void {
  const frame = opts.frame ?? '#d8b04a';
  const bulb = opts.bulb ?? '#fff1a8';
  const spacing = opts.spacing ?? 26;
  // Chunky frame: a solid drop shadow, then flat bevel bands.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  roundRect(ctx, x + 10, y + 12, w, h, 18);
  ctx.fill();
  ctx.fillStyle = '#8a5a12';
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.fillStyle = frame;
  roundRect(ctx, x, y, w, h - 8, 18);
  ctx.fill();
  ctx.fillStyle = '#fff2b8';
  roundRect(ctx, x + 6, y + 3, w - 12, 8, 6);
  ctx.fill();
  ctx.fillStyle = '#5a3a0a';
  roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 10);
  ctx.fill();
  ctx.fillStyle = opts.fill ?? '#3a0e5a';
  roundRect(ctx, x + 16, y + 16, w - 32, h - 32, 8);
  ctx.fill();
  // One darker band at the bottom for depth.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(x + 16, y + h - 16 - Math.min(40, h / 6), w - 32, Math.min(40, h / 6));

  // Bulbs around the frame, chasing.
  const perimeter: [number, number][] = [];
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / spacing));
    for (let i = 0; i < n; i++) perimeter.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
  };
  const m = 7;
  add(x + m, y + m, x + w - m, y + m);
  add(x + w - m, y + m, x + w - m, y + h - m);
  add(x + w - m, y + h - m, x + m, y + h - m);
  add(x + m, y + h - m, x + m, y + m);
  const step = Math.floor(now / 110);
  const b = Math.max(6, 2 / unitScale(ctx)); // at least 2 real pixels
  perimeter.forEach(([bx, by], i) => {
    const on = (i + step) % 3 !== 0;
    ctx.fillStyle = on ? bulb : '#6a4a1a';
    ctx.fillRect(Math.round(bx - b / 2), Math.round(by - b / 2), b, b);
    if (on) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(bx - b / 2), Math.round(by - b / 2), b / 2, b / 2);
    }
  });
}

/** How many device pixels one user unit covers right now (rotation-proof). */
function unitScale(ctx: CanvasRenderingContext2D): number {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

/**
 * Big chunky title: gradient fill, dark outline, drop shadow. Rendered at the
 * real pixel size it will occupy and then thresholded, so the letters have
 * hard pixel edges instead of smooth anti-aliasing.
 */
export function bigTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  size: number,
  opts: { colors?: string[]; outline?: string; scale?: number; tilt?: number; maxWidth?: number } = {},
): void {
  const colors = opts.colors ?? PALETTE.gold;
  const k = unitScale(ctx) * (opts.scale ?? 1);
  let px = Math.max(7, Math.round(size * k));
  const t = document.createElement('canvas').getContext('2d')!;
  t.font = `${px}px ${SHOW_FONT}`;
  if (opts.maxWidth) {
    const fit = (opts.maxWidth * k) / t.measureText(text).width;
    if (fit < 1) px = Math.max(7, Math.floor(px * fit));
  }
  t.font = `${px}px ${SHOW_FONT}`;
  const outline = Math.max(1, Math.round(px / 9));
  const tw = Math.ceil(t.measureText(text).width) + outline * 2 + Math.ceil(px * 0.12) + 4;
  const th = Math.ceil(px * 1.5);
  t.canvas.width = tw;
  t.canvas.height = th;
  t.font = `${px}px ${SHOW_FONT}`;
  t.textBaseline = 'middle';
  t.textAlign = 'center';
  t.lineJoin = 'round';
  const ox = tw / 2;
  const oy = th / 2;
  const drop = Math.max(1, Math.round(px * 0.08));
  t.fillStyle = 'rgba(0,0,0,0.8)';
  t.fillText(text, ox + drop, oy + drop);
  t.strokeStyle = opts.outline ?? '#3a1404';
  t.lineWidth = outline * 2;
  t.strokeText(text, ox, oy);
  // Banded gradient: a few flat stripes, like a palette, not a smooth blend.
  const g = t.createLinearGradient(0, oy - px / 2, 0, oy + px / 2);
  colors.forEach((c, i) => {
    g.addColorStop(i / colors.length, c);
    g.addColorStop((i + 1) / colors.length - 0.001, c);
  });
  t.fillStyle = g;
  t.fillText(text, ox, oy);
  hardenAlpha(t);

  ctx.save();
  ctx.translate(cx, y);
  ctx.rotate(opts.tilt ?? 0);
  ctx.scale(1 / k, 1 / k);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t.canvas, Math.round(-tw / 2), Math.round(-th / 2));
  ctx.restore();
}

/** Snap every pixel to fully opaque or fully clear: crisp pixel edges. */
function hardenAlpha(t: CanvasRenderingContext2D): void {
  const img = t.getImageData(0, 0, t.canvas.width, t.canvas.height);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0;
  t.putImageData(img, 0, 0);
}

/**
 * Draw a scene at low resolution and blow it up with hard pixel edges, so the
 * showbiz screens match the pixel-art game. `draw` works in normal (CSS)
 * coordinates; everything it draws comes out `pixel` CSS pixels per pixel.
 */
export function pixelLayer(ctx: CanvasRenderingContext2D, w: number, h: number, pixel: number, draw: (lctx: CanvasRenderingContext2D) => void): void {
  const lw = Math.ceil(w / pixel);
  const lh = Math.ceil(h / pixel);
  if (!layer || layer.canvas.width !== lw || layer.canvas.height !== lh) {
    const c = document.createElement('canvas');
    c.width = lw;
    c.height = lh;
    layer = c.getContext('2d')!;
  }
  const l = layer;
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.clearRect(0, 0, lw, lh);
  l.setTransform(1 / pixel, 0, 0, 1 / pixel, 0, 0);
  l.imageSmoothingEnabled = false;
  draw(l);
  posterize(l, lw, lh);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(l.canvas, 0, 0, lw * pixel, lh * pixel);
  ctx.restore();
}
let layer: CanvasRenderingContext2D | null = null;

/**
 * Cut the layer down to a small palette, like old hardware: smooth gradients
 * become flat bands and soft anti-aliased edges snap to one colour or the other.
 */
function posterize(l: CanvasRenderingContext2D, w: number, h: number, levels = 6): void {
  const img = l.getImageData(0, 0, w, h);
  const d = img.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
    d[i + 3] = d[i + 3] >= 128 ? 255 : 0;
  }
  l.putImageData(img, 0, 0);
}

/** A spinning starburst badge with a word on it. */
export function starburst(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, text: string, now: number, points = 14): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(now / 500) * 0.12);
  const s = 1 + Math.sin(now / 220) * 0.04;
  ctx.scale(s, s);
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.72;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.save();
  ctx.translate(4, 5);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#fff6d0';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Badge words: never smaller than 12 real pixels, or they turn to mush.
  const size = Math.max(r * 0.46, 12 / unitScale(ctx));
  const words = text.split(' ');
  words.forEach((wd, i) => {
    bigTitle(ctx, wd, 0, (i - (words.length - 1) / 2) * size * 0.95, size, { colors: ['#fffbe8'], outline: '#3a1404', maxWidth: r * 1.5 });
  });
  ctx.restore();
}

/** Confetti falling from the top, positions from a hash so it never jitters. */
export function confetti(ctx: CanvasRenderingContext2D, w: number, h: number, since: number, now: number, count = 90): void {
  const t = (now - since) / 1000;
  const colors = ['#ff3ea5', '#38c8ff', '#ffd23a', '#7aea6a', '#ff7a1a', '#ffffff'];
  for (let i = 0; i < count; i++) {
    const r = (n: number) => {
      let x = Math.imul(i * 2654435761 + n * 40503, 0x9e3779b1);
      x ^= x >>> 15;
      return ((x >>> 0) % 10000) / 10000;
    };
    const x = r(1) * w + Math.sin(t * 2 + i) * 20;
    const y = ((r(2) * h * 0.6 + t * (80 + r(3) * 120)) % (h + 40)) - 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (2 + r(4) * 4) + i);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
}
