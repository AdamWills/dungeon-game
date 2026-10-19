// Ending a run in death: the elimination report (GDD "EliminationReport").
// Text choices use a stable hash, not the game RNG, so the report never
// changes how a run plays.

import { variant } from '../data/battleText';
import { ITEMS } from '../data/items';
import { LAST_WORDS, PARTING_GIFTS, SIGN_OFFS } from '../data/report';
import type { EliminationReport, GameState } from './types';

export function eliminate(state: GameState, enemy: string, move: string): void {
  const report = buildReport(state, enemy, move);
  state.runEnd = { kind: 'died', enemy, move, report };
  const from = state.mode;
  state.mode = 'dead';
  state.events.push({ type: 'modeChanged', from, to: 'dead' });
  state.events.push({ type: 'runEnded', end: state.runEnd });
}

export function buildReport(state: GameState, enemy: string, move: string): EliminationReport {
  const r = state.record;
  const salt = [state.seed, state.tick];
  const words = LAST_WORDS[r.lastAction.kind] ?? LAST_WORDS.none;
  const item = r.lastAction.item ? (ITEMS[r.lastAction.item]?.name ?? r.lastAction.item) : 'thing';
  return {
    runSeed: state.seed,
    floor: state.floor.index,
    race: state.race,
    cls: state.cls,
    level: state.level,
    enemy,
    move,
    fights: r.fights,
    badIdeas: r.badIdeas,
    alliesRecruited: r.alliesRecruited,
    alliesLost: r.alliesLost,
    lastWords: variant(words, ...salt).replace('{item}', item),
    partingGift: variant(PARTING_GIFTS, ...salt, 1),
    hostLine: variant(SIGN_OFFS, ...salt, 2).replace('{enemy}', enemy).replace('{move}', move),
    source: 'scripted',
  };
}
