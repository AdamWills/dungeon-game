// Places the floor's residents: none in the start room, a few per other room,
// each with a patrol route around its room and sometimes out to a neighbour.
// Also the captives waiting to be recruited and any deserters (Skitch).

import { ELITE, ELITES } from '../data/bosses';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import type { FloorTheme } from '../data/floors';
import { weightedPick } from '../game/combat';
import { nextFloat, nextInt, pick, type Rng } from '../game/rng';
import { makeAlly } from '../game/party';
import type { Entity, Floor, Room, Vec } from '../game/types';
import { bfsDistances, enclosable } from './reach';

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
  const depthOf = (p: Vec) => Math.max(0, fromStart[p.y * floor.width + p.x]) / total;
  const depthOfRoom = (room: Room) => depthOf(room.center);

  // The floor boss waits in the stairs room (its lair), beside the stairs.
  const lair = floor.rooms.find((r) => inRoom(r, floor.stairs))!;
  const bossAt = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ x: floor.stairs.x + dx, y: floor.stairs.y + dy })).find((p) => inRoom(lair, p) && !taken.has(key(p)) && floor.tiles[p.y][p.x].terrain === 'floor') ?? freeTileIn(lair, rng, taken, floor);
  if (bossAt) {
    taken.add(key(bossAt));
    const boss = guard(floor, ENEMIES[theme.floorBoss], bossAt, rng, entities.length);
    entities.push(boss);
    floor.lair = { room: lair.id, bossId: boss.id, found: false, beaten: false };
  }

  // Room bosses: each alone in a room of its own, deeper in.
  const hasCaptive = (r: Room) => captives.some((c) => inRoom(r, c.pos));
  const bossRooms: Room[] = [];
  const candidates = floor.rooms.filter((r) => r !== startRoom && r !== lair && !hasCaptive(r) && depthOfRoom(r) >= theme.roomBosses.minDepth && enclosable(floor, r));
  const ids = [...theme.roomBosses.ids];
  for (let i = nextInt(rng, theme.roomBosses.count[0], theme.roomBosses.count[1]); i > 0 && ids.length && candidates.length; i--) {
    const room = candidates.splice(nextInt(rng, 0, candidates.length - 1), 1)[0];
    const pos = taken.has(key(room.center)) || floor.tiles[room.center.y][room.center.x].terrain !== 'floor' ? freeTileIn(room, rng, taken, floor) : room.center;
    if (!pos) continue;
    taken.add(key(pos));
    const def = ENEMIES[ids.splice(nextInt(rng, 0, ids.length - 1), 1)[0]];
    const boss = guard(floor, def, pos, rng, entities.length);
    entities.push(boss);
    bossRooms.push(room);
    (floor.bossRooms ??= []).push({ room: room.id, bossId: boss.id });
  }

  // Boss rooms are closed off (user request): every way in gets a closed door.
  const sealed = [lair, ...bossRooms];
  for (const room of sealed) sealRoom(floor, room, sealed);

  const firstResident = entities.length;
  for (const room of floor.rooms) {
    if (room === startRoom || room === lair || bossRooms.includes(room)) continue;
    const depth = depthOfRoom(room);
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
  // Elites: a few ordinary residents, past the first rooms, get a trait.
  const plain = entities.slice(firstResident).filter((e) => depthOf(e.pos) >= theme.elites.minDepth);
  for (let i = nextInt(rng, theme.elites.count[0], theme.elites.count[1]); i > 0 && plain.length; i--) {
    const e = plain.splice(nextInt(rng, 0, plain.length - 1), 1)[0];
    makeElite(e, pick(rng, Object.keys(ELITES)));
  }

  // Deserters hang around with a gang somewhere away from the start.
  for (const id of theme.deserters) {
    const rooms = floor.rooms.filter((r) => r !== startRoom && r !== lair && !bossRooms.includes(r));
    if (!rooms.length) break;
    const room = pick(rng, rooms);
    const pos = freeTileIn(room, rng, taken, floor);
    if (!pos) continue;
    taken.add(key(pos));
    entities.push(resident(floor, room, ENEMIES[id], pos, rng, theme, entities.length));
  }
  return entities;
}

/** Put a closed door in every opening around a room, so it reads as its own space. */
function sealRoom(floor: Floor, room: Room, sealed: Room[]): void {
  for (let y = room.y1 - 1; y <= room.y2 + 1; y++)
    for (let x = room.x1 - 1; x <= room.x2 + 1; x++) {
      if (inRoom(room, { x, y })) continue;
      // Only where a passage meets a wall face: never a corner (it leads nowhere).
      const side = (x >= room.x1 && x <= room.x2) || (y >= room.y1 && y <= room.y2);
      const t = floor.tiles[y]?.[x];
      if (!side || !t || (t.terrain !== 'floor' && t.terrain !== 'door')) continue;
      t.terrain = 'door';
      t.door = { open: false };
      // A corridor door just outside would make two doors in a row: keep only ours.
      // (Unless it is the door of another sealed room next door.)
      const ox = x + (x < room.x1 ? -1 : x > room.x2 ? 1 : 0);
      const oy = y + (y < room.y1 ? -1 : y > room.y2 ? 1 : 0);
      const out = floor.tiles[oy]?.[ox];
      const onRing = (r: Room) => ox >= r.x1 - 1 && ox <= r.x2 + 1 && oy >= r.y1 - 1 && oy <= r.y2 + 1;
      if (out?.terrain === 'door' && !sealed.some(onRing)) {
        out.terrain = 'floor';
        delete out.door;
      }
    }
}

/** A boss: awake, standing its ground in its room. */
function guard(floor: Floor, def: EnemyDef, pos: Vec, rng: Rng, n: number): Entity {
  const e = resident(floor, null, def, pos, rng, null, n);
  e.patrol!.route = [{ ...pos }];
  e.mind!.asleep = false;
  return e;
}

/** Give a resident an elite trait: tougher and worth more (data/bosses). */
export function makeElite(e: Entity, trait: string): void {
  e.elite = trait;
  const mult = trait === 'enormous' ? ELITE.enormousHpMult : ELITE.hpMult;
  const s = e.stats;
  s.maxHp = s.hp = Math.round(s.maxHp * mult);
  for (const [k, v] of Object.entries(ELITES[trait].add)) if (k !== 'hp') s[k as keyof typeof s] += v ?? 0;
}

/** One resident with its patrol route. */
function resident(floor: Floor, room: Room | null, def: EnemyDef, pos: Vec, rng: Rng, theme: FloorTheme | null, n: number): Entity {
  const asleep = nextFloat(rng) < def.roam.sleepChance;
  const route = asleep || !room || !theme ? [pos] : patrolRoute(floor, room, pos, rng, theme.roamChance);
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
