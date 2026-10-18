// A bot that plays whole runs with random intentions and reports crashes,
// broken invariants, and how runs end. Cheap insurance (GDD "Testing").

import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, pick } from '../src/game/rng';
import { createGameState } from '../src/game/state';
import type { BattleCommand, Dir, GameState, InputFrame, Vec } from '../src/game/types';
import { NO_INPUT } from '../src/game/types';
import { bfsDistances, isWalkable } from '../src/gen/reach';
import { step } from '../src/world/roam';

const DIRS: [Dir, number, number][] = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];

function playRun(seed: number, maxTicks = 40_000) {
  const state = createGameState(seed, seed % 2 ? 'human' : 'gutterfolk', seed % 3 ? 'brawler' : 'hexer');
  const bot = createRng(seed ^ 0x5eed);
  let target: Vec = state.floor.stairs;
  let dist = bfsDistances(state.floor, target);
  let battles = 0;
  let steps = 0;

  const newTarget = () => {
    target = nextFloat(bot) < 0.15 ? state.floor.stairs : pick(bot, state.floor.rooms).center;
    dist = bfsDistances(state.floor, target);
  };

  for (; steps < maxTicks && (state.mode === 'roaming' || state.mode === 'battle'); steps++) {
    let input: InputFrame = NO_INPUT;
    if (state.mode === 'battle') {
      const b = state.battle!;
      const foes = b.combatants.filter((c) => c.side === 'enemy' && c.alive);
      const options: BattleCommand[] = b.result
        ? [{ kind: 'continue' }]
        : [
            ...foes.map((c) => ({ kind: 'attack', targetId: c.id }) as BattleCommand),
            { kind: 'attack', targetId: foes[0]?.id ?? 'x' },
            { kind: 'ability', abilityId: state.cls === 'hexer' ? 'hex' : 'rampage', targetId: pick(bot, foes)?.id },
            { kind: 'item', slot: nextInt(bot, 0, 5), targetId: pick(bot, foes)?.id },
            { kind: 'defend' },
            { kind: 'flee' },
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
    if (!wasBattle && state.mode === 'battle') battles++;
    checkInvariants(state);
  }
  return { mode: state.mode, battles, steps };
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
  if (state.mode === 'battle') expect(state.battle).not.toBeNull();
}

describe('random-play bot', () => {
  it('plays 40 runs without crashing, and runs end both ways', () => {
    const tally = { dead: 0, won: 0, other: 0, battles: 0 };
    for (let seed = 1; seed <= 40; seed++) {
      const r = playRun(seed * 7907);
      tally.battles += r.battles;
      if (r.mode === 'dead') tally.dead++;
      else if (r.mode === 'won') tally.won++;
      else tally.other++;
    }
    console.log('bot tally', JSON.stringify(tally));
    expect(tally.battles).toBeGreaterThan(40);
    expect(tally.dead).toBeGreaterThan(0);
    expect(tally.won).toBeGreaterThan(0);
  }, 60_000);
});
