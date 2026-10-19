// A sensible player bot for measuring difficulty. Skipped normally; run with
// `SIM=1 npx vitest run tests/difficulty.test.ts`. Attacks the weakest enemy, heals when
// low, uses its ability, sneaks nothing, and heads for the stairs via rooms.

import { describe, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { createRng, nextFloat, pick } from '../src/game/rng';
import { createGameState } from '../src/game/state';
import type { BattleCommand, Dir, GameState, InputFrame, Vec } from '../src/game/types';
import { NO_INPUT } from '../src/game/types';
import { bfsDistances, isWalkable } from '../src/gen/reach';
import { step } from '../src/world/roam';

const DIRS: [Dir, number, number][] = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];

function battleChoice(s: GameState): BattleCommand {
  const b = s.battle!;
  if (b.result) return { kind: 'continue' };
  const me = b.combatants[0];
  const hexed = (c: { statuses: { kind: string }[] }) => (c.statuses.some((x) => x.kind === 'hexed') ? 0 : 1);
  const foes = b.combatants.filter((c) => c.side === 'enemy' && c.alive).sort((a, c) => hexed(a) - hexed(c) || a.stats.hp - c.stats.hp);
  const heal = s.player.inventory.findIndex((i) => ITEMS[i.defId]?.use?.effects.some((e) => e.kind === 'heal'));
  if (me.stats.hp < me.stats.maxHp * 0.4 && heal >= 0) return { kind: 'item', slot: heal };
  const ab = s.cls === 'hexer' ? 'hex' : 'rampage';
  if (!s.player.cooldowns[ab] && (ab === 'hex' ? hexed(foes[0]) === 1 : foes.length > 1)) return { kind: 'ability', abilityId: ab, targetId: foes[0].id };
  return { kind: 'attack', targetId: foes[0].id };
}

function play(seed: number, cls: string, maxTicks = 60_000) {
  const s = createGameState(seed, 'human', cls);
  const bot = createRng(seed ^ 0xbeef);
  const rooms = [...s.floor.rooms].sort(() => 0).map((r) => r.center);
  let targets: Vec[] = [...rooms.slice(0, 6), s.floor.stairs];
  let dist = bfsDistances(s.floor, targets[0]);
  let fights = 0;
  for (let t = 0; t < maxTicks && s.mode !== 'dead' && s.mode !== 'won'; t++) {
    let input: InputFrame = NO_INPUT;
    if (s.mode === 'menu') {
      const lu = s.levelUp;
      input = { ...NO_INPUT, command: lu?.points ? { kind: 'train', stat: 'maxHp' } : lu?.perkChoices ? { kind: 'perk', id: lu.perkChoices[0] } : { kind: 'dismiss' } };
    } else if (s.mode === 'battle') {
      if (s.battle!.wait === 0) input = { ...NO_INPUT, command: battleChoice(s) };
    } else if (!s.player.motion) {
      const p = { x: Math.round(s.player.pos.x), y: Math.round(s.player.pos.y) };
      const goal = targets[0];
      if (p.x === goal.x && p.y === goal.y) {
        if (targets.length === 1) input = { ...NO_INPUT, interact: true };
        else {
          targets.shift();
          dist = bfsDistances(s.floor, targets[0]);
        }
      } else {
        const here = dist[p.y * s.floor.width + p.x];
        const opts = DIRS.filter(([, dx, dy]) => isWalkable(s.floor, p.x + dx, p.y + dy) && dist[(p.y + dy) * s.floor.width + p.x + dx] >= 0 && dist[(p.y + dy) * s.floor.width + p.x + dx] < here);
        input = { ...NO_INPUT, move: opts.length && nextFloat(bot) < 0.95 ? opts[0][0] : pick(bot, DIRS)[0] };
      }
    }
    const was = s.mode;
    step(s, input);
    s.events.length = 0;
    if (was !== 'battle' && s.mode === 'battle') fights++;
  }
  return { mode: s.mode, fights, level: s.level };
}

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

describe.skipIf(!env.SIM)('difficulty', () => {
  it('reports win and death rates for a sensible player', () => {
    for (const cls of ['brawler', 'hexer']) {
      const res = Array.from({ length: 60 }, (_, i) => play(1000 + i * 37, cls));
      const died = res.filter((r) => r.mode === 'dead');
      const won = res.filter((r) => r.mode === 'won').length;
      const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
      console.log(`${cls}: won ${won}/60, died ${died.length}/60, fights before death ${avg(died.map((r) => r.fights))}, fights per run ${avg(res.map((r) => r.fights))}`);
    }
  }, 600_000);
});
