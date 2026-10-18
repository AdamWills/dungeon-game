// Starting stats per class (GDD "Starting stats (level 1)"). Kits, abilities
// and favored-stat bonuses arrive in M3.

import type { Stats } from '../game/types';

export type ClassDef = { id: string; name: string; base: Omit<Stats, 'maxHp'> };

export const CLASSES: Record<string, ClassDef> = {
  brawler: { id: 'brawler', name: 'Brawler', base: { hp: 28, str: 4, speed: 3, evasion: 2, armor: 2, charm: 1 } },
  hexer: { id: 'hexer', name: 'Hexer', base: { hp: 18, str: 2, speed: 4, evasion: 3, armor: 0, charm: 3 } },
};
