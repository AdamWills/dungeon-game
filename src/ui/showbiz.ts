// Showbiz kit: the big, corny, 1970s game-show look for the moments that
// matter. Sunbursts, chasing marquee bulbs, chunky gold titles, spinning
// starbursts, spotlights and confetti. UI only; animation runs off the clock.

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
  // Fade the edge into the background.
  const g = ctx.createRadialGradient(0, 0, r * 0.35, 0, 0, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,4,18,0.85)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
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
  // Chunky frame with a bevel.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, w, h, 18);
  const fg = ctx.createLinearGradient(x, y, x, y + h);
  fg.addColorStop(0, '#fff2b8');
  fg.addColorStop(0.5, frame);
  fg.addColorStop(1, '#8a5a12');
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x + 14, y + 14, w - 28, h - 28, 10);
  const inner = ctx.createLinearGradient(x, y, x, y + h);
  inner.addColorStop(0, opts.fill ?? '#3a0e5a');
  inner.addColorStop(1, PALETTE.night);
  ctx.fillStyle = inner;
  ctx.fill();

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
  perimeter.forEach(([bx, by], i) => {
    const on = (i + step) % 3 !== 0;
    ctx.fillStyle = on ? bulb : '#6a4a1a';
    if (on) {
      ctx.save();
      ctx.shadowColor = bulb;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
    if (on) ctx.restore();
  });
}

/** Big chunky title: gradient fill, dark outline, drop shadow. */
export function bigTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  size: number,
  opts: { colors?: string[]; outline?: string; scale?: number; tilt?: number; maxWidth?: number } = {},
): void {
  const colors = opts.colors ?? PALETTE.gold;
  ctx.save();
  ctx.font = `${size}px ${SHOW_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  let fit = 1;
  if (opts.maxWidth) fit = Math.min(1, opts.maxWidth / ctx.measureText(text).width);
  ctx.translate(cx, y);
  ctx.rotate(opts.tilt ?? 0);
  ctx.scale((opts.scale ?? 1) * fit, (opts.scale ?? 1) * fit);
  ctx.lineJoin = 'round';
  // Drop shadow, then outline, then gradient face.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, size * 0.06, size * 0.08);
  ctx.strokeStyle = opts.outline ?? '#3a1404';
  ctx.lineWidth = Math.max(4, size / 8);
  ctx.strokeText(text, 0, 0);
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  colors.forEach((c, i) => g.addColorStop(i / Math.max(1, colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillText(text, 0, 0);
  ctx.restore();
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
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff6d0';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = `${Math.round(r * 0.42)}px ${SHOW_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fffbe8';
  ctx.strokeStyle = '#3a1404';
  ctx.lineWidth = 3;
  const words = text.split(' ');
  const lh = r * 0.42;
  words.forEach((wd, i) => {
    const yy = (i - (words.length - 1) / 2) * lh;
    ctx.strokeText(wd, 0, yy, r * 1.4);
    ctx.fillText(wd, 0, yy, r * 1.4);
  });
  ctx.restore();
}

/** Two coloured spotlights sweeping across the stage. */
export function spotlights(ctx: CanvasRenderingContext2D, w: number, h: number, now: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [i, color] of [[0, 'rgba(255, 62, 165, 0.16)'], [1, 'rgba(56, 200, 255, 0.16)']] as const) {
    const sx = i === 0 ? w * 0.08 : w * 0.92;
    const angle = Math.PI / 2 + Math.sin(now / 1400 + i * 2) * 0.55;
    const len = h * 1.3;
    const spread = 0.22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(sx, -10);
    ctx.lineTo(sx + Math.cos(angle - spread) * len, -10 + Math.sin(angle - spread) * len);
    ctx.lineTo(sx + Math.cos(angle + spread) * len, -10 + Math.sin(angle + spread) * len);
    ctx.closePath();
    ctx.fill();
  }
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
