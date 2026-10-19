// Perks (GDD "Stats and levelling"): at level 3 you pick 1 of 3 from your
// class pool and the general pool. Names are the joke; help says what it does.

export type PerkDef = {
  id: string;
  name: string;
  /** null: anyone can get it. */
  cls: string | null;
  help: string;
  /** Chet's reaction when you take it. */
  line: string;
};

export const PERKS: Record<string, PerkDef> = {
  thick_skull: {
    id: 'thick_skull',
    name: 'Thick Skull',
    cls: 'brawler',
    help: 'The first hit you take in each fight does half damage.',
    line: 'Thick Skull! Doctors hate it. Doctors also cannot find anything in there.',
  },
  knuckle_sandwich: {
    id: 'knuckle_sandwich',
    name: 'Knuckle Sandwich',
    cls: 'brawler',
    help: 'Rampage recharges 2 turns faster.',
    line: 'Knuckle Sandwich! Served hot, served often, served to the face.',
  },
  overdue_invoice: {
    id: 'overdue_invoice',
    name: 'Overdue Invoice',
    cls: 'hexer',
    help: 'Hexed enemies also take 3 damage at the start of each of their turns.',
    line: 'Overdue Invoice! Late fees, folks. Compounding. Painful.',
  },
  fine_print: {
    id: 'fine_print',
    name: 'Fine Print',
    cls: 'hexer',
    help: 'Hex lasts 2 turns longer.',
    line: 'Fine Print! Nobody reads it, and that is the beauty of it.',
  },
  scavenger: {
    id: 'scavenger',
    name: 'Scavenger',
    cls: null,
    help: 'An extra junk item turns up on each floor. You get this floor\'s one now.',
    line: 'Scavenger! One contestant\'s garbage is another contestant\'s... garbage, but closer.',
  },
  bad_habits: {
    id: 'bad_habits',
    name: 'Bad Habits',
    cls: null,
    help: 'You can press the Bad Idea button twice per fight.',
    line: 'Bad Habits! The judges have concerns. The ratings do not.',
  },
};

/** Levels that grant a perk pick (prototype: level 3 only), and how many to offer. */
export const PERK_LEVELS = [3];
export const PERK_CHOICES = 3;
