// Places the floor's residents: none in the start room, a few per other room,
// each with a patrol route around its room and sometimes out to a neighbour.
// Also the captives waiting to be recruited and any deserters (Skitch).

import { ENEMIES, type EnemyDef } from '../data/enemies';
import type { FloorTheme } from '../data/floors';
import { weightedPick } from '../game/combat';
import { nextFloat, nextInt, pick, type Rng } from '../game/rng';
import { makeAlly } from '../game/party';
import type { Entity, Floor, Room, Vec } from '../game/types';
import { bfsDistances } from './reach';

const MAX_ROAM_DISTANCE = 30; // tiles of walking to a neighbouring room
const FACINGS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function populate(floor: Floor, rng: Rng, theme: FloorTheme, captives: { allyId: string; pos: Vec }[] = []): Entity[] {
  const entities: Entity[] = captives.map((c) => makeAlly(c.allyId, c.pos, 1, false));
  const taken = new Set<string>([
    key(floor.start),
    key(floor.stairs),
    ...floor.chests.map((c) => key(c.pos)),
    ...floor.props.map((p) => key(p.pos)),
    ...captives.map((c) => key(c.pos)),
  ]);
  const counts: Record<string, number> = {};
  const startRoom = floor.rooms.find((r) => inRoom(r, floor.start));

  const fromStart = bfsDistances(floor, floor.start);
  const total = Math.max(1, fromStart[floor.stairs.y * floor.width + floor.stairs.x]);
  for (const room of floor.rooms) {
    if (room === startRoom) continue;
    const depth = Math.max(0, fromStart[room.center.y * floor.width + room.center.x]) / total;
    const most = depth < theme.quietDepth ? Math.min(1, theme.enemiesPerRoom[1]) : theme.enemiesPerRoom[1];
    const n = nextInt(rng, theme.enemiesPerRoom[0], most);
    for (let i = 0; i < n; i++) {
      const table = theme.enemies.filter((t) => (t.maxPerFloor === undefined || (counts[t.id] ?? 0) < t.maxPerFloor) && depth >= (t.minDepth ?? 0));
      if (!table.length) break;
      const def = ENEMIES[weightedPick(rng, table).id];
      const pos = freeTileIn(room, rng, taken, floor);
      if (!pos) break;
      taken.add(key(pos));
      counts[def.id] = (counts[def.id] ?? 0) + 1;
      entities.push(resident(floor, room, def, pos, rng, theme, entities.length));
    }
  }
  // Deserters hang around with a gang somewhere away from the start.
  for (const id of theme.deserters) {
    const rooms = floor.rooms.filter((r) => r !== startRoom && !inRoom(r, floor.stairs));
    if (!rooms.length) break;
    const room = pick(rng, rooms);
    const pos = freeTileIn(room, rng, taken, floor);
    if (!pos) continue;
    taken.add(key(pos));
    entities.push(resident(floor, room, ENEMIES[id], pos, rng, theme, entities.length));
  }
  return entities;
}

/** One resident with its patrol route. */
function resident(floor: Floor, room: Room, def: EnemyDef, pos: Vec, rng: Rng, theme: FloorTheme, n: number): Entity {
  const asleep = nextFloat(rng) < def.roam.sleepChance;
  const route = asleep ? [pos] : patrolRoute(floor, room, pos, rng, theme.roamChance);
  return {
    id: `f${floor.index}-e${n}`,
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
  };
}

function patrolRoute(floor: Floor, room: Room, start: Vec, rng: Rng, roamChance: number): Vec[] {
  const route: Vec[] = [start];
  const stops = nextInt(rng, 1, 2);
  const chests = new Set([...floor.chests, ...floor.props].map((c) => key(c.pos)));
  for (let i = 0; i < stops; i++) {
    const p = randomTileIn(room, rng);
    if (!chests.has(key(p))) route.push(p);
  }
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

function freeTileIn(room: Room, rng: Rng, taken: Set<string>, floor: Floor): Vec | null {
  for (let tries = 0; tries < 20; tries++) {
    const p = randomTileIn(room, rng);
    if (!taken.has(key(p)) && floor.tiles[p.y][p.x].terrain === 'floor') return p;
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
