// Class signature abilities. Cooldowns count the user's own turns.

export type AbilityDef = {
  id: string;
  name: string;
  cooldown: number;
  target: 'all_enemies' | 'one_enemy';
  description: string;
  /** Battle log line when used. */
  useLine: string;
};

export const ABILITIES: Record<string, AbilityDef> = {
  rampage: {
    id: 'rampage',
    name: 'Rampage',
    cooldown: 8,
    target: 'all_enemies',
    description: 'Hit every enemy in the fight. Property damage is assessed separately.',
    useLine: 'You RAMPAGE. Everything nearby is now evidence.',
  },
  // Hex arrives with the Hexer in M3.
};
