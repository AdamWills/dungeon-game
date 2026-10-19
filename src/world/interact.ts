// The interact key (and bumping into things): stairs, eating remains,
// chests and doors. Plus picking up whatever you step on.

import { RACES } from '../data/races';
import { TUNING } from '../data/tuning';
import { addItem } from '../game/equipment';
import { depthOf, rollItem } from '../game/loot';
import { nextInt } from '../game/rng';
import type { GameState, Vec } from '../game/types';
import { updateFov } from './fov';
import { tileOf } from './motion';

/** Health from eating remains (Gutterfolk), or the price of trying (everyone else). */
export const CORPSE = { heal: 5, hurt: 2 };

export function chestAt(state: GameState, x: number, y: number) {
  return state.floor.chests.find((c) => c.pos.x === x && c.pos.y === y);
}

export function propAt(state: GameState, x: number, y: number) {
  return state.floor.props.find((p) => p.pos.x === x && p.pos.y === y);
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
  const item = rollItem(state.rng, depthOf(state.floor, chest.pos));
  const tokens = nextInt(state.rng, TUNING.chestTokens[0], TUNING.chestTokens[1]);
  state.tokens += tokens;
  state.events.push({ type: 'tokensGained', amount: tokens, from: 'chest' });
  // Chests block their tile, so anything left behind lands at your feet.
  const feet = tileOf(state.player);
  if (!addItem(state, item, 'chest', feet)) {
    // No room: the prize waits for you on the floor.
    state.floor.items.push({ id: `${chest.id}-spill`, pos: feet, item, left: true });
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

/**
 * Offer everything on the player's tile. Things you chose to leave stay put
 * unless you ask for them (`all`, from the interact key).
 */
export function pickUp(state: GameState, all = false): boolean {
  const p = tileOf(state.player);
  const items = state.floor.items;
  let offered = false;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.pos.x !== p.x || it.pos.y !== p.y || (it.left && !all)) continue;
    if (addItem(state, it.item, 'floor', it.pos)) {
      items.splice(i, 1);
      offered = true;
    }
  }
  return offered;
}

/** A thing you left on this tile, if any (for the prompt). */
export function leftItemHere(state: GameState) {
  const p = tileOf(state.player);
  return state.floor.items.find((it) => it.left && it.pos.x === p.x && it.pos.y === p.y);
}

/** Eat one set of remains on the player's tile. Returns true if there were any. */
export function eatRemains(state: GameState): boolean {
  const p = tileOf(state.player);
  const tile = state.floor.tiles[p.y][p.x];
  const idx = tile.gore.findIndex((g) => g.kind === 'gibs');
  if (idx < 0) return false;
  tile.gore.splice(idx, 1);
  state.record.lastAction = { kind: 'eat' };
  const s = state.player.stats;
  const before = s.hp;
  if (RACES[state.race].eatsCorpses) s.hp = Math.min(s.maxHp, s.hp + CORPSE.heal);
  else s.hp = Math.max(1, s.hp - CORPSE.hurt);
  state.events.push({ type: 'corpseEaten', hp: s.hp - before });
  return true;
}
