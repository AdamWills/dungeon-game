// Seeded floor generator: rot.js rooms-and-corridors (Uniform), then start and
// stairs placement. rot.js draws from its own global RNG, so we seed it from
// our RNG for the duration of the call and restore it afterwards.

import { Map as RotMap, RNG as RotRNG } from 'rot-js';
import { FLOOR_THEMES } from '../data/floors';
import { createRng, deriveSeed, pick } from '../game/rng';
import type { Floor, Room, Tile, Vec } from '../game/types';
import { placeFeatures } from './features';
import { populate } from './populate';
import { bfsDistances } from './reach';

const MAX_ATTEMPTS = 50;

function withRotSeed<T>(seed: number, fn: () => T): T {
  const saved = RotRNG.getState();
  RotRNG.setSeed((seed % 2147483646) + 1); // rot.js mangles seeds below 1
  try {
    return fn();
  } finally {
    RotRNG.setState(saved);
  }
}

export function generateFloor(seed: number, index: number, themeId = 'intake_sewers'): Floor {
  const theme = FLOOR_THEMES[themeId];
  if (!theme) throw new Error(`Unknown floor theme: ${themeId}`);
  const rng = createRng(seed);
  const { width, height } = theme;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const layout = withRotSeed(deriveSeed(rng), () => {
      const gen = new RotMap.Uniform(width, height, {
        roomWidth: theme.roomWidth,
        roomHeight: theme.roomHeight,
        roomDugPercentage: theme.roomDugPercentage,
        // rot.js gives up by wall-clock time; make that effectively never so
        // the result depends only on the seed.
        timeLimit: 1e9,
      });
      const tiles: Tile[][] = Array.from({ length: height }, () =>
        Array.from({ length: width }, (): Tile => ({ terrain: 'wall', explored: false, gore: [] })),
      );
      gen.create((x, y, value) => {
        if (value === 0) tiles[y][x].terrain = 'floor';
      });
      const rooms: Room[] = gen.getRooms().map((r, id) => {
        r.getDoors((x, y) => {
          tiles[y][x].terrain = 'door';
        });
        const [cx, cy] = r.getCenter();
        return { id, x1: r.getLeft(), y1: r.getTop(), x2: r.getRight(), y2: r.getBottom(), center: { x: cx, y: cy } };
      });
      return { tiles, rooms };
    });

    const { tiles, rooms } = layout;
    if (rooms.length < theme.rooms.min || rooms.length > theme.rooms.max) continue;

    const startRoom = pick(rng, rooms);
    const start = startRoom.center;
    const grid = { tiles, width, height };
    const dist = bfsDistances(grid, start);

    // Stairs go in the room whose center is the longest walk from the start.
    let stairs: Vec | null = null;
    let best = -1;
    for (const room of rooms) {
      if (room === startRoom) continue;
      const d = dist[room.center.y * width + room.center.x];
      if (d > best) {
        best = d;
        stairs = room.center;
      }
    }
    if (!stairs) continue;
    tiles[stairs.y][stairs.x].terrain = 'stairs';

    const floor: Floor = {
      index,
      theme: theme.id,
      seed,
      width,
      height,
      tiles,
      rooms,
      start: { ...start },
      stairs: { ...stairs },
      entities: [],
      chests: [],
      items: [],
      visible: new Array(width * height).fill(0),
    };
    placeFeatures(floor, rng, theme);
    floor.entities = populate(floor, rng, theme);
    return floor;
  }
  throw new Error(`Floor generation failed for seed ${seed} after ${MAX_ATTEMPTS} attempts`);
}
