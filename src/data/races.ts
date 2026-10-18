// Races (GDD "Classes and races"). Human's bonus Credits on death arrive with
// Credits in M5.

import type { StatusKind } from './statuses';

export type RaceDef = {
  id: string;
  name: string;
  blurb: string;
  /** Plain one-line summary for the picker. */
  help: string;
  mods: { maxHp?: number; charm?: number };
  resists: StatusKind[];
  /** Eating remains heals instead of hurting. */
  eatsCorpses: boolean;
};

export const RACES: Record<string, RaceDef> = {
  human: {
    id: 'human',
    name: 'Human',
    blurb: 'Adaptable, soft, and statistically likely to have been on their phone when taken.',
    help: 'No stat changes. Earns bonus Credits when they die (from M5).',
    mods: {},
    resists: [],
    eatsCorpses: false,
  },
  gutterfolk: {
    id: 'gutterfolk',
    name: 'Gutterfolk',
    blurb: 'Sewer-born mutants. Hardy, damp, and not invited to parties.',
    help: '+4 max HP, -1 Charm. Immune to poison. Can eat remains to heal.',
    mods: { maxHp: 4, charm: -1 },
    resists: ['poison'],
    eatsCorpses: true,
  },
};
