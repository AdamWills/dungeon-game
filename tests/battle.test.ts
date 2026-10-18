import { describe, expect, it } from 'vitest';
import { battleCommand, currentActor, startBattle } from '../src/battle/turns';
import type { BattleCommand, Encounter, GameState } from '../src/game/types';
import { emptyRun, nearPlayer, spawn } from './helpers';

function fight(seed: number, enemies: string[], start: Encounter['start'] = 'normal'): GameState {
  const state = emptyRun(seed);
  const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ids = enemies.map((defId, i) => spawn(state, defId, nearPlayer(state, spots[i][0], spots[i][1])).id);
  startBattle(state, { enemyIds: ids, start, tile: { ...state.player.pos } });
  return state;
}

const attackFirst = (s: GameState): BattleCommand => ({
  kind: 'attack',
  targetId: s.battle!.combatants.find((c) => c.side === 'enemy' && c.alive)!.id,
});

/** Attack until the battle is decided. */
function brawl(state: GameState, limit = 200) {
  for (let i = 0; i < limit && !state.battle!.result; i++) battleCommand(state, attackFirst(state));
}

describe('battle turns', () => {
  it('orders turns by Speed', () => {
    const state = fight(1, ['intake_rat', 'pipe_leech']); // speeds 5, 1; player 3
    const names = state.battle!.order.map((id) => state.battle!.combatants.find((c) => c.id === id)!.name);
    expect(names).toEqual(['Intake Rat', 'You', 'Pipe Leech']);
    // The rat already acted, so it is now your turn.
    expect(currentActor(state.battle!)!.side).toBe('player');
  });

  it('lets the ambushing side take the whole opening round first', () => {
    const mine = fight(1, ['intake_rat', 'intake_rat'], 'player_ambush'); // rats are faster than you
    expect(mine.battle!.order[0]).toBe('player');
    expect(mine.battle!.fx).toHaveLength(0); // no enemy has acted yet

    const theirs = fight(1, ['pipe_leech'], 'enemy_ambush');
    expect(theirs.battle!.order).toEqual(['t0', 'player']);
    expect(theirs.battle!.log.length).toBeGreaterThan(1); // the leech already struck or missed
  });

  it('marks ambush-round damage with the bonus', () => {
    for (let seed = 1; seed < 40; seed++) {
      const state = fight(seed, ['grudge_gator'], 'player_ambush');
      battleCommand(state, attackFirst(state));
      if (!state.battle!.fx.some((f) => f.kind === 'hit' && f.targetId === 't0')) continue; // missed on this seed
      expect(state.battle!.log[1].text).toContain('(Ambush bonus.)');
      // 3 (pipe) + 4 (Str) - 3 (gator Armor) = 4, x1.5 = 6
      expect(state.battle!.combatants[1].stats.hp).toBe(22 - 6);
      return;
    }
    throw new Error('never hit in 40 seeds');
  });

  it('wins, removes the dead and leaves gore where the fight was', () => {
    const state = fight(3, ['intake_rat']);
    const tile = { ...state.battle!.encounter.tile };
    brawl(state);
    expect(state.battle!.result).toBe('won');
    expect(state.events.some((e) => e.type === 'entityDied' && e.defId === 'intake_rat')).toBe(true);
    battleCommand(state, { kind: 'continue' });
    expect(state.mode).toBe('roaming');
    expect(state.battle).toBeNull();
    expect(state.floor.entities).toHaveLength(0);
    expect(state.floor.tiles[tile.y][tile.x].gore.length).toBeGreaterThan(0);
  });

  it('can kill you, and that ends the run', () => {
    const state = fight(5, ['grudge_gator', 'grudge_gator', 'feral_intern', 'feral_intern'], 'enemy_ambush');
    for (let i = 0; i < 200 && !state.battle!.result; i++) battleCommand(state, { kind: 'defend' });
    expect(state.battle!.result).toBe('lost');
    battleCommand(state, { kind: 'continue' });
    expect(state.mode).toBe('dead');
    expect(state.runEnd).toMatchObject({ kind: 'died' });
    expect(state.player.stats.hp).toBe(0);
  });

  it('puts Rampage on cooldown and refuses it without spending the turn', () => {
    const state = fight(2, ['grudge_gator', 'grudge_gator']);
    battleCommand(state, { kind: 'ability', abilityId: 'rampage' });
    expect(state.battle!.log.some((l) => l.text.includes('RAMPAGE'))).toBe(true);
    expect(state.player.cooldowns.rampage).toBeGreaterThan(0);
    const turnBefore = [state.battle!.round, state.battle!.turn];
    battleCommand(state, { kind: 'ability', abilityId: 'rampage' });
    expect([state.battle!.round, state.battle!.turn]).toEqual(turnBefore);
    expect(state.battle!.log.at(-1)!.text).toContain('recharging');
  });

  it('heals with an item, capped at max HP, and uses it up', () => {
    const state = fight(4, ['pipe_leech']);
    const me = state.battle!.combatants[0];
    me.stats.hp = me.stats.maxHp - 4;
    const items = state.player.inventory.length;
    battleCommand(state, { kind: 'item', slot: 0 });
    expect(state.player.inventory.length).toBe(items - 1);
    expect(state.battle!.log.some((l) => l.text.includes('+4 HP'))).toBe(true);
  });

  it('writes HP back and sets the enemies chasing after a successful flee', () => {
    for (let seed = 1; seed < 40; seed++) {
      const state = fight(seed, ['pipe_leech']); // slow: flee chance 0.7
      const leech = state.floor.entities[0];
      battleCommand(state, attackFirst(state));
      if (state.battle!.result) continue;
      battleCommand(state, { kind: 'flee' });
      if (state.battle!.result !== 'fled') continue;
      const hpInBattle = state.battle!.combatants[1].stats.hp;
      battleCommand(state, { kind: 'continue' });
      expect(state.mode).toBe('roaming');
      expect(leech.stats.hp).toBe(hpInBattle);
      expect(leech.patrol!.alert).toBe('chasing');
      expect(state.grace).toBeGreaterThan(0);
      return;
    }
    throw new Error('never fled in 40 seeds');
  });

  it('replays identically from the same seed and commands', () => {
    const run = () => {
      const s = fight(9, ['intake_rat', 'sludge_hopper', 'feral_intern']);
      for (let i = 0; i < 30 && !s.battle!.result; i++)
        battleCommand(s, i % 4 === 3 ? { kind: 'defend' } : attackFirst(s));
      return JSON.stringify(s.battle);
    };
    expect(run()).toBe(run());
  });
});
