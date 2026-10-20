import { describe, expect, it } from 'vitest';

import { ITEM_SCHEMA } from '../src/data/aiPrompts';
import { ITEMS } from '../src/data/items';
import { owned, receiveAi, takeFromPool, validateAiItem } from '../src/game/aiItems';
import { rollItem, rollItemOf } from '../src/game/loot';
import { createRng } from '../src/game/rng';
import { createGameState } from '../src/game/state';
import { NO_INPUT } from '../src/game/types';
import { step } from '../src/world/roam';

const mods = (over: Record<string, number> = {}) => ({ maxHp: 0, str: 0, speed: 0, evasion: 0, armor: 0, charm: 0, ...over });
const design = (over: Record<string, unknown>) => ({ name: 'Plunger of Destiny', description: 'It has unclogged worse than you.', kind: 'weapon', slot: 'weapon', weaponDamage: 99, damageType: 'bludgeoning', onHit: null, mods: mods(), resists: [], use: null, iconPrompt: 'a golden plunger', ...over });

describe('checking an AI item design', () => {
  it('clamps a weapon to its rarity and writes plain help from the numbers', () => {
    const rare = validateAiItem(design({ onHit: { status: 'stunned', turns: 9, chance: 0.9 } }), 'special', 'ai-1')!;
    expect(rare.weapon).toEqual({ damage: 6, type: 'bludgeoning', onHit: { status: 'stunned', turns: 3, chance: 0.35 } });
    expect(rare.help).toBe('Weapon, Bludgeoning. 6 damage; 35% chance a hit makes the target stunned for 3 turns.');
    expect(rare.invented).toBe(true);
    expect(validateAiItem(design({ weaponDamage: 1 }), 'hosts_pick', 'ai-2')!.weapon!.damage).toBe(6);
  });

  it('keeps wearable stats within budget; a downside buys more upside', () => {
    const plain = validateAiItem(design({ kind: 'wearable', slot: 'head', mods: mods({ str: 2, armor: 2, charm: 2 }) }), 'special', 'ai-3')!;
    const total = (m: Record<string, number | undefined>) => Object.values(m).reduce((n: number, v) => n + Math.max(0, v ?? 0), 0);
    expect(total(plain.mods!)).toBe(3);
    const tradeoff = validateAiItem(design({ kind: 'wearable', slot: 'head', mods: mods({ str: 2, armor: 2, speed: -2 }) }), 'special', 'ai-4')!;
    expect(tradeoff.mods).toEqual({ str: 2, armor: 2, speed: -2 });
    expect(tradeoff.help).toBe('Head. +2 Strength, -2 Speed, +2 Armor.');
  });

  it('consumables: damage only at enemies, heals and haste only on you', () => {
    const d = validateAiItem(design({ kind: 'consumable', slot: null, use: { target: 'one_enemy', effects: [{ kind: 'damage', amount: 50, damageType: 'fire', status: null, turns: null }, { kind: 'heal', amount: 5, damageType: null, status: null, turns: null }] } }), 'special', 'ai-5')!;
    expect(d.use).toEqual({ target: 'one_enemy', consumable: true, battleOnly: true, effects: [{ kind: 'damage', amount: 8, type: 'fire' }] });
    expect(d.help).toBe('In battle: 8 fire damage (one enemy). Used up.');
    const h = validateAiItem(design({ kind: 'consumable', use: { target: 'self', effects: [{ kind: 'status', amount: null, damageType: null, status: 'poison', turns: 2 }] } }), 'special', 'ai-6')!;
    expect(h.use!.effects).toEqual([{ kind: 'heal', amount: 6 }]); // the curse is dropped; a plain heal stands in
  });

  it('refuses a design with no name, and the schema is strict-valid', () => {
    expect(validateAiItem({}, 'special', 'x')).toBeNull();
    const check = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object') {
        expect(node.additionalProperties).toBe(false);
        expect([...node.required].sort()).toEqual(Object.keys(node.properties).sort());
      }
      for (const v of Object.values(node)) check(v);
    };
    check(ITEM_SCHEMA);
  });
});

