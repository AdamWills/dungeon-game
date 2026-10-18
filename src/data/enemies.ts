// Sewer fauna. Names and lines first, numbers untuned until M5.

import type { Stats } from '../game/types';

export type EnemyMove = {
  id: string;
  name: string;
  weight: number;
  /** Extra damage on top of weapon + Strength. */
  bonus: number;
  /** Hit lines; {actor} and {dmg} are filled in. */
  hit: string[];
};

export type EnemyDef = {
  id: string;
  name: string;
  blurb: string;
  stats: Omit<Stats, 'maxHp'>;
  weapon: number;
  xp: number;
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
    moves: [
      { id: 'gnaw', name: 'Gnaw', weight: 3, bonus: 0, hit: ['{actor} gnaws on your ankle for {dmg}.', '{actor} bites you for {dmg} and looks smug about it.'] },
      { id: 'lanyard_whip', name: 'Lanyard Whip', weight: 1, bonus: 1, hit: ['{actor} whips you with its lanyard for {dmg}. Your access is revoked.'] },
    ],
    roam: { patrolTicksPerTile: 16, chaseTicksPerTile: 8, visionRange: 5, visionArcDeg: 100, hearingRadius: 3, sleepChance: 0.1, giveUpTicks: 180 },
  },
  feral_intern: {
    id: 'feral_intern',
    name: 'Feral Intern',
    blurb: 'Unpaid. Unsupervised. Armed with a stapler and a grievance.',
    stats: { hp: 12, str: 3, speed: 3, evasion: 2, armor: 1, charm: 1 },
    weapon: 2,
    xp: 6,
    moves: [
      { id: 'staple', name: 'Staple', weight: 3, bonus: 0, hit: ['{actor} staples you for {dmg}. It is collating you.', '{actor} staples you to the present moment for {dmg}.'] },
      { id: 'reply_all', name: 'Reply-All', weight: 1, bonus: 2, hit: ['{actor} screams a reply-all at you. {dmg} psychic damage.'] },
    ],
    roam: { patrolTicksPerTile: 14, chaseTicksPerTile: 10, visionRange: 6, visionArcDeg: 90, hearingRadius: 4, sleepChance: 0.15, giveUpTicks: 240 },
  },
  sludge_hopper: {
    id: 'sludge_hopper',
    name: 'Sludge Hopper',
    blurb: 'A frog assembled from things that went down the drain. It is proud of this.',
    stats: { hp: 10, str: 3, speed: 4, evasion: 4, armor: 0, charm: 0 },
    weapon: 1,
    xp: 5,
    moves: [
      { id: 'splat', name: 'Splat', weight: 2, bonus: 0, hit: ['{actor} lands on you. {dmg} damage and a smell that will outlive you.'] },
      { id: 'tongue_lash', name: 'Tongue Lash', weight: 2, bonus: 1, hit: ['{actor} tongues you across the face for {dmg}. Unprofessional.'] },
    ],
    roam: { patrolTicksPerTile: 12, chaseTicksPerTile: 9, visionRange: 4, visionArcDeg: 160, hearingRadius: 5, sleepChance: 0, giveUpTicks: 150 },
  },
  pipe_leech: {
    id: 'pipe_leech',
    name: 'Pipe Leech',
    blurb: 'Two metres of mouth. Mostly sleeps. Wakes up hungry and litigious.',
    stats: { hp: 16, str: 4, speed: 1, evasion: 0, armor: 2, charm: 0 },
    weapon: 2,
    xp: 8,
    moves: [
      { id: 'latch', name: 'Latch', weight: 3, bonus: 0, hit: ['{actor} latches on for {dmg}. It has opinions about your blood type.'] },
      { id: 'drink_deep', name: 'Drink Deep', weight: 1, bonus: 3, hit: ['{actor} drinks deep. You lose {dmg} HP and some self-respect.'] },
    ],
    roam: { patrolTicksPerTile: 24, chaseTicksPerTile: 16, visionRange: 3, visionArcDeg: 120, hearingRadius: 3, sleepChance: 0.7, giveUpTicks: 120 },
  },
  grudge_gator: {
    id: 'grudge_gator',
    name: 'Grudge Gator',
    blurb: 'Flushed as a hatchling. Has not let it go.',
    stats: { hp: 22, str: 5, speed: 2, evasion: 1, armor: 3, charm: 0 },
    weapon: 3,
    xp: 14,
    moves: [
      { id: 'chomp', name: 'Chomp', weight: 3, bonus: 0, hit: ['{actor} chomps you for {dmg}. It was thinking about someone else.'] },
      { id: 'death_roll', name: 'Death Roll', weight: 1, bonus: 4, hit: ['{actor} death-rolls you for {dmg}. Twenty years of resentment, released.'] },
    ],
    roam: { patrolTicksPerTile: 20, chaseTicksPerTile: 12, visionRange: 6, visionArcDeg: 80, hearingRadius: 3, sleepChance: 0.3, giveUpTicks: 300 },
  },
};
