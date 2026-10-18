import { describe, expect, it } from 'vitest';
import tileList from '../src/assets/0x72/tile_list.txt?raw';
import { floorVariant, MAP_SPRITES, parseTileList, wallFaceVariant } from '../src/ui/tileset';

const rects = parseTileList(tileList);

describe('0x72 tileset', () => {
  it('parses the tile list', () => {
    expect(rects.size).toBeGreaterThan(300);
    expect(rects.get('floor_1')).toEqual({ x: 16, y: 64, w: 16, h: 16 });
  });

  it('has every sprite the map draws', () => {
    const names = Object.values(MAP_SPRITES).flatMap((v) => (Array.isArray(v) ? v : [v]));
    for (const n of names) expect(rects.has(n), n).toBe(true);
  });

  it('picks stable floor and wall variants', () => {
    expect(floorVariant(3, 4)).toBe(floorVariant(3, 4));
    const floors = new Set(Array.from({ length: 400 }, (_, i) => floorVariant(i % 20, Math.floor(i / 20))));
    expect(floors.has('floor_1')).toBe(true);
    expect(floors.size).toBeGreaterThan(3);
    const walls = new Set(Array.from({ length: 400 }, (_, i) => wallFaceVariant(i % 20, Math.floor(i / 20))));
    expect(walls).toEqual(new Set(['plain', 'goo', 'hole1', 'hole2']));
  });
});
