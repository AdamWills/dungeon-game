// Combat maths (GDD "Combat"). Small numbers the player can do in their head:
// hit chance from the target's Evasion, damage = weapon + Strength - Armor.

import { TUNING } from '../data/tuning';
import { nextFloat, type Rng } from './rng';

const C = TUNING.combat;

export function hitChance(targetEvasion: number): number {
  return Math.min(C.hitMax, Math.max(C.hitMin, C.hitBase - C.hitPerEvasion * targetEvasion));
}

export function rollHit(rng: Rng, targetEvasion: number): boolean {
  return nextFloat(rng) < hitChance(targetEvasion);
}

export function baseDamage(weapon: number, str: number, armor: number): number {
  return Math.max(1, weapon + str - armor);
}

/** Ambush bonus rounds down, bracing rounds up; never below 1. */
export function modifyDamage(dmg: number, opts: { ambush: boolean; defending: boolean }): number {
  let d = dmg;
  if (opts.ambush) d = Math.floor(d * C.ambushMultiplier);
  if (opts.defending) d = Math.ceil(d * C.defendMultiplier);
  return Math.max(1, d);
}

export function fleeChance(playerSpeed: number, enemySpeeds: number[]): number {
  if (enemySpeeds.length === 0) return 1;
  const fastest = Math.max(...enemySpeeds);
  const p = C.fleeBase + C.fleePerSpeed * (playerSpeed - fastest) - C.fleePerExtraEnemy * (enemySpeeds.length - 1);
  return Math.min(C.fleeMax, Math.max(C.fleeMin, p));
}

export function weightedPick<T extends { weight: number }>(rng: Rng, items: readonly T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = nextFloat(rng) * total;
  for (const item of items) {
    r -= item.weight;
    if (r < 0) return item;
  }
  return items[items.length - 1];
}
