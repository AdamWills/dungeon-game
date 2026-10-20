// A bot that plays whole runs with random intentions and reports crashes,
// broken invariants, and how runs end. Cheap insurance (GDD "Testing").

import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, pick } from '../src/game/rng';
import { createGameState } from '../src/game/state';
import { talkView } from '../src/game/talk';
import type { BattleCommand, Dir, GameState, InputFrame, Vec } from '../src/game/types';
import { NO_INPUT } from '../src/game/types';
import { bfsDistances, isWalkable } from '../src/gen/reach';
import { step } from '../src/world/roam';

const VERB_LIST = ['shove', 'kick', 'throw', 'eat', 'hide', 'ignite'] as const;

const DIRS: [Dir, number, number][] = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];

function playRun(seed: number, maxTicks = 30_000) {
  const state = createGameState(seed, seed % 2 ? 'human' : 'gutterfolk', seed % 3 ? 'brawler' : 'hexer');
  const bot = createRng(seed ^ 0x5eed);
  let target: Vec = state.floor.stairs;
  const blocked = (x: number, y: number) => state.floor.props.some((p) => p.pos.x === x && p.pos.y === y);
  let dist = bfsDistances(state.floor, target, blocked);
  let battles = 0;
  let bossFights = 0;
  let steps = 0;

  const newTarget = () => {
    target = nextFloat(bot) < 0.35 ? state.floor.stairs : pick(bot, state.floor.rooms).center;
    dist = bfsDistances(state.floor, target, blocked);
  };

  for (; steps < maxTicks && state.mode !== 'dead' && state.mode !== 'won'; steps++) {
    let input: InputFrame = NO_INPUT;
    if (state.mode === 'menu') {
      const lu = state.levelUp;
      if (state.talk) input = { ...NO_INPUT, command: { kind: 'say', choice: nextInt(bot, 0, talkView(state)!.choices.length - 1) } };
      else if (lu?.points) input = { ...NO_INPUT, command: { kind: 'train', stat: pick(bot, ['maxHp', 'str', 'speed', 'evasion', 'armor', 'charm'] as const) } };
      else if (lu?.perkChoices) input = { ...NO_INPUT, command: { kind: 'perk', id: pick(bot, lu.perkChoices) } };
      else input = { ...NO_INPUT, command: { kind: 'dismiss' } };
    }
    else if (state.mode === 'battle') {
      const b = state.battle!;
      const foes = b.combatants.filter((c) => c.side === 'enemy' && c.alive);
      const options: BattleCommand[] = b.result || b.intro
        ? [{ kind: 'continue' }]
        : [
            ...foes.map((c) => ({ kind: 'attack', targetId: c.id }) as BattleCommand),
            { kind: 'attack', targetId: foes[0]?.id ?? 'x' },
            { kind: 'ability', abilityId: state.cls === 'hexer' ? 'hex' : 'rampage', targetId: pick(bot, foes)?.id },
            { kind: 'item', slot: nextInt(bot, 0, 5), targetId: pick(bot, foes)?.id },
            { kind: 'defend' },
            ...foes.map((c) => ({ kind: 'spare', targetId: c.id }) as BattleCommand),
            { kind: 'flee' },
            { kind: 'improvise', channel: 'badIdea' },
            { kind: 'improvise', channel: 'jank', slots: [nextInt(bot, 0, 4), nextInt(bot, 0, 4)] },
            ...b.props.map((p) => ({ kind: 'improvise', channel: 'prop', propId: p.id, verb: pick(bot, VERB_LIST) }) as BattleCommand),
          ];
      input = { ...NO_INPUT, command: pick(bot, options) };
    } else if (!state.player.motion) {
      const p = { x: Math.round(state.player.pos.x), y: Math.round(state.player.pos.y) };
      if (p.x === target.x && p.y === target.y) {
        if (target === state.floor.stairs) input = { ...NO_INPUT, interact: true };
        else newTarget();
      } else {
        const here = dist[p.y * state.floor.width + p.x];
        const options = DIRS.filter(([, dx, dy]) => {
          const d = dist[(p.y + dy) * state.floor.width + (p.x + dx)];
          return isWalkable(state.floor, p.x + dx, p.y + dy) && d >= 0 && d < here;
        });
        const move = options.length && nextFloat(bot) < 0.9 ? options[0][0] : pick(bot, DIRS)[0];
        input = { ...NO_INPUT, move, dash: nextFloat(bot) < 0.01, interact: nextFloat(bot) < 0.05 };
      }
    }
    const wasBattle = state.mode === 'battle';
    step(state, input);
    state.events.length = 0;
    if (!wasBattle && state.mode === 'battle') {
      battles++;
      if (state.battle!.encounter.enemyIds.includes(state.floor.lair?.bossId ?? '')) bossFights++;
    }
    checkInvariants(state);
  }
  return { mode: state.mode, battles, bossFights, steps, state };
}

function checkInvariants(state: GameState) {
  const s = state.player.stats;
  expect(s.hp).toBeGreaterThanOrEqual(0);
  expect(s.hp).toBeLessThanOrEqual(s.maxHp);
  for (const it of state.player.inventory) expect(it.defId).toBeTruthy();
  const p = state.player.pos;
  expect(isWalkable(state.floor, Math.round(p.x), Math.round(p.y))).toBe(true);
  for (const e of state.floor.entities) {
    expect(isWalkable(state.floor, Math.round(e.pos.x), Math.round(e.pos.y))).toBe(true);
    expect(e.stats.hp).toBeGreaterThan(0);
  }
  for (const a of state.party) {
    expect(a.stats.hp).toBeGreaterThan(0);
    expect(a.stats.hp).toBeLessThanOrEqual(a.stats.maxHp);
    expect(isWalkable(state.floor, Math.round(a.pos.x), Math.round(a.pos.y))).toBe(true);
  }
  if (state.mode === 'battle') expect(state.battle).not.toBeNull();
}

describe('random-play bot', () => {
  it('plays 12 runs without crashing, dies, and reaches the floor boss', () => {
    const tally = { dead: 0, won: 0, other: 0, battles: 0, bossFights: 0 };
    for (let seed = 1; seed <= 12; seed++) {
      const r = playRun(seed * 7907);
      tally.battles += r.battles;
      tally.bossFights += r.bossFights;
      if (r.mode === 'dead') tally.dead++;
      else if (r.mode === 'won') tally.won++;
      else {
        tally.other++;
        const st = r.state;
        console.log('unfinished', seed * 7907, st.mode, JSON.stringify(st.player.pos), st.battle ? JSON.stringify({ round: st.battle.round, result: st.battle.result, order: st.battle.order, turn: st.battle.turn, log: st.battle.log.slice(-3) }) : '', 'hp', st.player.stats.hp);
      }
    }
    console.log('bot tally', JSON.stringify(tally));
    expect(tally.battles).toBeGreaterThan(12);
    expect(tally.dead).toBeGreaterThan(0);
    // A random bot rarely beats the floor boss, but it must reach it (wins are tested directly).
    expect(tally.bossFights + tally.won).toBeGreaterThan(0);
  }, 600_000);
});
