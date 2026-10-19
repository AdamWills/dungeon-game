// Doors, chests and hazards. Runs after the layout and stairs, before
// enemies. Keeps the start room clear and never blocks a doorway.

import type { FloorTheme } from '../data/floors';
import type { HazardKind } from '../data/hazards';
import { PROP_RULES, PROPS } from '../data/props';
import { weightedPick } from '../game/combat';
import { nextInt, pick, type Rng } from '../game/rng';
import type { Floor, Room, Vec } from '../game/types';
import { bfsDistances, isWalkable } from './reach';

const key = (p: Vec) => `${p.x},${p.y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function inRoom(r: Room, p: Vec): boolean {
  return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
}

/** Returns where the captives stand: one tile each, in different rooms. */
export function placeFeatures(floor: Floor, rng: Rng, theme: FloorTheme): { allyId: string; pos: Vec }[] {
  const { tiles, width, height } = floor;
  const taken = new Set<string>([key(floor.start), key(floor.stairs)]);
  const startRoom = floor.rooms.find((r) => inRoom(r, floor.start));
  const otherRooms = floor.rooms.filter((r) => r !== startRoom);
  const isFloor = (x: number, y: number) => tiles[y]?.[x]?.terrain === 'floor';
  const nearDoor = (x: number, y: number) => N4.some(([dx, dy]) => tiles[y + dy]?.[x + dx]?.terrain === 'door');
  const free = (x: number, y: number) => isFloor(x, y) && !taken.has(`${x},${y}`) && !nearDoor(x, y);

  // Every doorway starts closed.
  for (const row of tiles) for (const t of row) if (t.terrain === 'door') t.door = { open: false };

  // Chests and props sit against room walls and block movement, so each one is
  // only placed if every walkable tile can still be reached afterwards.
  const blockers = new Set<string>();
  let walkable = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (isWalkable(floor, x, y)) walkable++;
  const keepsEverythingReachable = (pos: Vec) => {
    const trial = new Set(blockers).add(key(pos));
    const dist = bfsDistances(floor, floor.start, (x, y) => trial.has(`${x},${y}`));
    let reached = 0;
    for (const d of dist) if (d >= 0) reached++;
    return reached === walkable - trial.size;
  };
  const edgeSpot = (rooms = otherRooms): Vec | null => {
    const room = pick(rng, rooms);
    const edge: Vec[] = [];
    for (let y = room.y1; y <= room.y2; y++)
      for (let x = room.x1; x <= room.x2; x++)
        if ((x === room.x1 || x === room.x2 || y === room.y1 || y === room.y2) && free(x, y)) edge.push({ x, y });
    while (edge.length) {
      const pos = edge.splice(nextInt(rng, 0, edge.length - 1), 1)[0];
      if (!keepsEverythingReachable(pos)) continue;
      taken.add(key(pos));
      blockers.add(key(pos));
      return pos;
    }
    return null;
  };
  const chestCount = nextInt(rng, theme.chests[0], theme.chests[1]);
  for (let i = 0; i < chestCount && otherRooms.length; i++) {
    const pos = edgeSpot();
    if (pos) floor.chests.push({ id: `chest-${floor.chests.length}`, pos, opened: false });
  }
  const placeable = Object.values(PROPS).filter((p) => p.placed);
  const propCount = nextInt(rng, PROP_RULES.perFloor[0], PROP_RULES.perFloor[1]);
  for (let i = 0; i < propCount && otherRooms.length; i++) {
    const pos = edgeSpot();
    if (!pos) continue;
    const def = weightedPick(rng, placeable);
    floor.props.push({ id: `prop-${floor.props.length}`, defId: def.id, pos, usesLeft: def.uses });
  }

  // Captives also stand still and block the way, so they get the same check.
  const captives: { allyId: string; pos: Vec }[] = [];
  const used = new Set<Room>();
  for (const allyId of theme.captives) {
    const rooms = otherRooms.filter((r) => !used.has(r) && !inRoom(r, floor.stairs));
    if (!rooms.length) break;
    for (let tries = 0; tries < 6; tries++) {
      const pos = edgeSpot(rooms);
      if (!pos) continue;
      used.add(floor.rooms.find((r) => inRoom(r, pos))!);
      captives.push({ allyId, pos });
      break;
    }
  }

  const setHazard = (p: Vec, kind: HazardKind) => {
    tiles[p.y][p.x].terrain = 'hazard';
    tiles[p.y][p.x].hazard = kind;
    taken.add(key(p));
  };

  // Sludge pools: small blobs grown inside rooms.
  const pools = nextInt(rng, theme.hazards.sludgePools[0], theme.hazards.sludgePools[1]);
  for (let i = 0; i < pools && otherRooms.length; i++) {
    const room = pick(rng, otherRooms);
    const seed = { x: nextInt(rng, room.x1 + 1, Math.max(room.x1 + 1, room.x2 - 1)), y: nextInt(rng, room.y1 + 1, Math.max(room.y1 + 1, room.y2 - 1)) };
    if (!free(seed.x, seed.y)) continue;
    const size = nextInt(rng, 3, 6);
    const blob = [seed];
    setHazard(seed, 'sludge');
    for (let tries = 0; blob.length < size && tries < 30; tries++) {
      const from = pick(rng, blob);
      const [dx, dy] = pick(rng, N4);
      const p = { x: from.x + dx, y: from.y + dy };
      if (inRoom(room, p) && free(p.x, p.y)) {
        setHazard(p, 'sludge');
        blob.push(p);
      }
    }
  }

  // Spikes guard corridors; gas vents sit in rooms.
  const corridor: Vec[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (free(x, y) && !floor.rooms.some((r) => inRoom(r, { x, y }))) corridor.push({ x, y });
  const spikes = nextInt(rng, theme.hazards.spikes[0], theme.hazards.spikes[1]);
  for (let i = 0; i < spikes && corridor.length; i++) {
    const p = corridor.splice(nextInt(rng, 0, corridor.length - 1), 1)[0];
    if (free(p.x, p.y)) setHazard(p, 'spikes');
  }
  const vents = nextInt(rng, theme.hazards.gasVents[0], theme.hazards.gasVents[1]);
  for (let i = 0; i < vents && otherRooms.length; i++) {
    const room = pick(rng, otherRooms);
    const p = { x: nextInt(rng, room.x1, room.x2), y: nextInt(rng, room.y1, room.y2) };
    if (free(p.x, p.y)) setHazard(p, 'gas_vent');
  }
  return captives;
}
