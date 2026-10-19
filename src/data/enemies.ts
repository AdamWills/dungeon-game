// Sewer fauna. Names and lines first, numbers untuned until M5.

import type { Stats } from '../game/types';
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
};

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
};
