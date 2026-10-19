// Skills (GDD backlog "Skills", started by user request): they level through
// use, not points. The first is Read the Room: watch enemies act and you get
// better at telling what they will do next.

export type SkillDef = {
  id: string;
  name: string;
  /** Total practice needed for levels 1, 2, 3 and so on. */
  thresholds: number[];
  /** Plain help: what you gain at each level (index = level). */
  levels: string[];
  /** How you get better at it. */
  practice: string;
};

export const SKILLS: Record<string, SkillDef> = {
  read_the_room: {
    id: 'read_the_room',
    name: 'Read the Room',
    thresholds: [3, 15, 40, 80],
    practice: 'Improves every time you watch an enemy act in a fight.',
    levels: [
      'You have no idea what they are about to do.',
      'You can tell whether an enemy is about to attack, hit hard or do something nasty.',
      'You can name the move an enemy is about to use.',
      'You can guess roughly how much its next move will hurt.',
      'You can see who it is about to go for.',
    ],
  },
};

/** How an intent is described at levels 1 and up. */
export const INTENT_KINDS = { attack: 'Attack', heavy: 'Heavy attack', status: 'Attack + {status}' };

/** A move with this much bonus damage counts as a heavy attack. */
export const HEAVY_BONUS = 2;
