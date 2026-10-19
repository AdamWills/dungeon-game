import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { SKILLS } from '../src/data/skills';
import { createGameState } from '../src/game/state';
import type { GameState } from '../src/game/types';
import { practice, skillLevel } from '../src/game/skills';
import { intentText } from '../src/ui/intent';
import { battleCommand, nearPlayer, spawn, startBattle } from './helpers';

function fightGator(): GameState {
  const s = createGameState(11);
  s.floor.entities = [];
  const id = spawn(s, 'grudge_gator', nearPlayer(s, 1, 0)).id;
  startBattle(s, { enemyIds: [id], start: 'normal', tile: { ...s.player.pos } });
  s.battle!.combatants[1].stats.hp = 999;
  return s;
}

describe('Read the Room', () => {
  it('starts at level 0 and improves by watching enemies act', () => {
    const s = fightGator();
    expect(skillLevel(s, 'read_the_room')).toBe(0);
    for (let i = 0; i < 4; i++) battleCommand(s, { kind: 'defend' });
    expect(skillLevel(s, 'read_the_room')).toBeGreaterThanOrEqual(1);
    expect(s.battle!.log.some((l) => l.text.includes('Read the Room is now level 1'))).toBe(true);
  });

  it('levels at the thresholds and stops at the top', () => {
    const s = createGameState(11);
    const t = SKILLS.read_the_room.thresholds;
    practice(s, 'read_the_room', t[0] - 1);
    expect(skillLevel(s, 'read_the_room')).toBe(0);
    practice(s, 'read_the_room', 1);
    expect(skillLevel(s, 'read_the_room')).toBe(1);
    practice(s, 'read_the_room', 10_000);
    expect(skillLevel(s, 'read_the_room')).toBe(t.length);
  });

  it('enemies do what they lined up, and you see more as the skill grows', () => {
    const s = fightGator();
    const gator = s.battle!.combatants[1];
    const planned = gator.intent!.moveId;
    const move = ENEMIES.grudge_gator.moves.find((m) => m.id === planned)!;
    expect(intentText(s.battle!, gator, 0)).toBeNull();
    expect(intentText(s.battle!, gator, 1)).not.toContain(move.name);
    expect(intentText(s.battle!, gator, 2)).toContain(move.name);
    expect(intentText(s.battle!, gator, 3)).toMatch(/~\d+ dmg/);
    expect(intentText(s.battle!, gator, 4)).toMatch(/to you$/);
    s.battle!.combatants[0].stats.evasion = -100; // so the move lands and shows in the log
    battleCommand(s, { kind: 'defend' });
    const hit = s.battle!.log.find((l) => l.tone === 'bad' && move.hit.some((h) => l.text.startsWith(h.split('{dmg}')[0].replace('{actor}', 'Grudge Gator'))));
    expect(hit).toBeTruthy();
  });
});
