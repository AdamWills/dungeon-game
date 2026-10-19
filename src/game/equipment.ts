// The contestant's stats, gear and pockets: stats are class + race + worn
// items; the inventory screen equips, uses and drops things while time is
// paused.

import { CLASSES, FISTS } from '../data/classes';
import { INVENTORY_CAP, ITEMS, type ItemDef, type ItemSlot, type StatKey } from '../data/items';
import { RACES } from '../data/races';
import type { StatusKind } from '../data/statuses';
import { TUNING } from '../data/tuning';
import { giveItem, setStance } from './party';
import { takePerk, train } from './progress';
import { tileOf } from '../world/motion';
import type { Entity, EquipSlot, Equipment, GameState, InvCommand, ItemInstance, Stats, Vec } from './types';

/** Paper-doll slots, in the order the pause screen shows them (two columns of six). */
export const SLOTS: readonly EquipSlot[] = ['head', 'neck', 'shoulders', 'body', 'belt', 'legs', 'weapon', 'offhand', 'hands', 'ring1', 'ring2', 'feet'];
export type Slot = EquipSlot;

/** Which equipment slot(s) an item of this kind can go in. */
export function slotsFor(kind: ItemSlot): Slot[] {
  return kind === 'ring' ? ['ring1', 'ring2'] : [kind];
}

/** Where equipping this would put it: an empty fitting slot first, else the first one. */
export function targetSlot(player: Entity, kind: ItemSlot): Slot {
  const options = slotsFor(kind);
  return options.find((s) => !player.equipment?.[s]) ?? options.find((s) => !ITEMS[player.equipment![s]!.defId]?.cursed) ?? options[0];
}

/**
 * Stats from class, race, level-up points and equipment. `hp` is the max;
 * callers keep current HP. Every second point in a favored stat is free.
 */
export function computeStats(raceId: string, clsId: string, equipment: Equipment, trained: Partial<Record<StatKey, number>> = {}): Stats {
  const cls = CLASSES[clsId];
  const base = cls.base;
  const race = RACES[raceId];
  const s: Stats = { ...base, maxHp: base.hp };
  s.maxHp += race.mods.maxHp ?? 0;
  s.charm += race.mods.charm ?? 0;
  for (const [k, n] of Object.entries(trained) as [StatKey, number][]) {
    const points = n + (cls.favored.includes(k) ? Math.floor(n / 2) : 0);
    s[k] += points * TUNING.pointValue[k];
  }
  for (const slot of SLOTS) {
    const inst = equipment[slot];
    const mods = inst ? ITEMS[inst.defId]?.mods : undefined;
    if (!mods) continue;
    for (const [k, v] of Object.entries(mods) as [StatKey, number][]) s[k] += v;
  }
  s.maxHp = Math.max(1, s.maxHp);
  s.hp = s.maxHp;
  return s;
}

/** Recompute the player's stats after gear changes, keeping damage taken. */
export function refreshPlayerStats(state: GameState): void {
  const p = state.player;
  const lost = p.stats.maxHp - p.stats.hp;
  const next = computeStats(state.race, state.cls, p.equipment ?? {}, state.trained);
  next.hp = Math.max(1, Math.min(next.maxHp, next.maxHp - lost));
  if (p.stats.hp <= 0) next.hp = 0;
  p.stats = next;
}

export function weaponOf(player: Entity): { name: string; damage: number; onHit?: NonNullable<ItemDef['weapon']>['onHit'] } {
  const inst = player.equipment?.weapon;
  const def = inst && ITEMS[inst.defId];
  return def?.weapon ? { name: def.name, ...def.weapon } : FISTS;
}

export function playerResists(state: GameState): StatusKind[] {
  const out = [...RACES[state.race].resists];
  for (const slot of SLOTS) {
    const inst = state.player.equipment?.[slot];
    if (inst) out.push(...(ITEMS[inst.defId]?.resists ?? []));
  }
  return out;
}

/** Items in your pockets (worn gear does not count against the cap). */
export function carriedCount(player: Entity): number {
  return player.inventory.length;
}

/**
 * Offer an item on a prize card: the game pauses and you choose to take it or
 * leave it (user request). False if your pockets are already full.
 */
export function addItem(state: GameState, item: ItemInstance, from: 'chest' | 'floor', at: Vec = tileOf(state.player)): boolean {
  if (carriedCount(state.player) + state.reveals.length >= INVENTORY_CAP) {
    state.events.push({ type: 'inventoryFull', defId: item.defId });
    return false;
  }
  state.reveals.push({ item, from, at: { ...at } });
  if (state.mode === 'roaming') {
    state.mode = 'menu';
    state.events.push({ type: 'modeChanged', from: 'roaming', to: 'menu' });
  }
  return true;
}

/** Take the item on the prize card into your pockets. */
export function takeOffer(state: GameState): void {
  const offer = state.reveals.shift();
  if (!offer) return;
  state.player.inventory.push(offer.item);
  state.events.push({ type: 'itemPicked', defId: offer.item.defId, from: offer.from });
}

