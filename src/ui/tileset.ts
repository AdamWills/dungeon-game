// Which 0x72 sprites the map uses, and the parser for the pack's tile list.
// Kept free of image loading so it can be tested without a browser.

export type SheetRect = { x: number; y: number; w: number; h: number };

export function parseTileList(text: string): Map<string, SheetRect> {
  const rects = new Map<string, SheetRect>();
  for (const line of text.split('\n')) {
    const [name, x, y, w, h] = line.trim().split(/\s+/);
    if (name && h !== undefined) rects.set(name, { x: +x, y: +y, w: +w, h: +h });
  }
  return rects;
}

export const MAP_SPRITES = {
  floors: ['floor_1', 'floor_2', 'floor_3', 'floor_4', 'floor_5', 'floor_6', 'floor_7', 'floor_8'],
  wallFace: 'wall_mid',
  wallFaceVariants: ['wall_hole_1', 'wall_hole_2'],
  wallGoo: 'wall_goo',
  wallGooBase: 'wall_goo_base',
  wallTop: 'wall_top_mid',
  wallRimWest: 'wall_edge_mid_left',
  wallRimEast: 'wall_edge_mid_right',
  stairs: 'floor_stairs',
} as const;

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(b, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** Mostly plain stone, with cracked and broken tiles scattered by a stable hash. */
export function floorVariant(x: number, y: number): string {
  const r = hash(x * 7 + 1, y * 13 + 5);
  const f = MAP_SPRITES.floors;
  if (r < 0.72) return f[0];
  return f[1 + Math.floor(((r - 0.72) / 0.28) * (f.length - 1))];
}

/** Wall faces: plain brick, the odd hole, and sewer goo dripping down. */
export function wallFaceVariant(x: number, y: number): 'plain' | 'hole1' | 'hole2' | 'goo' {
  const r = hash(x * 31 + 3, y * 17 + 11);
  if (r < 0.1) return 'goo';
  if (r < 0.14) return 'hole1';
  if (r < 0.17) return 'hole2';
  return 'plain';
}
