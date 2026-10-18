// Class signature abilities. Cooldowns count the user's own turns.

export type AbilityDef = {
  id: string;
  name: string;
  cooldown: number;
  target: 'all_enemies' | 'one_enemy';
  description: string;
  /** Plain menu help. */
  help: string;
  /** Battle log line when used; {target} is filled in for one-enemy abilities. */
  useLine: string;
};

export const ABILITIES: Record<string, AbilityDef> = {
  rampage: {
    id: 'rampage',
    name: 'Rampage',
    cooldown: 8,
    target: 'all_enemies',
    description: 'Hit every enemy in the fight. The set will need repainting.',
    help: 'Hit every enemy at once. Then it recharges for 8 of your turns.',
    useLine: 'You RAMPAGE! Folks, we are going to need a new set!',
  },
  hex: {
    id: 'hex',
    name: 'Hex',
    cooldown: 6,
    target: 'one_enemy',
    description: 'Mark an enemy so everything hurts twice as much. Very therapeutic.',
    help: 'Mark one enemy: it takes double damage for 5 turns. Then it recharges for 6 of your turns.',
    useLine: 'You HEX {target}! Ooh, that is going to sting. Twice!',
  },
};

/** How long Hex lasts on its target. */
export const HEX_TURNS = 5;
