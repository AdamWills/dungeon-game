// Classes (GDD "Starting stats (level 1)"): stats, kit, signature ability
// and the favored stats that grow faster at level-up.

import type { Stats } from '../game/types';

export type ClassDef = {
  id: string;
  name: string;
  blurb: string;
  /** Plain one-line summary for the picker. */
  help: string;
  base: Omit<Stats, 'maxHp'>;
  ability: string;
  /** Every second point spent on a favored stat grants a free bonus point. */
  favored: ('maxHp' | 'str' | 'speed' | 'evasion' | 'armor' | 'charm')[];
  /** Equipped at the start of a run. */
  kit: Partial<Record<'head' | 'neck' | 'shoulders' | 'body' | 'belt' | 'legs' | 'weapon' | 'offhand' | 'hands' | 'ring1' | 'ring2' | 'feet', string>>;
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
    favored: ['maxHp', 'str'],
    kit: { weapon: 'rusted_pipe', body: 'velour_tracksuit' },
    startingItems: ['suspicious_bandage', 'suspicious_bandage'],
  },
  hexer: {
    id: 'hexer',
    name: 'Hexer',
    blurb: 'Curses people for a living. Previously in middle management.',
    help: 'Fragile and fast. Hex makes one enemy take double damage. Starts with 3 Hex Scrolls.',
    base: { hp: 26, str: 3, speed: 4, evasion: 4, armor: 1, charm: 3 },
    ability: 'hex',
    favored: ['speed', 'charm'],
    kit: { weapon: 'cursed_clipboard', body: 'velour_tracksuit' },
    startingItems: ['hex_scroll', 'hex_scroll', 'hex_scroll', 'suspicious_bandage'],
  },
};

/** Damage when nothing is equipped in the weapon slot. */
export const FISTS = { name: 'Bare Fists', damage: 1, type: 'blunt' as const };
