// Classes (GDD "Starting stats (level 1)"). M2 plays as the Brawler; the
// Hexer, kits as real items and favored-stat bonuses arrive in M3.

import type { Stats } from '../game/types';

export type ClassDef = {
  id: string;
  name: string;
  base: Omit<Stats, 'maxHp'>;
  weapon: { name: string; damage: number };
  ability: string;
  startingItems: string[];
};

export const CLASSES: Record<string, ClassDef> = {
  brawler: {
    id: 'brawler',
    name: 'Brawler',
    base: { hp: 28, str: 4, speed: 3, evasion: 2, armor: 2, charm: 1 },
    weapon: { name: 'Rusted Pipe', damage: 3 },
    ability: 'rampage',
    startingItems: ['suspicious_bandage', 'suspicious_bandage'],
  },
  hexer: {
    id: 'hexer',
    name: 'Hexer',
    base: { hp: 18, str: 2, speed: 4, evasion: 3, armor: 0, charm: 3 },
    weapon: { name: 'Cursed Clipboard', damage: 2 },
    ability: 'hex',
    startingItems: [],
  },
};
