// Turning a big generated image into a game sprite (user decision: 32 to 48 px
// art). Crop to the creature, shrink it onto the pixel grid by averaging,
// make every pixel fully on or off, cut the palette down, add the same dark
// outline the hand-drawn sprites have. Works on raw RGBA arrays so it runs in
// tests without a browser.

export type Pixels = { width: number; height: number; data: Uint8ClampedArray };
type Box = { x: number; y: number; w: number; h: number };

export const OUTLINE_RGB: [number, number, number] = [18, 13, 10];

export function blank(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** The smallest box holding every pixel more opaque than `threshold`. */
export function alphaBounds(p: Pixels, threshold = 24): Box | null {
  let x0 = p.width;
  let y0 = p.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      if (p.data[(y * p.width + x) * 4 + 3] > threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Shrink the box into a size x size sprite, keeping its shape, standing on the
 * bottom edge and centred, with a pixel of room for the outline. Each output
 * pixel averages the source pixels under it (colours weighted by alpha).
 */
export function downscale(p: Pixels, box: Box, size: number): Pixels {
  const room = size - 2;
  const scale = Math.min(room / box.w, room / box.h);
  const ow = Math.max(1, Math.round(box.w * scale));
  const oh = Math.max(1, Math.round(box.h * scale));
  const ox = Math.floor((size - ow) / 2);
  const oy = size - 1 - oh;
  const out = blank(size, size);
  for (let y = 0; y < oh; y++)
    for (let x = 0; x < ow; x++) {
      const sx0 = box.x + Math.floor((x * box.w) / ow);
      const sx1 = Math.max(sx0 + 1, box.x + Math.floor(((x + 1) * box.w) / ow));
      const sy0 = box.y + Math.floor((y * box.h) / oh);
      const sy1 = Math.max(sy0 + 1, box.y + Math.floor(((y + 1) * box.h) / oh));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++)
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * p.width + sx) * 4;
          const al = p.data[i + 3];
          r += p.data[i] * al;
          g += p.data[i + 1] * al;
          b += p.data[i + 2] * al;
          a += al;
          n++;
        }
      const o = ((oy + y) * size + ox + x) * 4;
      if (a > 0) {
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
      }
      out.data[o + 3] = a / n;
    }
  return out;
}

/** Pixel art has no soft edges: each pixel is fully on or off. */
export function hardenAlpha(p: Pixels, cut = 110): Pixels {
  for (let i = 3; i < p.data.length; i += 4) p.data[i] = p.data[i] >= cut ? 255 : 0;
  return p;
}

/** Cut the colours down to at most `max` (median cut), so the sprite reads as pixel art. */
export function quantize(p: Pixels, max = 16): Pixels {
  const colors: number[][] = [];
  for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) colors.push([p.data[i], p.data[i + 1], p.data[i + 2]]);
  if (!colors.length) return p;
  let boxes: number[][][] = [colors];
  while (boxes.length < max) {
    // Split the box with the widest spread of any one channel.
    let best = -1;
    let bestRange = 0;
    let channel = 0;
    boxes.forEach((bx, i) => {
      if (bx.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const col of bx) {
          if (col[c] < lo) lo = col[c];
          if (col[c] > hi) hi = col[c];
        }
        if (hi - lo > bestRange) [best, bestRange, channel] = [i, hi - lo, c];
      }
    });
    if (best < 0 || bestRange < 8) break;
    const bx = boxes[best].sort((a, b) => a[channel] - b[channel]);
    const mid = bx.length >> 1;
    boxes = [...boxes.slice(0, best), bx.slice(0, mid), bx.slice(mid), ...boxes.slice(best + 1)];
  }
  const palette = boxes.map((bx) => [0, 1, 2].map((c) => Math.round(bx.reduce((n, col) => n + col[c], 0) / bx.length)));
  for (let i = 0; i < p.data.length; i += 4) {
    if (!p.data[i + 3]) continue;
    let near = palette[0];
    let nd = Infinity;
    for (const col of palette) {
      const d = (col[0] - p.data[i]) ** 2 + (col[1] - p.data[i + 1]) ** 2 + (col[2] - p.data[i + 2]) ** 2;
      if (d < nd) [near, nd] = [col, d];
    }
    p.data[i] = near[0];
    p.data[i + 1] = near[1];
    p.data[i + 2] = near[2];
  }
  return p;
}

/** A 1 px dark outline around the shape, like the hand-drawn sprites. */
export function outline(p: Pixels, rgb = OUTLINE_RGB): Pixels {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < p.width && y < p.height && p.data[(y * p.width + x) * 4 + 3] === 255;
  const edge: number[] = [];
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) edge.push((y * p.width + x) * 4);
  for (const i of edge) p.data.set([...rgb, 255], i);
  return p;
}

/** The whole pipeline: a generated image in, a size x size sprite out (null if the image is empty). */
export function pixelize(p: Pixels, size: number, colors = 16): Pixels | null {
  // Bound by the same cut-off that decides on/off pixels, so faint haze is not "creature".
  const box = alphaBounds(p, 110);
  if (!box) return null;
  return outline(quantize(hardenAlpha(downscale(p, box, size)), colors));
}
