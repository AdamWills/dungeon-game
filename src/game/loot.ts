// Rolling items for chests and drops: pick a rarity by weight, then an item
// of that rarity. Class kit pieces never turn up as loot.

import { DROP_WEIGHTS, ITEMS, RARITY_WEIGHTS, type Rarity } from '../data/items';
import { weightedPick } from './combat';
import { pick, type Rng } from './rng';
import { bfsDistances } from '../gen/reach';
import type { Floor, ItemInstance, Vec } from './types';

/** Cursed items appear from this far along the floor. */
export const CURSED_FROM = 0.5;

const POOL: Record<Rarity, string[]> = { junk: [], standard: [], special: [], cursed: [], hosts_pick: [] };
for (const def of Object.values(ITEMS)) if (!def.noLoot) POOL[def.rarity].push(def.id);

/**
 * `deep` is how far along the floor the loot is (0 at the start, 1 at the
 * stairs). Cursed items only turn up in the second half: nobody should be
 * stuck with one in the first room (user feedback).
 */
export function rollItem(rng: Rng, deep = 1, from: 'chest' | 'drop' = 'chest', pool?: (rarity: Rarity) => string | undefined): ItemInstance {
  const weights = from === 'drop' ? DROP_WEIGHTS : RARITY_WEIGHTS;
  const rarities = (Object.keys(weights) as Rarity[])
    .filter((r) => POOL[r].length && weights[r] > 0 && (r !== 'cursed' || deep >= CURSED_FROM))
    .map((r) => ({ r, weight: weights[r] }));
  const { r } = weightedPick(rng, rarities);
  // A one-of-a-kind AI item of that rarity, if one is ready; else a hand-written one.
  const invented = pool?.(r);
  return { defId: invented ?? pick(rng, POOL[r]), identified: true };
}

/** How far along the floor a tile is, from 0 (start) to 1 (stairs), by walking distance. */
export function depthOf(floor: Floor, at: Vec): number {
  const dist = bfsDistances(floor, floor.start);
  const d = dist[at.y * floor.width + at.x];
  const total = dist[floor.stairs.y * floor.width + floor.stairs.x];
  return d < 0 || total <= 0 ? 1 : Math.min(1, d / total);
}

/** A guaranteed prize: an item of one of these rarities (bosses). */
export function rollItemOf(rng: Rng, rarities: Rarity[], pool?: (rarity: Rarity) => string | undefined, owned: Set<string> = new Set()): ItemInstance {
  // Boss prizes: a fresh AI item first; else a hand-written one you do not already have.
  for (const r of [...rarities].reverse()) {
    const invented = pool?.(r);
    if (invented) return { defId: invented, identified: true };
  }
  let choices = rarities.flatMap((r) => POOL[r]).filter((id) => !owned.has(id));
  if (!choices.length) choices = POOL.special.filter((id) => !owned.has(id));
  return { defId: pick(rng, choices.length ? choices : POOL.standard), identified: true };
}
