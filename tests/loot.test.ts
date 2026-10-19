import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { equipPreview } from '../src/game/equipment';
import { CURSED_FROM, depthOf, rollItem } from '../src/game/loot';
import { createRng } from '../src/game/rng';
import { createGameState } from '../src/game/state';

describe('cursed loot', () => {
  it('never turns up in the first half of the floor, but does later', () => {
    const rng = createRng(7);
    const early = Array.from({ length: 2000 }, () => ITEMS[rollItem(rng, CURSED_FROM - 0.01).defId].rarity);
    const late = Array.from({ length: 2000 }, () => ITEMS[rollItem(rng, 1).defId].rarity);
    expect(early).not.toContain('cursed');
    expect(late).toContain('cursed');
  });

  it('measures depth from the start (0) to the stairs (1)', () => {
    const s = createGameState(11);
    expect(depthOf(s.floor, s.floor.start)).toBe(0);
    expect(depthOf(s.floor, s.floor.stairs)).toBe(1);
  });

  it('is a big boost with a real cost', () => {
    for (const def of Object.values(ITEMS).filter((d) => d.cursed)) {
      const mods = Object.values(def.mods ?? {});
      expect(Math.max(...mods), def.id).toBeGreaterThanOrEqual(4);
      expect(Math.min(...mods), def.id).toBeLessThan(0);
    }
  });
});

describe('equip preview', () => {
  it('shows what wearing an item changes against what you have on', () => {
    const s = createGameState(11, 'human', 'brawler');
    const str = s.player.stats.str;
    const p = equipPreview(s, 'chets_spare_microphone');
    expect(p).toContainEqual({ name: 'Strength', before: str, after: str + 5 });
    expect(p.some((c) => c.name === 'Evasion' && c.after < c.before)).toBe(true);
  });
});