describe('the pool', () => {
  it('a delivery is registered and handed out once, by chests and bosses', () => {
    const s = createGameState(11);
    step(s, { ...NO_INPUT, ai: [{ kind: 'item', rarity: 'hosts_pick', id: 'ai-test-1', answer: design({ name: 'The Golden Toilet Seat', kind: 'wearable', slot: 'neck', mods: mods({ charm: 3 }) }) }] });
    expect(ITEMS['ai-test-1'].name).toBe('The Golden Toilet Seat');
    expect(s.aiPool.hosts_pick).toEqual(['ai-test-1']);
    expect(s.events.some((e) => e.type === 'aiItemReady')).toBe(true);
    // The Fatberg's prize takes it; the next prize falls back to a hand-written one you do not own.
    const first = rollItemOf(s.rng, ['hosts_pick'], (r) => takeFromPool(s, r), owned(s));
    expect(first.defId).toBe('ai-test-1');
    const handWritten = Object.values(ITEMS).find((d) => d.rarity === 'hosts_pick' && !d.invented)!;
    s.player.inventory.push({ defId: handWritten.id, identified: true });
    const second = rollItemOf(s.rng, ['hosts_pick'], (r) => takeFromPool(s, r), owned(s));
    expect(second.defId).not.toBe(handWritten.id);
    expect(second.defId).not.toBe('ai-test-1');
  });

  it('a chest that rolls Rare gives the invented Rare when one is ready', () => {
    const s = createGameState(11);
    step(s, { ...NO_INPUT, ai: [{ kind: 'item', rarity: 'special', id: 'ai-test-2', answer: design({}) }] });
    const rng = createRng(5);
    let got = '';
    for (let i = 0; i < 200 && !got; i++) {
      const it = rollItem(rng, 1, 'chest', (r) => takeFromPool(s, r));
      if (ITEMS[it.defId].rarity === 'special') got = it.defId;
    }
    expect(got).toBe('ai-test-2');
    expect(s.aiPool.special).toEqual([]);
  });

  it('the same delivery twice is ignored, and a bad one never enters the pool', () => {
    const s = createGameState(11);
    const d = { kind: 'item' as const, rarity: 'special' as const, id: 'ai-test-3', answer: design({}) };
    receiveAi(s, d);
    receiveAi(s, d);
    receiveAi(s, { kind: 'item', rarity: 'special', id: 'ai-test-4', answer: { nonsense: true } });
    expect(s.aiPool.special).toEqual(['ai-test-3']);
  });
});

describe('design briefs (user feedback: the Rares were all alike)', () => {
  it('a design is held to its brief: kind, slot, damage, and no on-hit unless asked', () => {
    const weapon = validateAiItem(design({ weaponDamage: 9, onHit: { status: 'bleed', turns: 2, chance: 0.3 } }), 'special', 'b-1', { kind: 'weapon', weaponDamage: 4, onHit: false, gimmick: 'quick' })!;
    expect(weapon.weapon).toEqual({ damage: 4, type: 'bludgeoning' });
    const hat = validateAiItem(design({ mods: mods({ armor: 2 }) }), 'special', 'b-2', { kind: 'wearable', slot: 'head', onHit: false, gimmick: 'protection' })!;
    expect(hat.slot).toBe('head');
    expect(hat.weapon).toBeUndefined();
    expect(hat.mods).toEqual({ armor: 2 });
  });

  it('briefs vary: kinds, slots, damage and gimmicks', async () => {
    const { pickBrief } = await import('../src/ai/items');
    const briefs = Array.from({ length: 200 }, () => pickBrief('special'));
    expect(new Set(briefs.map((b) => b.kind)).size).toBe(3);
    expect(new Set(briefs.map((b) => b.gimmick)).size).toBeGreaterThan(10);
    expect(new Set(briefs.filter((b) => b.slot).map((b) => b.slot)).size).toBeGreaterThan(5);
    expect(new Set(briefs.filter((b) => b.weaponDamage).map((b) => b.weaponDamage))).toEqual(new Set([4, 5, 6]));
    // Only some weapons may have an on-hit effect.
    const weapons = briefs.filter((b) => b.kind === 'weapon');
    expect(weapons.some((b) => b.onHit)).toBe(true);
    expect(weapons.some((b) => !b.onHit)).toBe(true);
  });
});
