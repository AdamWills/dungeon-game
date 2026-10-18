// Places the floor's enemies: none in the start room, a few per other room,
// each with a patrol route around its room and sometimes out to a neighbour.

import { ENEMIES } from '../data/enemies';
import type { FloorTheme } from '../data/floors';
import { weightedPick } from '../game/combat';
import { nextFloat, nextInt, pick, type Rng } from '../game/rng';
import type { Entity, Floor, Room, Vec } from '../game/types';
import { bfsDistances } from './reach';

const MAX_ROAM_DISTANCE = 30; // tiles of walking to a neighbouring room
const FACINGS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function populate(floor: Floor, rng: Rng, theme: FloorTheme): Entity[] {
  const entities: Entity[] = [];
  const taken = new Set<string>([key(floor.start), key(floor.stairs)]);
  const counts: Record<string, number> = {};
  const startRoom = floor.rooms.find((r) => inRoom(r, floor.start));

  for (const room of floor.rooms) {
    if (room === startRoom) continue;
    const n = nextInt(rng, theme.enemiesPerRoom[0], theme.enemiesPerRoom[1]);
    for (let i = 0; i < n; i++) {
      const table = theme.enemies.filter((t) => t.maxPerFloor === undefined || (counts[t.id] ?? 0) < t.maxPerFloor);
      if (!table.length) break;
      const def = ENEMIES[weightedPick(rng, table).id];
      const pos = freeTileIn(room, rng, taken);
      if (!pos) break;
      taken.add(key(pos));
      counts[def.id] = (counts[def.id] ?? 0) + 1;

      const asleep = nextFloat(rng) < def.roam.sleepChance;
      const route = asleep ? [pos] : patrolRoute(floor, room, pos, rng, theme.roamChance);
      entities.push({
        id: `f${floor.index}-e${entities.length}`,
        kind: 'enemy',
        defId: def.id,
        pos: { ...pos },
        facing: pick(rng, FACINGS),
        stats: { ...def.stats, maxHp: def.stats.hp },
        cooldowns: {},
        inventory: [],
        patrol: {
          route,
          visionRange: def.roam.visionRange,
          visionArc: (def.roam.visionArcDeg * Math.PI) / 180,
          hearingRadius: def.roam.hearingRadius,
          alert: 'idle',
        },
        mind: { routeIndex: 0, waitTicks: nextInt(rng, 0, 60), asleep, lostSight: 0, suspicion: 0, turnDelay: 0, lastSeen: null, alertedAt: -1000, stunned: 0 },
      });
    }
  }
  return entities;
}

function patrolRoute(floor: Floor, room: Room, start: Vec, rng: Rng, roamChance: number): Vec[] {
  const route: Vec[] = [start];
  const stops = nextInt(rng, 1, 2);
  for (let i = 0; i < stops; i++) route.push(randomTileIn(room, rng));
  if (nextFloat(rng) < roamChance) {
    const dist = bfsDistances(floor, room.center);
    const near = floor.rooms.filter((r) => {
      const d = dist[r.center.y * floor.width + r.center.x];
      return r !== room && d > 0 && d <= MAX_ROAM_DISTANCE;
    });
    if (near.length) route.push({ ...pick(rng, near).center });
  }
  return route;
}

function freeTileIn(room: Room, rng: Rng, taken: Set<string>): Vec | null {
  for (let tries = 0; tries < 20; tries++) {
    const p = randomTileIn(room, rng);
    if (!taken.has(key(p))) return p;
  }
  return null;
}

function randomTileIn(room: Room, rng: Rng): Vec {
  return { x: nextInt(rng, room.x1, room.x2), y: nextInt(rng, room.y1, room.y2) };
}

function inRoom(r: Room, p: Vec): boolean {
  return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
}

const key = (p: Vec) => `${p.x},${p.y}`;
