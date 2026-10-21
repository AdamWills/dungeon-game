// Stamps the floor's set pieces (data/setPieces) into rooms of their own,
// before chests, props, hazards and residents, which then keep out of them.
// Each gets its station against the top wall, and whatever it rolls up front:
// the vendor's shelves, what is behind each pipe, the right valve.

import type { FloorTheme } from '../data/floors';
import { PIPES, SET_PIECES, SHOP, VALVES } from '../data/setPieces';
import { rollItemOf } from '../game/loot';
import { nextInt, type Rng } from '../game/rng';
import type { Floor, Room, SetPiece, Vec } from '../game/types';
import { bfsDistances } from './reach';

const inRoom = (r: Room, p: Vec) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;

/** Rooms holding a set piece (chests, hazards and residents stay out). */
export function setPieceRooms(floor: Floor): Set<number> {
  return new Set((floor.setPieces ?? []).map((p) => p.room));
}

export function placeSetPieces(floor: Floor, rng: Rng, theme: FloorTheme): void {
  floor.setPieces = [];
  const dist = bfsDistances(floor, floor.start);
  const total = Math.max(1, dist[floor.stairs.y * floor.width + floor.stairs.x]);
  const depth = (r: Room) => Math.max(0, dist[r.center.y * floor.width + r.center.x]) / total;
  const used: Room[] = [];
  for (const { kind, minDepth } of theme.setPieces) {
    const def = SET_PIECES[kind];
    const fits = floor.rooms.filter(
      (r) =>
        !inRoom(r, floor.start) &&
        !inRoom(r, floor.stairs) &&
        !used.includes(r) &&
        r.x2 - r.x1 + 1 >= def.minSize.w &&
        r.y2 - r.y1 + 1 >= def.minSize.h &&
        depth(r) >= minDepth &&
        dist[r.center.y * floor.width + r.center.x] > 0,
    );
    // Spread them out: rooms far from the other set pieces first.
    const apart = fits.filter((r) => used.every((u) => Math.abs(u.center.x - r.center.x) + Math.abs(u.center.y - r.center.y) >= 24));
    const pool = apart.length ? apart : fits;
    while (pool.length) {
      const room = pool.splice(nextInt(rng, 0, pool.length - 1), 1)[0];
      const station = def.station ? stationSpot(floor, room) : null;
      if (def.station && !station) continue;
      used.push(room);
      const piece: SetPiece = { id: `sp-${floor.setPieces.length}`, kind, room: room.id, station, found: false, done: false, flags: [] };
      if (def.patience !== undefined) piece.patience = def.patience;
      roll(floor, rng, piece, room);
      floor.setPieces.push(piece);
      break;
    }
  }
}

/** Against the top wall, away from the corners and any door. */
function stationSpot(floor: Floor, room: Room): Vec | null {
  const t = (x: number, y: number) => floor.tiles[y]?.[x]?.terrain;
  const nearDoor = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => t(x + dx, y + dy) === 'door');
  const mid = Math.round((room.x1 + room.x2) / 2);
  const xs = [...Array(room.x2 - room.x1 - 1).keys()].map((i) => room.x1 + 1 + i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  for (const x of xs) if (t(x, room.y1) === 'floor' && t(x, room.y1 - 1) === 'wall' && !nearDoor(x, room.y1)) return { x, y: room.y1 };
  return null;
}

/** What each set piece decides when the floor is made. */
function roll(floor: Floor, rng: Rng, piece: SetPiece, room: Room): void {
  switch (piece.kind) {
    case 'gutter_mart': {
      const have = new Set<string>();
      piece.stock = SHOP.shelves.map((rarity) => {
        const item = rollItemOf(rng, [rarity], undefined, have);
        have.add(item.defId);
        return { defId: item.defId, sold: false };
      });
      return;
    }
    case 'pick_a_pipe': {
      const pipes = [...PIPES.contents];
      for (let i = pipes.length - 1; i > 0; i--) {
        const j = nextInt(rng, 0, i);
        [pipes[i], pipes[j]] = [pipes[j], pipes[i]];
      }
      piece.pipes = pipes;
      return;
    }
    case 'valve_room':
      piece.answer = nextInt(rng, 0, VALVES.colours.length - 1);
      piece.tries = VALVES.tries;
      return;
    case 'drain_gauntlet': {
      // Rings of spikes around a prize chest, with a couple of gas vents between them.
      const c = room.center;
      const between: Vec[] = [];
      for (let y = room.y1; y <= room.y2; y++)
        for (let x = room.x1; x <= room.x2; x++) {
          const d = Math.max(Math.abs(x - c.x), Math.abs(y - c.y));
          const tile = floor.tiles[y][x];
          if (d === 0 || tile.terrain !== 'floor') continue;
          if (d % 2 === 1) {
            tile.terrain = 'hazard';
            tile.hazard = 'spikes';
          } else between.push({ x, y });
        }
      for (let i = 0; i < 2 && between.length; i++) {
        const p = between.splice(nextInt(rng, 0, between.length - 1), 1)[0];
        floor.tiles[p.y][p.x].terrain = 'hazard';
        floor.tiles[p.y][p.x].hazard = 'gas_vent';
      }
      floor.chests.push({ id: `chest-${piece.id}`, pos: { ...c }, opened: false, prize: 'special' });
      return;
    }
  }
}
