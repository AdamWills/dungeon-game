// Skill practice and levels (see src/data/skills.ts). Skills level through
// use: each bit of practice adds up, and crossing a threshold raises the level.

import { SKILLS } from '../data/skills';
import type { GameState } from './types';

export function skillLevel(state: GameState, id: string): number {
  return state.skills[id]?.level ?? 0;
}

export function practice(state: GameState, id: string, amount = 1): void {
  const def = SKILLS[id];
  const s = (state.skills[id] ??= { level: 0, xp: 0 });
  s.xp += amount;
  while (s.level < def.thresholds.length && s.xp >= def.thresholds[s.level]) {
    s.level++;
    state.events.push({ type: 'skillUp', id, level: s.level });
  }
}
