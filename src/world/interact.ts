// The interact key (and bumping into things): stairs, eating remains,
// chests and doors. Plus picking up whatever you step on.

import { RACES } from '../data/races';
import { TUNING } from '../data/tuning';
import { addItem } from '../game/equipment';
import { rollItem } from '../game/loot';
import type { GameState, Vec } from '../game/types';
import { updateFov } from './fov';
import { tileOf } from './motion';

/** Health from eating remains (Gutterfolk), or the price of trying (everyone else). */
export const CORPSE = { heal: 5, hurt: 2 };

export function chestAt(state: GameState, x: number, y: number) {
  return state.floor.chests.find((c) => c.pos.x === x && c.pos.y === y);
}

export function isClosedDoor(state: GameState, x: number, y: number): boolean {
  const t = state.floor.tiles[y]?.[x];
  return !!t?.door && !t.door.open;
}

export function openDoor(state: GameState, at: Vec): void {
  const t = state.floor.tiles[at.y][at.x];
  if (!t.door || t.door.open) return;
  t.door.open = true;
  state.events.push({ type: 'doorOpened', at: { ...at } });
  // Opening a door can reveal what is behind it.
  updateFov(state.floor, tileOf(state.player), TUNING.fovRadius);
}

export function openChest(state: GameState, x: number, y: number): boolean {
  const chest = chestAt(state, x, y);
  if (!chest || chest.opened) return false;
  const item = rollItem(state.rng);
  if (!addItem(state, item, 'chest')) {
    // No room: the prize waits on top of the chest.
    state.floor.items.push({ id: `${chest.id}-spill`, pos: { ...chest.pos }, item });
  }
  chest.opened = true;
  state.events.push({ type: 'chestOpened', id: chest.id });
  return true;
}

/** The tile in front of the player. */
export function facingTile(state: GameState): Vec {
  const p = tileOf(state.player);
  return { x: p.x + Math.round(Math.cos(state.player.facing)), y: p.y + Math.round(Math.sin(state.player.facing)) };
}

/** Pick up everything on the player's tile. */
export function pickUp(state: GameState): void {
  const p = tileOf(state.player);
  const items = state.floor.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.pos.x !== p.x || it.pos.y !== p.y) continue;
    if (addItem(state, it.item, 'floor')) items.splice(i, 1);
  }
}

/** Eat one set of remains on the player's tile. Returns true if there were any. */
export function eatRemains(state: GameState): boolean {
  const p = tileOf(state.player);
  const tile = state.floor.tiles[p.y][p.x];
  const idx = tile.gore.findIndex((g) => g.kind === 'gibs');
  if (idx < 0) return false;
  tile.gore.splice(idx, 1);
  const s = state.player.stats;
  const before = s.hp;
  if (RACES[state.race].eatsCorpses) s.hp = Math.min(s.maxHp, s.hp + CORPSE.heal);
  else s.hp = Math.max(1, s.hp - CORPSE.hurt);
  state.events.push({ type: 'corpseEaten', hp: s.hp - before });
  return true;
}
