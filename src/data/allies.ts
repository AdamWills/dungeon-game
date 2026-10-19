// The three recruitable allies (GDD "Recruitable party"): a bruiser, a healer
// and a coward with a gun. Words first; numbers untuned until M5.

import type { DamageType } from './damage';
import type { Stats } from '../game/types';
import type { StatusKind } from './statuses';

export type Stance = 'aggressive' | 'defensive' | 'support';

export type AllyAbility = {
  id: 'lift' | 'remedy' | 'panic_fire';
  name: string;
  cooldown: number;
  /** Plain help for the party screen. */
  help: string;
  /** Battle log line; {ally}, {target}, {other}, {amount} are filled in. */
  line: string;
};

export type AllyDef = {
  id: string;
  name: string;
  /** Short name for menus and the log. */
  short: string;
  archetype: 'bruiser' | 'healer' | 'coward';
  /** Chet's one-line contestant profile, shown before you recruit them. */
  profile: string;
  /** How you get them: open their cell, pay them, or spare them in a fight. */
  recruit: { kind: 'cell' } | { kind: 'bribe'; price: number } | { kind: 'spare'; enemyId: string };
  /** Level 1 stats, plus this much per player level above 1. */
  base: Omit<Stats, 'maxHp'>;
  growth: Partial<Omit<Stats, 'maxHp'>>;
  weapon: { name: string; damage: number; type: DamageType };
  passive: { id: 'load_bearing' | 'second_opinion' | 'survival_instinct'; name: string; help: string };
  ability: AllyAbility;
  /** What happens when loyalty hits zero. */
  betrayal: { kind: 'turn'; enemyId: string } | { kind: 'quit' } | { kind: 'steal' };
  /** Dropped where they fall. */
  item: string;
  attackLines: string[];
};

export const ALLIES: Record<string, AllyDef> = {
  marjorie: {
    id: 'marjorie',
    name: 'Marjorie "The Forklift" Pyle',
    short: 'Marjorie',
    archetype: 'bruiser',
    profile: "Locked up since Season 3 for assaulting a boom mic! Spring her loose and she's all yours, folks!",
    recruit: { kind: 'cell' },
    base: { hp: 26, str: 4, speed: 2, evasion: 1, armor: 2, charm: 0 },
    growth: { hp: 4, str: 1 },
    weapon: { name: 'Pallet Jack Handle', damage: 3, type: 'blunt' },
    passive: { id: 'load_bearing', name: 'Load-Bearing', help: 'Takes 1 less damage from every hit.' },
    ability: {
      id: 'lift',
      name: 'Lift With Your Legs',
      cooldown: 4,
      help: 'Throws one enemy into another: both take damage. Recharges for 4 turns.',
      line: '{ally} lifts {target} with her legs and throws it at {other}! Workplace safety, folks!',
    },
    betrayal: { kind: 'turn', enemyId: 'marjorie_grievance' },
    item: 'bin_lid_shield',
    attackLines: [
      '{ally} clotheslines {target} for {dmg}.',
      '{ally} hits {target} with the pallet jack handle for {dmg}. Union rules!',
      '{ally} body-checks {target} for {dmg}. Three seasons of rage, folks.',
    ],
  },
  moss: {
    id: 'moss',
    name: 'Dr. Ignatius Moss (Unlicensed)',
    short: 'Dr. Moss',
    archetype: 'healer',
    profile: "He's not a real doctor, but he IS a real expensive one! Fifteen tokens and he'll make a house call!",
    recruit: { kind: 'bribe', price: 15 },
    base: { hp: 16, str: 1, speed: 3, evasion: 2, armor: 0, charm: 2 },
    growth: { hp: 2 },
    weapon: { name: 'Reflex Hammer', damage: 1, type: 'blunt' },
    passive: { id: 'second_opinion', name: 'Second Opinion', help: 'After each fight you win, the whole party heals 3 HP.' },
    ability: {
      id: 'remedy',
      name: 'Off-Label Remedy',
      cooldown: 3,
      help: 'Heals the most hurt party member for 8 HP. 10% chance of a side effect. Recharges for 3 turns.',
      line: '{ally} administers something to {target}. +{amount} HP. Do not read the label.',
    },
    betrayal: { kind: 'quit' },
    item: 'smelling_salts',
    attackLines: [
      '{ally} taps {target} with a reflex hammer for {dmg}. The knee jerks. So does {target}.',
      '{ally} bills {target} for {dmg} damage.',
      '{ally} pokes {target} for {dmg} and says "hmm" in a worrying way.',
    ],
  },
  skitch: {
    id: 'skitch',
    name: 'Skitch',
    short: 'Skitch',
    archetype: 'coward',
    profile: "This little guy's been looking for the exit since the pilot episode! Rough him up, then show some mercy!",
    recruit: { kind: 'spare', enemyId: 'skitch' },
    base: { hp: 12, str: 2, speed: 5, evasion: 5, armor: 0, charm: 1 },
    growth: { hp: 2, speed: 1 },
    weapon: { name: 'Nail Gun', damage: 2, type: 'sharp' },
    passive: { id: 'survival_instinct', name: 'Survival Instinct', help: '+3 Evasion, and enemies only go for him when nobody else is standing.' },
    ability: {
      id: 'panic_fire',
      name: 'Panic Fire',
      cooldown: 3,
      help: 'Fires 3 nails at random enemies, 2 damage each. Recharges for 3 turns.',
      line: '{ally} screams and empties the nail gun with his eyes shut!',
    },
    betrayal: { kind: 'steal' },
    item: 'pipe_bomb',
    attackLines: [
      '{ally} nails {target} for {dmg} from behind you.',
      '{ally} shoots {target} for {dmg}, then apologises.',
      '{ally} fires at {target} for {dmg} while hiding behind your leg.',
    ],
  },
};

/** Plain help for the stance picker. */
export const STANCES: Record<Stance, { name: string; help: string }> = {
  aggressive: { name: 'Aggressive', help: 'Attacks the weakest enemy and uses its ability as soon as it is ready.' },
  defensive: { name: 'Defensive', help: 'Draws enemy attacks toward itself and braces when below half HP.' },
  support: { name: 'Support', help: 'Saves its ability for when it helps most and otherwise attacks.' },
};

export const STANCE_ORDER: Stance[] = ['aggressive', 'defensive', 'support'];

/** Hidden loyalty, 0 to 100, and what moves it (user decisions, GDD "Recruitable party"). */
export const LOYALTY = {
  start: 60,
  max: 100,
  /** Chet starts dropping hints below this. */
  low: 30,
  give: 15,
  healed: 10,
  wonTogether: 5,
  fled: -15,
  hurtByYou: -10,
  leftHurt: -10,
  /** "Under 25% HP without help." */
  hurtFraction: 0.25,
};

/** Side effects of the Off-Label Remedy. */
export const REMEDY_SIDE_EFFECTS: { status: StatusKind; turns: number }[] = [
  { status: 'hasted', turns: 2 },
  { status: 'stunned', turns: 1 },
  { status: 'poison', turns: 2 },
];

/** Spare odds: base plus per point of the player's Charm. */
export const SPARE = { hpFraction: 0.4, base: 0.45, perCharm: 0.1, min: 0.2, max: 0.95 };

/** Bribe price after Charm: each point knocks a token off, down to the floor. */
export function bribePrice(base: number, charm: number): number {
  return Math.max(Math.ceil(base / 2), base - Math.max(0, charm));
}
