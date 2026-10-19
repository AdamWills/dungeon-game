// Sewer fauna. Names and lines first, numbers untuned until M5.

import type { Stats } from '../game/types';
import type { Rarity } from './items';
import type { StatusKind } from './statuses';

export type EnemyMove = {
  id: string;
  name: string;
  weight: number;
  /** Extra damage on top of weapon + Strength. */
  bonus: number;
  /** Hit lines; {actor} and {dmg} are filled in. */
  hit: string[];
  /** A status this move can inflict on a hit. */
  status?: { kind: StatusKind; turns: number; chance: number };
  /** Telegraphed a turn ahead, always visible (whatever your Read the Room). */
  windup?: boolean;
  /** Hits everyone on your side. */
  hitsAll?: boolean;
  /** Calls in more of these instead of attacking (only while fewer than `max` are up). */
  summon?: { defId: string; count: number; max: number };
};

/** Bosses: a room boss holds its own room; the floor boss guards the stairs. */
export type BossTier = 'room' | 'floor';

export type EnemyDef = {
  id: string;
  name: string;
  blurb: string;
  stats: Omit<Stats, 'maxHp'>;
  weapon: number;
  xp: number;
  /** Prize Tokens dropped when it dies, min and max. */
  tokens: [number, number];
  /** An ally you can recruit by sparing it once it is low on HP. */
  spare?: string;
  /** Never placed by the floor generator (deserters and turncoats are placed by hand). */
  special?: boolean;
  /** A boss (placed by the generator in its own room, never at random). */
  tier?: BossTier;
  /** Chet's line when the fight starts (bosses). */
  intro?: string;
  /** Always drops an item of one of these rarities. */
  prize?: Rarity[];
  /** Drawn this many times bigger than a normal enemy. */
  size?: number;
  moves: EnemyMove[];
  roam: {
    patrolTicksPerTile: number;
    chaseTicksPerTile: number;
    visionRange: number;
    visionArcDeg: number;
    hearingRadius: number;
    sleepChance: number;
    /** Ticks without seeing the player before a chase is abandoned. */
    giveUpTicks: number;
    /** Smart residents path around hazards; simple ones wade straight in. */
    smart: boolean;
  };
};