/** Leave the item on the prize card where it was found. You can come back for it (E). */
export function leaveOffer(state: GameState): void {
  const offer = state.reveals.shift();
  if (!offer) return;
  state.floor.items.push({ id: `left-${state.tick}-${state.floor.items.length}`, pos: { ...offer.at }, item: offer.item, left: true });
}

export function inventoryCommand(state: GameState, cmd: InvCommand): void {
  const p = state.player;
  p.equipment ??= {};
  if (state.levelUp) {
    // The level-up screen comes first: spend the points, pick the perk.
    if (cmd.kind === 'train') train(state, cmd.stat);
    else if (cmd.kind === 'perk') takePerk(state, cmd.id);
    return;
  }
  if (state.reveals.length) {
    // While a prize card is up, the only thing to do is take it or leave it.
    if (cmd.kind === 'dismiss') takeOffer(state);
    else if (cmd.kind === 'leave') leaveOffer(state);
    else return;
    if (!state.reveals.length) {
      state.mode = 'roaming';
      state.events.push({ type: 'modeChanged', from: 'menu', to: 'roaming' });
    }
    return;
  }
  switch (cmd.kind) {
    case 'dismiss':
    case 'leave':
    case 'train':
    case 'perk':
      return;
    case 'give':
      giveItem(state, cmd.slot, cmd.allyId);
      return;
    case 'stance':
      setStance(state, cmd.allyId, cmd.stance);
      return;
    case 'equip': {
      const inst = p.inventory[cmd.slot];
      const def = inst && ITEMS[inst.defId];
      if (!def?.slot) return;
      const slot = targetSlot(p, def.slot);
      const worn = p.equipment[slot];
      if (worn && ITEMS[worn.defId]?.cursed) {
        state.events.push({ type: 'itemRefused', defId: worn.defId, reason: 'cursed' });
        return;
      }
      p.inventory.splice(cmd.slot, 1);
      if (worn) p.inventory.push(worn);
      p.equipment[slot] = inst;
      refreshPlayerStats(state);
      state.events.push({ type: 'itemEquipped', defId: inst.defId, slot });
      return;
    }
    case 'unequip': {
      const worn = p.equipment[cmd.slot];
      if (!worn) return;
      if (ITEMS[worn.defId]?.cursed) {
        state.events.push({ type: 'itemRefused', defId: worn.defId, reason: 'cursed' });
        return;
      }
      if (carriedCount(p) >= INVENTORY_CAP) {
        state.events.push({ type: 'inventoryFull', defId: worn.defId });
        return;
      }
      p.equipment[cmd.slot] = undefined;
      p.inventory.push(worn);
      refreshPlayerStats(state);
      return;
    }
    case 'use': {
      const inst = p.inventory[cmd.slot];
      const def = inst && ITEMS[inst.defId];
      if (!def) return;
      if (!def.use) {
        state.events.push({ type: 'itemRefused', defId: def.id, reason: 'notUsable' });
        return;
      }
      if (def.use.battleOnly || def.use.target !== 'self') {
        state.events.push({ type: 'itemRefused', defId: def.id, reason: 'battleOnly' });
        return;
      }
      state.record.lastAction = { kind: 'item', item: def.id };
      for (const eff of def.use.effects) {
        if (eff.kind === 'heal') p.stats.hp = Math.min(p.stats.maxHp, p.stats.hp + eff.amount);
        // Statuses only exist in battle, so cleanse has nothing to do out here.
      }
      if (def.use.consumable) p.inventory.splice(cmd.slot, 1);
      state.events.push({ type: 'itemUsed', defId: def.id });
      return;
    }
    case 'drop': {
      const inst = p.inventory[cmd.slot];
      if (!inst) return;
      p.inventory.splice(cmd.slot, 1);
      const at = { x: Math.round(p.pos.x), y: Math.round(p.pos.y) };
      // Dropped on purpose: it waits for you (E) rather than popping up again.
      state.floor.items.push({ id: `drop-${state.tick}-${state.floor.items.length}`, pos: at, item: inst, left: true });
      return;
    }
  }
}

const STAT_NAMES: Record<StatKey, string> = { maxHp: 'Max HP', str: 'Strength', speed: 'Speed', evasion: 'Evasion', armor: 'Armor', charm: 'Charm' };

/**
 * What wearing an item would change, against what you have on now, so a
 * "+3 Strength" means something (user feedback). Includes weapon damage.
 */
export function equipPreview(state: GameState, defId: string): { name: string; before: number; after: number }[] {
  const def = ITEMS[defId];
  if (!def?.slot) return [];
  const p = state.player;
  const now = computeStats(state.race, state.cls, p.equipment ?? {}, state.trained);
  const next = computeStats(state.race, state.cls, { ...p.equipment, [targetSlot(p, def.slot)]: { defId, identified: true } }, state.trained);
  const out = (Object.keys(STAT_NAMES) as StatKey[])
    .filter((k) => now[k] !== next[k])
    .map((k) => ({ name: STAT_NAMES[k], before: now[k], after: next[k] }));
  if (def.weapon) {
    const before = weaponOf(p).damage;
    if (before !== def.weapon.damage) out.unshift({ name: 'Weapon damage', before, after: def.weapon.damage });
  }
  return out;
}
