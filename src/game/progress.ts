// XP, levels, stat points and perks (GDD "Stats and levelling"). Levelling
// opens the level-up screen as soon as you are back on the map; time stays
// paused until every point is spent and any perk is picked.

import { ITEMS } from '../data/items';
import type { StatKey } from '../data/items';
import { PERK_CHOICES, PERK_LEVELS, PERKS } from '../data/perks';
import { TUNING } from '../data/tuning';
import { addItem, refreshPlayerStats } from './equipment';
import { refreshAllyStats } from './party';
import { pick } from './rng';
import type { GameState } from './types';

const P = TUNING.progression;

/** Total XP needed to reach the next level, or null at the cap. */
export function xpForNext(level: number): number | null {
  return level >= P.maxLevel ? null : P.xpToLevel[level - 1];
}

export function gainXp(state: GameState, amount: number): void {
  if (amount <= 0) return;
  state.xp += amount;
  state.events.push({ type: 'xpGained', amount });
  for (let next = xpForNext(state.level); next !== null && state.xp >= next; next = xpForNext(state.level)) {
    state.level++;
    state.levelUp ??= { points: 0, perkChoices: null };
    state.levelUp.points += P.pointsPerLevel;
    if (PERK_LEVELS.includes(state.level)) state.levelUp.perkChoices = rollPerks(state);
    state.events.push({ type: 'levelUp', level: state.level });
  }
  refreshAllyStats(state);
  openLevelUp(state);
}

/** Show the level-up screen if one is waiting and we are on the map. */
export function openLevelUp(state: GameState): void {
  if (!state.levelUp || state.mode !== 'roaming') return;
  state.mode = 'menu';
  state.events.push({ type: 'modeChanged', from: 'roaming', to: 'menu' });
}

function rollPerks(state: GameState): string[] {
  const pool = Object.values(PERKS)
    .filter((p) => (p.cls === null || p.cls === state.cls) && !state.perks.includes(p.id))
    .map((p) => p.id);
  const out: string[] = [];
  while (out.length < PERK_CHOICES && pool.length) out.push(pool.splice(pool.indexOf(pick(state.rng, pool)), 1)[0]);
  return out;
}

/** Spend one level-up point. */
export function train(state: GameState, stat: StatKey): void {
  const lu = state.levelUp;
  if (!lu || lu.points <= 0) return;
  state.trained[stat] = (state.trained[stat] ?? 0) + 1;
  lu.points--;
  refreshPlayerStats(state);
  closeIfDone(state);
}

/** Take one of the offered perks. */
export function takePerk(state: GameState, id: string): void {
  const lu = state.levelUp;
  if (!lu?.perkChoices?.includes(id)) return;
  state.perks.push(id);
  lu.perkChoices = null;
  state.events.push({ type: 'perkTaken', id });
  closeIfDone(state);
  if (id === 'scavenger') {
    // This floor's extra junk item, delivered on a prize card.
    const junk = Object.values(ITEMS).filter((d) => d.rarity === 'junk' && !d.noLoot);
    addItem(state, { defId: pick(state.rng, junk).id, identified: true }, 'floor');
  }
}

function closeIfDone(state: GameState): void {
  const lu = state.levelUp!;
  if (lu.points > 0 || lu.perkChoices) return;
  state.levelUp = null;
  if (!state.reveals.length && state.mode === 'menu') {
    state.mode = 'roaming';
    state.events.push({ type: 'modeChanged', from: 'menu', to: 'roaming' });
  }
}

export function hasPerk(state: GameState, id: string): boolean {
  return state.perks.includes(id);
}
