import { describe, expect, it } from 'vitest';

import { alphaBounds, blank, OUTLINE_RGB, type Pixels, pixelize } from '../src/art/pixelize';

/** A 256 px "generated image": a soft-edged red disc with a blue band, on transparency. */
function fakeImage(): Pixels {
  const p = blank(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const d = Math.hypot(x - 140, y - 150) - 60;
      if (d > 2) continue;
      const i = (y * 256 + x) * 4;
      const band = y > 140 && y < 160;
      p.data.set([band ? 30 : 200 + (x % 7), band ? 40 : 30, band ? 220 : 30 + (y % 5), d > 0 ? 100 : 255], i);
    }
  return p;
}

const colorsOf = (p: Pixels) => {
  const set = new Set<string>();
  for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) set.add(`${p.data[i]},${p.data[i + 1]},${p.data[i + 2]}`);
  return set;
};

describe('pixelize', () => {
  it('finds the creature in the image', () => {
    expect(alphaBounds(fakeImage())).toMatchObject({ x: 78, y: 88 });
    expect(alphaBounds(blank(8, 8))).toBeNull();
  });

  for (const size of [32, 40, 48]) {
    it(`makes a ${size} px sprite: hard alpha, few colours, outlined, standing on the bottom`, () => {
      const s = pixelize(fakeImage(), size, 12)!;
      expect(s.width).toBe(size);
      for (let i = 3; i < s.data.length; i += 4) expect([0, 255]).toContain(s.data[i]);
      expect(colorsOf(s).size).toBeLessThanOrEqual(13); // the palette plus the outline
      expect(colorsOf(s).has(OUTLINE_RGB.join(','))).toBe(true);
      // It stands on the bottom edge (within a couple of pixels), centred.
      const row = (y: number) => [...Array(size).keys()].some((x) => s.data[(y * size + x) * 4 + 3]);
      const lowest = [...Array(size).keys()].filter(row).pop()!;
      expect(lowest).toBeGreaterThanOrEqual(size - 3);
      // The blue band survives the palette cut.
      expect([...colorsOf(s)].some((c) => c.split(',').map(Number)[2] > 150)).toBe(true);
    });
  }

  it('returns null for an empty image', () => {
    expect(pixelize(blank(64, 64), 32)).toBeNull();
  });
});
