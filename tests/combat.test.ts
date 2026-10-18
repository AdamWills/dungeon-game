import { describe, expect, it } from 'vitest';
import { baseDamage, fleeChance, hitChance, modifyDamage } from '../src/game/combat';

describe('combat maths', () => {
  it('clamps hit chance between 20% and 95%', () => {
    expect(hitChance(0)).toBeCloseTo(0.9);
    expect(hitChance(2)).toBeCloseTo(0.78);
    expect(hitChance(50)).toBe(0.2);
    expect(hitChance(-10)).toBe(0.95);
  });

  it('deals weapon + Strength - Armor, at least 1', () => {
    expect(baseDamage(3, 4, 0)).toBe(7);
    expect(baseDamage(3, 4, 3)).toBe(4);
    expect(baseDamage(1, 2, 9)).toBe(1);
  });

  it('applies the ambush bonus and bracing', () => {
    expect(modifyDamage(7, { ambush: true, defending: false })).toBe(10);
    expect(modifyDamage(7, { ambush: false, defending: true })).toBe(4);
    expect(modifyDamage(1, { ambush: false, defending: true })).toBe(1);
  });

  it('makes fleeing easier when faster and harder against crowds', () => {
    expect(fleeChance(5, [3])).toBeGreaterThan(fleeChance(3, [3]));
    expect(fleeChance(3, [3, 3, 3])).toBeLessThan(fleeChance(3, [3]));
    expect(fleeChance(0, [9, 9, 9, 9])).toBe(0.1);
    expect(fleeChance(20, [1])).toBe(0.9);
  });
});
