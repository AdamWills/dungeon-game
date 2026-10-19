import { describe, expect, it } from 'vitest';

import { ENEMIES } from '../src/data/enemies';
import { createGameState } from '../src/game/state';
import type { GameState } from '../src/game/types';
import { validateOutcome } from '../src/battle/improvise';
import { knownSpots, spotsLine } from '../src/game/weakspots';
import { battleCommand, nearPlayer, spawn, startBattle } from './helpers';

function fight(defId: string, weapon?: string): GameState {
  const s = createGameState(21);
  s.floor.entities = [];
  s.floor.lair = undefined;
  if (weapon) s.player.equipment!.weapon = { defId: weapon, identified: true };
  const e = spawn(s, defId, nearPlayer(s, 1, 0));
  s.player.stats.evasion = 99;
  startBattle(s, { enemyIds: [e.id], start: 'normal', tile: { ...s.player.pos } });
  return s;
}

/** Attack until a hit lands (rolls can miss). Returns the damage dealt. */
function landHit(s: GameState): number {
  const foe = s.battle!.combatants[1];
  for (let i = 0; i < 30; i++) {
    const before = foe.stats.hp;
    foe.stats.evasion = -50;
    battleCommand(s, { kind: 'attack', targetId: foe.id });
    if (foe.stats.hp < before) return before - foe.stats.hp;
  }
  throw new Error('never hit');
}

describe('weak spots', () => {
  it('a weak spot does 1.5x, gives you another go, and is remembered', () => {
    const s = fight('pipe_leech', 'tiki_torch'); // leeches are weak to fire
    s.battle!.combatants[1].stats.hp = s.battle!.combatants[1].stats.maxHp = 200;
    const turnsBefore = s.battle!.log.filter((l) => l.text.includes('off balance')).length;
    const dmg = landHit(s);
    // Tiki torch 3 + Str 4 - leech Armor 2 = 5, x1.5 = 8 (rounded).
    expect(dmg).toBe(8);
    expect(s.battle!.log.filter((l) => l.text.includes('off balance')).length).toBe(turnsBefore + 1);
    expect(s.battle!.yourTurn).toBe(true); // still yours
    expect(knownSpots(s, 'pipe_leech').weak).toEqual(['fire']);
    expect(s.events.some((e) => e.type === 'weakSpotFound' && e.damage === 'fire')).toBe(true);
    // Only one bonus a turn: the next weak hit hands the turn on.
    landHit(s);
    expect(s.battle!.log.filter((l) => l.text.includes('off balance')).length).toBe(turnsBefore + 1);
  });

  it('a resisted type does half', () => {
    const s = fight('pipe_leech'); // the Rusted Pipe is blunt; leeches shrug it off
    s.battle!.combatants[1].stats.hp = s.battle!.combatants[1].stats.maxHp = 200;
    // 3 + 4 - 2 = 5, x0.5 = 3 (rounded).
    expect(landHit(s)).toBe(3);
    expect(knownSpots(s, 'pipe_leech').resists).toEqual(['blunt']);
    expect(spotsLine(s, 'pipe_leech')).toContain('Shrugs off Blunt');
  });

  it('swapping weapons in a fight is free', () => {
    const s = fight('intake_rat');
    s.player.inventory.push({ defId: 'tiki_torch', identified: true });
    const slot = s.player.inventory.length - 1;
    battleCommand(s, { kind: 'item', slot });
    expect(s.player.equipment!.weapon!.defId).toBe('tiki_torch');
    expect(s.player.inventory.some((i) => i.defId === 'rusted_pipe')).toBe(true);
    expect(s.battle!.yourTurn).toBe(true);
  });

  it('every creature has a weak spot, and the validator drops unknown damage types', () => {
    for (const def of Object.values(ENEMIES)) expect(def.weak?.length).toBeGreaterThan(0);
    const o = validateOutcome({ grade: 'brilliant', effects: [{ kind: 'damage', amount: 4, target: 'one', type: 'lasers' as never }], narration: 'x', source: 'llm', discoveryKey: 'k' });
    expect(o.effects[0]).toMatchObject({ kind: 'damage', type: undefined });
  });
});
