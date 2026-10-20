// What you know about a creature's weak spots: the damage types you have
// tried on its kind, and what each did. Unknown types stay a question mark.

import { DAMAGE_TYPES, type DamageType, WEAK_SPOTS } from '../data/damage';
import { ENEMIES } from '../data/enemies';
import type { GameState } from './types';

export const ALL_TYPES = Object.keys(DAMAGE_TYPES) as DamageType[];

/** How much a type does to this creature: 1.5 weak, 0.5 resisted, else 1. */
export function typeMultiplier(defId: string, type: DamageType): number {
  const def = ENEMIES[defId];
  if (def?.weak?.includes(type)) return WEAK_SPOTS.weakMult;
  if (def?.resists?.includes(type)) return WEAK_SPOTS.resistMult;
  return 1;
}

/** Only what you have found out by trying. */
export function knownSpots(state: GameState, defId: string): { weak: DamageType[]; resists: DamageType[]; untried: DamageType[] } {
  const tried = state.weakSpots[defId] ?? [];
  return {
    weak: tried.filter((t) => typeMultiplier(defId, t) > 1),
    resists: tried.filter((t) => typeMultiplier(defId, t) < 1),
    untried: ALL_TYPES.filter((t) => !tried.includes(t)),
  };
}

/** One plain line for menus: "Weak to Fire. Shrugs off Bludgeoning. 6 damage types not tried yet." */
export function spotsLine(state: GameState, defId: string): string {
  const k = knownSpots(state, defId);
  const names = (ts: DamageType[]) => ts.map((t) => DAMAGE_TYPES[t].name).join(', ');
  const parts: string[] = [];
  if (k.weak.length) parts.push(`Weak to ${names(k.weak)}.`);
  if (k.resists.length) parts.push(`Shrugs off ${names(k.resists)}.`);
  if (k.untried.length) parts.push(k.untried.length <= 3 ? `Not tried yet: ${names(k.untried)}.` : `${k.untried.length} damage types not tried yet.`);
  return parts.join(' ');
}
