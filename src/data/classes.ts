// Classes (GDD "Starting stats (level 1)"). Kits are real items now; the
// favored-stat bonuses arrive with levelling in M4.

import type { Stats } from '../game/types';

export type ClassDef = {
  id: string;
  name: string;
  blurb: string;
  /** Plain one-line summary for the picker. */
  help: string;
  base: Omit<Stats, 'maxHp'>;
  ability: string;
  /** Equipped at the start of a run. */
  kit: { weapon?: string; armor?: string; trinket?: string };
  startingItems: string[];
};

export const CLASSES: Record<string, ClassDef> = {
  brawler: {
    id: 'brawler',
    name: 'Brawler',
    blurb: 'Hits things. Is hit by things. Enjoys both more than is healthy.',
    help: 'Tough melee fighter. Rampage hits every enemy at once.',
    base: { hp: 28, str: 4, speed: 3, evasion: 2, armor: 2, charm: 1 },
    ability: 'rampage',
    kit: { weapon: 'rusted_pipe', armor: 'velour_tracksuit' },
    startingItems: ['suspicious_bandage', 'suspicious_bandage'],
  },
  hexer: {
    id: 'hexer',
    name: 'Hexer',
    blurb: 'Curses people for a living. Previously in middle management.',
    help: 'Fragile and fast. Hex makes one enemy take double damage. Starts with 3 Hex Scrolls.',
    base: { hp: 18, str: 2, speed: 4, evasion: 3, armor: 0, charm: 3 },
    ability: 'hex',
    kit: { weapon: 'cursed_clipboard' },
    startingItems: ['hex_scroll', 'hex_scroll', 'hex_scroll', 'suspicious_bandage'],
  },
};

/** Damage when nothing is equipped in the weapon slot. */
export const FISTS = { name: 'Bare Fists', damage: 1 };
