// Rolling items for chests and drops: pick a rarity by weight, then an item
// of that rarity. Class kit pieces never turn up as loot.

import { ITEMS, RARITY_WEIGHTS, type Rarity } from '../data/items';
import { weightedPick } from './combat';
import { pick, type Rng } from './rng';
import type { ItemInstance } from './types';

const POOL: Record<Rarity, string[]> = { junk: [], standard: [], special: [], cursed: [], hosts_pick: [] };
for (const def of Object.values(ITEMS)) if (!def.noLoot) POOL[def.rarity].push(def.id);

export function rollItem(rng: Rng): ItemInstance {
  const rarities = (Object.keys(RARITY_WEIGHTS) as Rarity[])
    .filter((r) => POOL[r].length)
    .map((r) => ({ r, weight: RARITY_WEIGHTS[r] }));
  const { r } = weightedPick(rng, rarities);
  return { defId: pick(rng, POOL[r]), identified: true };
}
