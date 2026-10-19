// Elites: ordinary residents with a trait that makes them tougher, worth more
// and always carrying something. Names first.

import type { Stats } from '../game/types';

export type EliteTrait = {
  id: string;
  /** Goes in front of the creature's name: "Rabid Intake Rat". */
  name: string;
  /** Plain help for the battle screen. */
  help: string;
  /** Added to its stats after the HP boost. */
  add: Partial<Omit<Stats, 'maxHp'>>;
};

export const ELITES: Record<string, EliteTrait> = {
  rabid: { id: 'rabid', name: 'Rabid', help: 'Elite: hits much harder.', add: { str: 2 } },
  unionized: { id: 'unionized', name: 'Unionized', help: 'Elite: heavily armored. It knows its rights.', add: { armor: 3 } },
  overcaffeinated: { id: 'overcaffeinated', name: 'Overcaffeinated', help: 'Elite: fast and hard to hit.', add: { speed: 3, evasion: 2 } },
  enormous: { id: 'enormous', name: 'Enormous', help: 'Elite: twice the HP.', add: { hp: 0 } },
};

/** What every elite gets: more HP, XP and tokens, and an item when it dies. */
export const ELITE = { hpMult: 1.6, enormousHpMult: 2.4, xpMult: 2.5, tokenMult: 2 };

export function eliteName(defName: string, elite?: string): string {
  return elite ? `${ELITES[elite].name} ${defName}` : defName;
}

/** The floor boss's lair: it roars (and shows on your map) once you are this close, or have seen this share of the rooms. */
export const LAIR = { roarDistance: 30, roarRooms: 0.5, checkTicks: 30 };
