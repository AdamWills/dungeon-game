// Doors, chests and hazards. Runs after the layout and stairs, before
// enemies. Keeps the start room clear and never blocks a doorway.

import type { FloorTheme } from '../data/floors';
import type { HazardKind } from '../data/hazards';
import { nextInt, pick, type Rng } from '../game/rng';
import type { Floor, Room, Vec } from '../game/types';

const key = (p: Vec) => `${p.x},${p.y}`;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function inRoom(r: Room, p: Vec): boolean {
  return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
}

export function placeFeatures(floor: Floor, rng: Rng, theme: FloorTheme): void {
  const { tiles, width, height } = floor;
  const taken = new Set<string>([key(floor.start), key(floor.stairs)]);
  const startRoom = floor.rooms.find((r) => inRoom(r, floor.start));
  const otherRooms = floor.rooms.filter((r) => r !== startRoom);
  const isFloor = (x: number, y: number) => tiles[y]?.[x]?.terrain === 'floor';
  const nearDoor = (x: number, y: number) => N4.some(([dx, dy]) => tiles[y + dy]?.[x + dx]?.terrain === 'door');
  const free = (x: number, y: number) => isFloor(x, y) && !taken.has(`${x},${y}`) && !nearDoor(x, y);

  // Every doorway starts closed.
  for (const row of tiles) for (const t of row) if (t.terrain === 'door') t.door = { open: false };

  // Chests sit against room walls, where they never cut a room in two.
  const chestCount = nextInt(rng, theme.chests[0], theme.chests[1]);
  for (let i = 0; i < chestCount && otherRooms.length; i++) {
    const room = pick(rng, otherRooms);
    const edge: Vec[] = [];
    for (let y = room.y1; y <= room.y2; y++)
      for (let x = room.x1; x <= room.x2; x++)
        if ((x === room.x1 || x === room.x2 || y === room.y1 || y === room.y2) && free(x, y)) edge.push({ x, y });
    if (!edge.length) continue;
    const pos = pick(rng, edge);
    taken.add(key(pos));
    floor.chests.push({ id: `chest-${floor.chests.length}`, pos, opened: false });
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
}
