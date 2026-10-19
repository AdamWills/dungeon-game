// Rolling items for chests and drops: pick a rarity by weight, then an item
// of that rarity. Class kit pieces never turn up as loot.

import { ITEMS, RARITY_WEIGHTS, type Rarity } from '../data/items';
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
export function rollItem(rng: Rng, deep = 1): ItemInstance {
  const rarities = (Object.keys(RARITY_WEIGHTS) as Rarity[])
    .filter((r) => POOL[r].length && (r !== 'cursed' || deep >= CURSED_FROM))
    .map((r) => ({ r, weight: RARITY_WEIGHTS[r] }));
  const { r } = weightedPick(rng, rarities);
  return { defId: pick(rng, POOL[r]), identified: true };
}

/** How far along the floor a tile is, from 0 (start) to 1 (stairs), by walking distance. */
export function depthOf(floor: Floor, at: Vec): number {
  const dist = bfsDistances(floor, floor.start);
  const d = dist[at.y * floor.width + at.x];
  const total = dist[floor.stairs.y * floor.width + floor.stairs.x];
  return d < 0 || total <= 0 ? 1 : Math.min(1, d / total);
}

/** A guaranteed prize: an item of one of these rarities (bosses). */
export function rollItemOf(rng: Rng, rarities: Rarity[]): ItemInstance {
  const pool = rarities.flatMap((r) => POOL[r]);
  return { defId: pick(rng, pool.length ? pool : POOL.standard), identified: true };
}
