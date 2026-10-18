// Placeholder tile atlas, drawn once at startup. Sewer palette: wet stone,
// green-brown brick, a rusty door frame and a hole with a ladder. The player
// has its own animated sprites in playerSprite.ts.

export const TILE = 24;

export type SpriteId = 'floor0' | 'floor1' | 'floor2' | 'floor3' | 'wall' | 'wallTop' | 'door' | 'stairs';

const ORDER: SpriteId[] = ['floor0', 'floor1', 'floor2', 'floor3', 'wall', 'wallTop', 'door', 'stairs'];

export type Atlas = { image: HTMLCanvasElement; draw: (ctx: CanvasRenderingContext2D, id: SpriteId, x: number, y: number) => void };

function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(b, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca77);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

function speckle(g: CanvasRenderingContext2D, ox: number, salt: number, colors: string[], count: number) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(hash(salt, i * 3) * colors.length)];
    const x = Math.floor(hash(salt, i * 3 + 1) * TILE);
    const y = Math.floor(hash(salt, i * 3 + 2) * TILE);
    g.fillRect(ox + x, y, 2, 2);
  }
}

export function buildAtlas(): Atlas {
  const image = document.createElement('canvas');
  image.width = TILE * ORDER.length;
  image.height = TILE;
  const g = image.getContext('2d')!;
  const at = (id: SpriteId) => ORDER.indexOf(id) * TILE;

  // Floor: wet slate with grime, four variants.
  for (let v = 0; v < 4; v++) {
    const ox = at(`floor${v}` as SpriteId);
    g.fillStyle = '#2b3433';
    g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = '#323d3b';
    g.fillRect(ox + 1, 1, TILE - 2, TILE - 2);
    speckle(g, ox, 11 + v, ['#26302e', '#3a4744', '#2f3a2a', '#405036'], 14);
    if (v === 3) {
      g.fillStyle = '#4b5e2c'; // a puddle of something
      g.fillRect(ox + 6, 13, 9, 4);
      g.fillRect(ox + 8, 12, 5, 6);
    }
  }

  // Wall face: brick, clipped so offset rows don't bleed into neighbours.
  {
    const ox = at('wall');
    g.save();
    g.beginPath();
    g.rect(ox, 0, TILE, TILE);
    g.clip();
    g.fillStyle = '#1b1f1a';
    g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = '#4a4a36';
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 6 : 0;
      for (let col = -1; col < 3; col++) g.fillRect(ox + off + col * 12 + 1, row * 6 + 1, 10, 4);
    }
    speckle(g, ox, 99, ['#3d5a2a', '#5c5a3c'], 8);
    g.restore();
  }

  // Wall seen from above (a wall with no floor south of it): darker cap.
  {
    const ox = at('wallTop');
    g.fillStyle = '#151814';
    g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = '#22271f';
    g.fillRect(ox + 2, 2, TILE - 4, TILE - 4);
  }

  // Door: open rusty frame over floor.
  {
    const ox = at('door');
    g.fillStyle = '#323d3b';
    g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = '#7a4a24';
    g.fillRect(ox, 0, 3, TILE);
    g.fillRect(ox + TILE - 3, 0, 3, TILE);
    g.fillRect(ox, 0, TILE, 3);
    g.fillStyle = '#a0662e';
    g.fillRect(ox + 1, 1, 1, TILE - 2);
  }

  // Stairs: a hole with a ladder and a hazard stripe.
  {
    const ox = at('stairs');
    g.fillStyle = '#323d3b';
    g.fillRect(ox, 0, TILE, TILE);
    g.fillStyle = '#d9b310';
    g.fillRect(ox + 1, 1, TILE - 2, TILE - 2);
    g.fillStyle = '#0a0b0a';
    g.fillRect(ox + 4, 4, TILE - 8, TILE - 8);
    g.fillStyle = '#9a9a8a';
    g.fillRect(ox + 8, 4, 2, TILE - 8);
    g.fillRect(ox + 14, 4, 2, TILE - 8);
    for (let y = 7; y < TILE - 4; y += 4) g.fillRect(ox + 8, y, 8, 1);
  }

  return {
    image,
    draw: (ctx, id, x, y) => ctx.drawImage(image, at(id), 0, TILE, TILE, x, y, TILE, TILE),
  };
}

export function floorVariant(x: number, y: number): SpriteId {
  const r = hash(x * 7 + 1, y * 13 + 5);
  return r < 0.55 ? 'floor0' : r < 0.8 ? 'floor1' : r < 0.95 ? 'floor2' : 'floor3';
}
