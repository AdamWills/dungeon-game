// The floor boss's lair (user decision): the stairs room. The boss roars when
// you get near, which marks the lair on your map; walking in starts the fight;
// fleeing puts you back outside and it heals up; the stairs open once it dies.

import { LAIR } from '../data/bosses';
import { startBattle } from '../battle/turns';
import type { Entity, GameState, Room, Vec } from '../game/types';
import { distance } from './motion';
import { playerTile } from './roam';

export function lairRoom(state: GameState): Room | null {
  const lair = state.floor.lair;
  return lair ? (state.floor.rooms.find((r) => r.id === lair.room) ?? null) : null;
}

export function lairBoss(state: GameState): Entity | null {
  const lair = state.floor.lair;
  return lair ? (state.floor.entities.find((e) => e.id === lair.bossId) ?? null) : null;
}

/** True while the floor boss still guards the stairs. */
export function stairsSealed(state: GameState): boolean {
  return !!state.floor.lair && !state.floor.lair.beaten;
}

function inside(r: Room, p: Vec): boolean {
  return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
}

/** Each roaming tick: the roar, and the fight when you walk in. */
export function updateLair(state: GameState): void {
  const lair = state.floor.lair;
  const room = lairRoom(state);
  const boss = lairBoss(state);
  if (!lair || lair.beaten || !room || !boss) return;
  if (!lair.found && state.tick % LAIR.checkTicks === 0) {
    const seen = state.floor.rooms.filter((r) => state.floor.tiles[r.center.y][r.center.x].explored).length;
    if (distance(state.player.pos, room.center) <= LAIR.roarDistance || seen >= state.floor.rooms.length * LAIR.roarRooms) roar(state, room, boss);
  }
  if (state.grace > 0 || state.dash.active > 0) return;
  if (inside(room, playerTile(state))) {
    if (!lair.found) roar(state, room, boss);
    const at = playerTile(state);
    startBattle(state, { enemyIds: [boss.id], start: 'normal', tile: { ...at } });
  }
}

/**
 * Room bosses (user request): walking into a room boss's room starts the
 * fight at once, on its ROOM BOSS card, just like the lair.
 */
export function updateBossRooms(state: GameState): void {
  if (state.grace > 0 || state.dash.active > 0 || !state.floor.bossRooms) return;
  const at = playerTile(state);
  for (const br of state.floor.bossRooms) {
    const room = state.floor.rooms.find((r) => r.id === br.room);
    const boss = state.floor.entities.find((e) => e.id === br.bossId);
    if (room && boss && inside(room, at)) return startBattle(state, { enemyIds: [boss.id], start: 'normal', tile: { ...at } });
  }
}

/** After fleeing a room boss: you land just outside its door, and it heals up. */
export function leaveBossRoom(state: GameState, bossId: string): void {
  const br = state.floor.bossRooms?.find((b) => b.bossId === bossId);
  const room = br && state.floor.rooms.find((r) => r.id === br.room);
  if (room) leaveRoom(state, room, state.floor.entities.find((e) => e.id === bossId) ?? null);
}

/** The boss roars: its lair shows up on your map. */
function roar(state: GameState, room: Room, boss: Entity): void {
  state.floor.lair!.found = true;
  for (let y = room.y1 - 1; y <= room.y2 + 1; y++)
    for (let x = room.x1 - 1; x <= room.x2 + 1; x++) {
      const t = state.floor.tiles[y]?.[x];
      if (t) t.explored = true;
    }
  state.events.push({ type: 'bossRoared', defId: boss.defId });
}

/** After fleeing the floor boss: it heals up, and you land just outside its door. */
export function leaveLair(state: GameState): void {
  const room = lairRoom(state);
  if (room) leaveRoom(state, room, lairBoss(state));
}

function leaveRoom(state: GameState, room: Room, boss: Entity | null): void {
  if (boss) boss.stats.hp = boss.stats.maxHp;
  const f = state.floor;
  const here = playerTile(state);
  let best: Vec | null = null;
  for (let y = room.y1 - 1; y <= room.y2 + 1; y++)
    for (let x = room.x1 - 1; x <= room.x2 + 1; x++) {
      if (inside(room, { x, y })) continue;
      const t = f.tiles[y]?.[x];
      if (!t || (t.terrain !== 'door' && t.terrain !== 'floor')) continue;
      if (!best || distance({ x, y }, here) < distance(best, here)) best = { x, y };
    }
  if (!best) return;
  const door = f.tiles[best.y][best.x].door;
  if (door) door.open = true;
  for (const e of [state.player, ...state.party]) {
    e.pos = { ...best };
    e.motion = undefined;
  }
  state.trail = [];
}