export const ENEMIES: Record<string, EnemyDef> = {
  intake_rat: {
    id: 'intake_rat',
    name: 'Intake Rat',
    blurb: 'A rat the size of a dog, wearing a visitor lanyard it did not earn.',
    stats: { hp: 8, str: 2, speed: 5, evasion: 3, armor: 0, charm: 0 },
    weapon: 1,
    xp: 4,
    tokens: [1, 3],
    moves: [
      { id: 'gnaw', name: 'Gnaw', weight: 3, bonus: 0, hit: ['{actor} gnaws on your ankle for {dmg}.', '{actor} bites you for {dmg} and looks smug about it.'] },
      { id: 'lanyard_whip', name: 'Lanyard Whip', weight: 1, bonus: 1, hit: ['{actor} whips you with its lanyard for {dmg}. Backstage access: revoked.'] },
    ],
    roam: { patrolTicksPerTile: 16, chaseTicksPerTile: 12, visionRange: 5, visionArcDeg: 100, hearingRadius: 2.5, sleepChance: 0.1, giveUpTicks: 180, smart: false },
  },
  feral_intern: {
    id: 'feral_intern',
    name: 'Feral Intern',
    blurb: 'Unpaid. Unsupervised. Armed with a stapler and a grievance.',
    stats: { hp: 12, str: 3, speed: 3, evasion: 2, armor: 1, charm: 1 },
    weapon: 2,
    xp: 6,
    tokens: [2, 4],
    moves: [
      { id: 'staple', name: 'Staple', weight: 3, bonus: 0, hit: ['{actor} staples you for {dmg}. It is collating you.', '{actor} staples you to the present moment for {dmg}.'] },
      { id: 'reply_all', name: 'Reply-All', weight: 1, bonus: 2, hit: ['{actor} screams a reply-all at you. {dmg} psychic damage.'] },
    ],
    roam: { patrolTicksPerTile: 14, chaseTicksPerTile: 15, visionRange: 6, visionArcDeg: 90, hearingRadius: 2.5, sleepChance: 0.15, giveUpTicks: 240, smart: true },
  },
  sludge_hopper: {
    id: 'sludge_hopper',
    name: 'Sludge Hopper',
    blurb: 'A frog assembled from things that went down the drain. It is proud of this.',
    stats: { hp: 10, str: 3, speed: 4, evasion: 4, armor: 0, charm: 0 },
    weapon: 1,
    xp: 5,
    tokens: [1, 4],
    moves: [
      { id: 'splat', name: 'Splat', weight: 2, bonus: 0, hit: ['{actor} lands on you. {dmg} damage and a smell that will outlive you.'], status: { kind: 'poison', turns: 3, chance: 0.5 } },
      { id: 'tongue_lash', name: 'Tongue Lash', weight: 2, bonus: 1, hit: ['{actor} tongues you across the face for {dmg}. Unprofessional.'] },
    ],
    roam: { patrolTicksPerTile: 12, chaseTicksPerTile: 12, visionRange: 4, visionArcDeg: 160, hearingRadius: 3, sleepChance: 0, giveUpTicks: 150, smart: false },
  },
  pipe_leech: {
    id: 'pipe_leech',
    name: 'Pipe Leech',
    blurb: 'Two metres of mouth. Mostly sleeps. Wakes up hungry and litigious.',
    stats: { hp: 16, str: 4, speed: 1, evasion: 0, armor: 2, charm: 0 },
    weapon: 2,
    xp: 8,
    tokens: [2, 5],
    moves: [
      { id: 'latch', name: 'Latch', weight: 3, bonus: 0, hit: ['{actor} latches on for {dmg}. It has opinions about your blood type.'], status: { kind: 'bleed', turns: 3, chance: 0.5 } },
      { id: 'drink_deep', name: 'Drink Deep', weight: 1, bonus: 2, hit: ['{actor} drinks deep. You lose {dmg} HP and some self-respect.'] },
    ],
    roam: { patrolTicksPerTile: 24, chaseTicksPerTile: 18, visionRange: 3, visionArcDeg: 120, hearingRadius: 2, sleepChance: 0.7, giveUpTicks: 120, smart: false },
  },
  grudge_gator: {
    id: 'grudge_gator',
    name: 'Grudge Gator',
    blurb: 'Flushed as a hatchling. Has not let it go.',
    stats: { hp: 22, str: 4, speed: 2, evasion: 1, armor: 3, charm: 0 },
    weapon: 2,
    xp: 14,
    tokens: [4, 8],
    moves: [
      { id: 'chomp', name: 'Chomp', weight: 3, bonus: 0, hit: ['{actor} chomps you for {dmg}. It was thinking about someone else.'] },
      { id: 'death_roll', name: 'Death Roll', weight: 1, bonus: 3, hit: ['{actor} death-rolls you for {dmg}. Twenty years of resentment, released.'] },
    ],
    roam: { patrolTicksPerTile: 20, chaseTicksPerTile: 13, visionRange: 6, visionArcDeg: 80, hearingRadius: 2, sleepChance: 0.3, giveUpTicks: 300, smart: true },
  },
  skitch: {
    id: 'skitch',
    name: 'Skitch',
    blurb: 'A sewer rat with a nail gun and an exit strategy. Fights for whoever is winning.',
    stats: { hp: 12, str: 2, speed: 5, evasion: 4, armor: 0, charm: 1 },
    weapon: 2,
    xp: 6,
    tokens: [1, 3],
    spare: 'skitch',
    special: true,
    moves: [
      { id: 'nail', name: 'Nail Gun', weight: 3, bonus: 0, hit: ['{actor} nails you for {dmg}, then looks away like it was someone else.', '{actor} shoots you for {dmg} and mouths "sorry".'] },
      { id: 'spray', name: 'Spray and Pray', weight: 1, bonus: 1, hit: ['{actor} fires wildly. One nail finds you for {dmg}.'] },
    ],
    roam: { patrolTicksPerTile: 12, chaseTicksPerTile: 12, visionRange: 5, visionArcDeg: 120, hearingRadius: 3, sleepChance: 0, giveUpTicks: 150, smart: true },
  },
  marjorie_grievance: {
    id: 'marjorie_grievance',
    name: 'Marjorie (Aggrieved)',
    blurb: 'She filed a grievance. You are the grievance.',
    stats: { hp: 26, str: 5, speed: 2, evasion: 1, armor: 2, charm: 0 },
    weapon: 3,
    xp: 15,
    tokens: [3, 6],
    special: true,
    moves: [
      { id: 'clothesline', name: 'Clothesline', weight: 3, bonus: 0, hit: ['{actor} clotheslines you for {dmg}. She used to do that FOR you.'] },
      { id: 'forklift', name: 'Forklift', weight: 1, bonus: 3, hit: ['{actor} lifts you with her legs and drops you for {dmg}. Perfect form.'] },
    ],
    roam: { patrolTicksPerTile: 14, chaseTicksPerTile: 10, visionRange: 8, visionArcDeg: 360, hearingRadius: 4, sleepChance: 0, giveUpTicks: 600, smart: true },
  },

  // --- Room bosses: each holds a room on its own, with a prize. They never
  // leave it: the fight starts only if you go up to them. ------------------
  sump_crab: {
    id: 'sump_crab',
    name: 'The Sump Crab',
    blurb: 'Lives in the sump. Pays no rent. Has two claws and one rule, and the rule is "no".',
    stats: { hp: 30, str: 4, speed: 2, evasion: 1, armor: 4, charm: 0 },
    weapon: 3,
    xp: 40,
    tokens: [10, 16],
    special: true,
    tier: 'room',
    size: 1.5,
    prize: ['special', 'hosts_pick'],
    intro: 'Folks, it is a ROOM BOSS! The Sump Crab has held this sump for nine seasons. Nobody has made it say yes!',
    moves: [
      { id: 'pinch', name: 'Pinch', weight: 3, bonus: 0, hit: ['{actor} pinches you for {dmg}. It does not let go until it is finished.', '{actor} pinches you for {dmg}, then pinches the air, for emphasis.'] },
      { id: 'claw_clap', name: 'Claw Clap', weight: 1, bonus: 4, windup: true, hit: ['{actor} claps both claws together with you in the middle. {dmg} damage and a round of applause.'] },
    ],
    roam: { patrolTicksPerTile: 30, chaseTicksPerTile: 30, visionRange: 0, visionArcDeg: 0, hearingRadius: 0, sleepChance: 0, giveUpTicks: 0, smart: true },
  },
  old_flushy: {
    id: 'old_flushy',
    name: 'Old Flushy',
    blurb: 'A goldfish flushed in 1974. It has been eating ever since. It remembers you. It does not, but it acts like it does.',
    stats: { hp: 28, str: 4, speed: 4, evasion: 3, armor: 2, charm: 0 },
    weapon: 3,
    xp: 40,
    tokens: [10, 16],
    special: true,
    tier: 'room',
    size: 1.5,
    prize: ['special', 'hosts_pick'],
    intro: 'A ROOM BOSS! Old Flushy, folks! Somebody\'s childhood pet, all grown up and full of feelings!',
    moves: [
      { id: 'gulp', name: 'Gulp', weight: 3, bonus: 0, hit: ['{actor} gulps at you for {dmg}. Three seconds later it has forgotten, and gulps again.'], status: { kind: 'bleed', turns: 3, chance: 0.4 } },
      { id: 'thrash', name: 'Thrash', weight: 2, bonus: 0, hitsAll: true, hit: ['{actor} thrashes around the room. {dmg} damage to you, and to everybody else.'] },
      { id: 'belly_flop', name: 'Belly Flop', weight: 1, bonus: 4, windup: true, hit: ['{actor} leaps out of the muck and lands on you. {dmg} damage. Ten out of ten from the judges.'] },
    ],
    roam: { patrolTicksPerTile: 30, chaseTicksPerTile: 30, visionRange: 0, visionArcDeg: 0, hearingRadius: 0, sleepChance: 0, giveUpTicks: 0, smart: true },
  },
  hairball_hydra: {
    id: 'hairball_hydra',
    name: 'The Hairball Hydra',
    blurb: 'Every hair that ever went down a plughole, braided into three heads. Each head thinks it is in charge.',
    stats: { hp: 30, str: 4, speed: 3, evasion: 2, armor: 3, charm: 0 },
    weapon: 3,
    xp: 40,
    tokens: [10, 16],
    special: true,
    tier: 'room',
    size: 1.5,
    prize: ['special', 'hosts_pick'],
    intro: 'ROOM BOSS! The Hairball Hydra! Three heads, no shampoo, and a whole lot of attitude!',
    moves: [
      { id: 'tangle', name: 'Tangle', weight: 3, bonus: 0, hit: ['{actor} tangles you up for {dmg}. You will be finding hair in places for weeks.'], status: { kind: 'stunned', turns: 1, chance: 0.15 } },
      { id: 'three_heads', name: 'All Three Heads', weight: 1, bonus: 1, hitsAll: true, hit: ['All three heads of {actor} lunge at once. {dmg} damage to everyone, and they argue about who did it.'] },
      { id: 'hairspray', name: 'Big Hair', weight: 1, bonus: 4, windup: true, hit: ['{actor} puffs itself up to twice its size and falls on you. {dmg} damage. Volume!'] },
    ],
    roam: { patrolTicksPerTile: 30, chaseTicksPerTile: 30, visionRange: 0, visionArcDeg: 0, hearingRadius: 0, sleepChance: 0, giveUpTicks: 0, smart: true },
  },

  // --- The floor boss: guards the stairs from its lair. ---------------------
  fatberg: {
    id: 'fatberg',
    name: 'The Fatberg',
    blurb: 'Forty tonnes of grease, wet wipes and bad decisions, given life by a lightning strike and a lack of oversight.',
    stats: { hp: 60, str: 4, speed: 2, evasion: 0, armor: 2, charm: 0 },
    weapon: 2,
    xp: 120,
    tokens: [30, 40],
    special: true,
    tier: 'floor',
    size: 2,
    prize: ['hosts_pick'],
    intro: 'Ladies and gentlemen, the FLOOR BOSS! Built from everything you ever flushed and said "it\'ll be fine"! It is THE FATBERG! Beat it, and the stairs are yours!',
    moves: [
      { id: 'engulf', name: 'Engulf', weight: 3, bonus: 1, hit: ['{actor} engulfs you for {dmg}. It is warm in there. That is the worst part.'], status: { kind: 'stunned', turns: 1, chance: 0.25 } },
      { id: 'wipe_lash', name: 'Wet Wipe Lash', weight: 2, bonus: 0, hitsAll: true, hit: ['{actor} lashes out with a rope of "flushable" wipes. {dmg} damage to everybody. They were not flushable.'] },
      { id: 'shed', name: 'Shed', weight: 1, bonus: 0, summon: { defId: 'grease_blob', count: 2, max: 2 }, hit: ['{actor} wobbles, and two Grease Blobs slop off it. Mitosis, folks!'] },
      { id: 'landslide', name: 'Landslide', weight: 1, bonus: 6, windup: true, hit: ['{actor} rolls its entire mass over you. {dmg} damage, and you are now partly fatberg.'] },
    ],
    roam: { patrolTicksPerTile: 30, chaseTicksPerTile: 30, visionRange: 0, visionArcDeg: 0, hearingRadius: 0, sleepChance: 0, giveUpTicks: 0, smart: true },
  },
  grease_blob: {
    id: 'grease_blob',
    name: 'Grease Blob',
    blurb: 'A piece of the Fatberg with ambitions of its own.',
    stats: { hp: 6, str: 2, speed: 3, evasion: 1, armor: 0, charm: 0 },
    weapon: 1,
    xp: 2,
    tokens: [0, 1],
    special: true,
    moves: [{ id: 'slap', name: 'Slap', weight: 1, bonus: 0, hit: ['{actor} slaps you wetly for {dmg}.', '{actor} gets grease on you for {dmg}. It will not wash out.'] }],
    roam: { patrolTicksPerTile: 16, chaseTicksPerTile: 16, visionRange: 4, visionArcDeg: 120, hearingRadius: 2, sleepChance: 0, giveUpTicks: 60, smart: false },
  },
};
