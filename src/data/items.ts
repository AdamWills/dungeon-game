// Items. M2 ships one consumable so the Item menu has something in it; the
// full list of about 30 arrives in M3.

import type { EffectRef } from '../game/types';

export type ItemDef = {
  id: string;
  name: string;
  rarity: 'junk' | 'standard' | 'special' | 'cursed' | 'hosts_pick';
  slot?: 'weapon' | 'armor' | 'trinket';
  consumable?: boolean;
  effects: EffectRef[];
  description: string;
  /** Plain menu help. */
  help: string;
  /** Battle log line when used; {amount} is filled in. */
  useLine?: string;
};

export const ITEMS: Record<string, ItemDef> = {
  suspicious_bandage: {
    id: 'suspicious_bandage',
    name: 'Suspicious Bandage',
    rarity: 'junk',
    consumable: true,
    effects: [{ kind: 'heal', amount: 10 }],
    description: 'Pre-owned. The previous owner no longer needs it, or anything.',
    help: 'Heals 10 HP. Used up when you use it.',
    useLine: 'You apply the Suspicious Bandage. +{amount} HP. Do not ask where it has been.',
  },
};
