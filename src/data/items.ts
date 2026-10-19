// Items (GDD "Loot"): 12 weapons and armour, 10 consumables, 8 junk and
// cursed things. Names and jokes first; every number is a placeholder until
// M5. Adding an item is a one-entry change here (plus an icon if you like).

import type { StatusKind } from './statuses';

export type Rarity = 'junk' | 'standard' | 'special' | 'cursed' | 'hosts_pick';

export type StatKey = 'maxHp' | 'str' | 'speed' | 'evasion' | 'armor' | 'charm';

export type EffectRef =
  | { kind: 'heal'; amount: number }
  | { kind: 'damage'; amount: number; pierce?: boolean } // pierce ignores Armor
  | { kind: 'status'; status: StatusKind; turns: number; then?: { status: StatusKind; turns: number } }
  | { kind: 'cleanse' };

export type ItemDef = {
  id: string;
  name: string;
  rarity: Rarity;
  slot?: 'weapon' | 'armor' | 'trinket';
  weapon?: { damage: number; onHit?: { status: StatusKind; turns: number; chance: number } };
  /** Stat changes while equipped. */
  mods?: Partial<Record<StatKey, number>>;
  /** Statuses that cannot be applied to you while equipped. */
  resists?: StatusKind[];
  /** Once worn, cannot be taken off. */
  cursed?: boolean;
  /** What using it does. Items without `use` cannot be used, only equipped or carried. */
  use?: {
    target: 'self' | 'one_enemy' | 'all_enemies';
    effects: EffectRef[];
    /** Only makes sense in a fight. */
    battleOnly?: boolean;
    /** Used up on use. */
    consumable: boolean;
  };
  /** The joke. */
  description: string;
  /** Plain menu help: what it actually does. */
  help: string;
  /** Battle log line when used; {target} and {amount} are filled in. */
  useLine?: string;
  /** Kept out of chests and drops (class kit pieces). */
  noLoot?: boolean;
};

export const ITEMS: Record<string, ItemDef> = {
  // --- weapons ---------------------------------------------------------------
  rusted_pipe: {
    id: 'rusted_pipe', name: 'Rusted Pipe', rarity: 'standard', slot: 'weapon', noLoot: true,
    weapon: { damage: 3 },
    description: 'Load-bearing until very recently.',
    help: 'Weapon. 3 damage.',
  },
  cursed_clipboard: {
    id: 'cursed_clipboard', name: 'Cursed Clipboard', rarity: 'standard', slot: 'weapon', noLoot: true,
    weapon: { damage: 3 }, mods: { charm: 1 },
    description: 'Every page is a waiver you already signed.',
    help: 'Weapon. 3 damage, +1 Charm.',
  },
  mop_of_reckoning: {
    id: 'mop_of_reckoning', name: 'Mop of Reckoning', rarity: 'standard', slot: 'weapon',
    weapon: { damage: 4 },
    description: 'The cleaning crew\'s finest. Cleans up afterwards, mostly you.',
    help: 'Weapon. 4 damage.',
  },
  sharpened_trophy: {
    id: 'sharpened_trophy', name: 'Sharpened Participation Trophy', rarity: 'special', slot: 'weapon',
    weapon: { damage: 4, onHit: { status: 'bleed', turns: 3, chance: 0.4 } },
    description: 'Everyone gets one. Not everyone gets one in the neck.',
    help: 'Weapon. 4 damage; 40% chance a hit makes the target bleed for 3 turns.',
  },
  giant_foam_finger: {
    id: 'giant_foam_finger', name: 'Giant Foam Finger', rarity: 'junk', slot: 'weapon',
    weapon: { damage: 1 }, mods: { charm: 3 },
    description: 'WE\'RE NUMBER ONE. We are not.',
    help: 'Weapon. 1 damage, +3 Charm.',
  },
  chainless_chainsaw: {
    id: 'chainless_chainsaw', name: 'Chainsaw (Chain Sold Separately)', rarity: 'standard', slot: 'weapon',
    weapon: { damage: 6 }, mods: { speed: -1 },
    description: 'It roars. It vibrates. It is, functionally, a very loud club.',
    help: 'Weapon. 6 damage, -1 Speed.',
  },
  prize_wheel_spoke: {
    id: 'prize_wheel_spoke', name: 'Prize Wheel Spoke', rarity: 'special', slot: 'weapon',
    weapon: { damage: 5 }, mods: { speed: 1 },
    description: 'Snapped off the big wheel. Chet has not noticed. Chet will notice.',
    help: 'Weapon. 5 damage, +1 Speed.',
  },
  // --- armour ----------------------------------------------------------------
  velour_tracksuit: {
    id: 'velour_tracksuit', name: 'Velour Tracksuit', rarity: 'standard', slot: 'armor', noLoot: true,
    mods: { armor: 1 },
    description: 'Breathable. Absorbent. Regrettably not stab-proof.',
    help: 'Armour. +1 Armor.',
  },
  traffic_cone_helmet: {
    id: 'traffic_cone_helmet', name: 'Traffic Cone Helmet', rarity: 'junk', slot: 'armor',
    mods: { armor: 1, evasion: -1 },
    description: 'Visible from orbit. Mostly protects your dignity, badly.',
    help: 'Armour. +1 Armor, -1 Evasion.',
  },
  sequin_jacket: {
    id: 'sequin_jacket', name: 'Contestant Sequin Jacket', rarity: 'special', slot: 'armor',
    mods: { armor: 1, charm: 2 },
    description: 'Catches the light. Also blades, but mostly the light.',
    help: 'Armour. +1 Armor, +2 Charm.',
  },
  bin_lid_shield: {
    id: 'bin_lid_shield', name: 'Bin Lid Shield', rarity: 'standard', slot: 'armor',
    mods: { armor: 2, speed: -1 },
    description: 'Smells like Tuesday. Stops a staple.',
    help: 'Armour. +2 Armor, -1 Speed.',
  },
  bubble_wrap_vest: {
    id: 'bubble_wrap_vest', name: 'Bubble Wrap Vest', rarity: 'standard', slot: 'armor',
    mods: { armor: 2 },
    description: 'Pops reassuringly with every blow. Folks at home find it very satisfying.',
    help: 'Armour. +2 Armor.',
  },
  hazmat_poncho: {
    id: 'hazmat_poncho', name: 'Hazmat Poncho', rarity: 'special', slot: 'armor',
    mods: { armor: 1 }, resists: ['poison'],
    description: 'Rated for most hazards. Which ones is printed on the inside, in the dark.',
    help: 'Armour. +1 Armor, immune to poison.',
  },
  // --- consumables -----------------------------------------------------------
  suspicious_bandage: {
    id: 'suspicious_bandage', name: 'Suspicious Bandage', rarity: 'junk',
    use: { target: 'self', consumable: true, effects: [{ kind: 'heal', amount: 10 }] },
    description: 'Pre-owned. The previous owner no longer needs it, or anything.',
    help: 'Heals 10 HP. Used up.',
    useLine: 'You apply the Suspicious Bandage. +{amount} HP. Do not ask where it has been.',
  },
  craft_services_sandwich: {
    id: 'craft_services_sandwich', name: 'Craft Services Sandwich', rarity: 'standard',
    use: { target: 'self', consumable: true, effects: [{ kind: 'heal', amount: 15 }] },
    description: 'Egg salad, from the first season. A classic, like the smell.',
    help: 'Heals 15 HP. Used up.',
    useLine: 'You eat the Craft Services Sandwich. +{amount} HP, and a vintage aftertaste.',
  },
  expired_energy_drink: {
    id: 'expired_energy_drink', name: 'Expired Energy Drink', rarity: 'special',
    use: { target: 'self', consumable: true, battleOnly: true, effects: [{ kind: 'status', status: 'hasted', turns: 3, then: { status: 'stunned', turns: 5 } }] },
    description: 'Best before the moon landing. Contains 900% of your daily everything.',
    help: 'In battle: act twice a round for 3 turns, then stunned for 5. Used up.',
    useLine: 'You chug the Expired Energy Drink. Your heart is doing a drum solo!',
  },
  hex_scroll: {
    id: 'hex_scroll', name: 'Hex Scroll', rarity: 'standard',
    use: { target: 'one_enemy', consumable: true, battleOnly: true, effects: [{ kind: 'damage', amount: 6, pierce: true }] },
    description: 'A strongly worded memo, weaponised.',
    help: 'In battle: 6 damage to one enemy, ignoring Armor. Used up.',
    useLine: 'You read the Hex Scroll at {target}. {amount} damage, in triplicate!',
  },
  pipe_bomb: {
    id: 'pipe_bomb', name: 'Pipe Bomb', rarity: 'special',
    use: { target: 'all_enemies', consumable: true, battleOnly: true, effects: [{ kind: 'damage', amount: 8 }] },
    description: 'Plumbing-adjacent. Do not let Chet see. He will want it on the show.',
    help: 'In battle: 8 damage to every enemy. Used up.',
    useLine: 'You throw the Pipe Bomb! KA-BLAMMO! That is how you get ratings, folks!',
  },
  smelling_salts: {
    id: 'smelling_salts', name: 'Smelling Salts', rarity: 'standard',
    use: { target: 'self', consumable: true, effects: [{ kind: 'cleanse' }, { kind: 'heal', amount: 3 }] },
    description: 'Wakes the dead. Not literally. Please stop asking.',
    help: 'Removes all your status effects and heals 3 HP. Used up.',
    useLine: 'You sniff the Smelling Salts. Your eyebrows leave. Your problems leave with them.',
  },
  ghost_pepper_sauce: {
    id: 'ghost_pepper_sauce', name: 'Ghost Pepper Hot Sauce', rarity: 'standard',
    use: { target: 'one_enemy', consumable: true, battleOnly: true, effects: [{ kind: 'status', status: 'burning', turns: 3 }] },
    description: 'Scoville rating: litigious.',
    help: 'In battle: sets one enemy burning for 3 turns. Used up.',
    useLine: 'You splash Ghost Pepper Hot Sauce on {target}. It is ON FIRE, folks!',
  },
  glitter_bomb: {
    id: 'glitter_bomb', name: 'Glitter Bomb', rarity: 'standard',
    use: { target: 'all_enemies', consumable: true, battleOnly: true, effects: [{ kind: 'status', status: 'stunned', turns: 1 }] },
    description: 'Stage glitter. They will be finding it for years. So will you.',
    help: 'In battle: stuns every enemy for 1 turn. Used up.',
    useLine: 'GLITTER BOMB! Everyone is sparkly and confused! Beautiful television!',
  },
  canned_laughter: {
    id: 'canned_laughter', name: 'Can of Canned Laughter', rarity: 'special',
    use: { target: 'all_enemies', consumable: true, battleOnly: true, effects: [{ kind: 'status', status: 'charmed', turns: 2 }] },
    description: 'Pop the lid and the whole room thinks you are hilarious. For a bit.',
    help: 'In battle: every enemy is charmed and will not attack for 2 turns. Used up.',
    useLine: 'You crack open the Canned Laughter. HAHAHA! Everyone loves you! Temporarily!',
  },
  mystery_antidote: {
    id: 'mystery_antidote', name: 'Mystery Antidote', rarity: 'junk',
    use: { target: 'self', consumable: true, effects: [{ kind: 'cleanse' }, { kind: 'heal', amount: 5 }] },
    description: 'The label says ANTIDOTE in crayon. That is the whole label.',
    help: 'Removes all your status effects and heals 5 HP. Used up.',
    useLine: 'You drink the Mystery Antidote. It tastes of crayon. +{amount} HP.',
  },
  // --- junk ------------------------------------------------------------------
  rubber_chicken: {
    id: 'rubber_chicken', name: 'Rubber Chicken', rarity: 'junk',
    use: { target: 'one_enemy', consumable: true, battleOnly: true, effects: [{ kind: 'damage', amount: 2, pierce: true }] },
    description: 'Squeaks with judgement. A show staple since the pilot.',
    help: 'In battle: throw it for 2 damage to one enemy, ignoring Armor. Used up.',
    useLine: 'You throw the Rubber Chicken at {target}. SQUEAK. {amount} damage. Comedy!',
  },
  giant_novelty_check: {
    id: 'giant_novelty_check', name: 'Giant Novelty Check', rarity: 'junk',
    use: { target: 'self', consumable: false, effects: [] },
    description: 'Made out to CONTESTANT for FIVE DOLLARS. Unsigned. Uncashable. Treasured.',
    help: 'Does nothing. You can wave it around.',
    useLine: 'You wave the Giant Novelty Check. Nobody is impressed. It is five dollars.',
  },
  previous_contestant_jar: {
    id: 'previous_contestant_jar', name: 'Previous Contestant (in a Jar)', rarity: 'junk',
    use: { target: 'one_enemy', consumable: true, battleOnly: true, effects: [{ kind: 'damage', amount: 7 }] },
    description: 'He gives advice. Bad advice. He does make a good projectile.',
    help: 'In battle: throw it for 7 damage to one enemy. Used up.',
    useLine: 'You hurl the jar at {target}! The previous contestant finally makes an impact!',
  },
  sewer_rabbit_foot: {
    id: 'sewer_rabbit_foot', name: 'Sewer Rabbit\'s Foot', rarity: 'junk', slot: 'trinket',
    mods: { evasion: 1 },
    description: 'It was not lucky for the rabbit. Or, frankly, for the sewer.',
    help: 'Trinket. +1 Evasion.',
  },
  // --- cursed ----------------------------------------------------------------
  chets_spare_microphone: {
    id: 'chets_spare_microphone', name: 'Chet\'s Spare Microphone', rarity: 'cursed', slot: 'trinket', cursed: true,
    mods: { str: 5, evasion: -3, armor: -2 },
    description: 'Still warm. Still on. Everything you say is now broadcast, and you cannot put it down.',
    help: 'Cursed trinket: +5 Strength, but -3 Evasion and -2 Armor.',
  },
  paper_crown: {
    id: 'paper_crown', name: 'Paper Crown of Champions', rarity: 'cursed', slot: 'trinket', cursed: true,
    mods: { charm: 4, evasion: 3, speed: 2, maxHp: -10 },
    description: 'From the one season someone won. It has not stopped judging you since.',
    help: 'Cursed trinket: +4 Charm, +3 Evasion, +2 Speed, but -10 max HP.',
  },
  lucky_handcuff: {
    id: 'lucky_handcuff', name: 'Lucky Handcuff', rarity: 'cursed', slot: 'armor', cursed: true,
    mods: { armor: 5, maxHp: 6, speed: -3 },
    description: 'Lucky for whoever was on the other end. Locks on contact.',
    help: 'Cursed armour: +5 Armor, +6 max HP, but -3 Speed (you act last and fleeing gets hard).',
  },
  // --- host's pick -----------------------------------------------------------
  golden_buzzer: {
    id: 'golden_buzzer', name: 'The Golden Buzzer', rarity: 'hosts_pick', slot: 'trinket',
    mods: { str: 2, speed: 2, evasion: 1 },
    description: 'Chet\'s own. He wants it back. He will get it back. Enjoy it until then.',
    help: 'Trinket. +2 Strength, +2 Speed, +1 Evasion.',
  },
};

/** How often each rarity turns up in chests and drops. */
export const RARITY_WEIGHTS: Record<Rarity, number> = { junk: 30, standard: 36, special: 18, cursed: 12, hosts_pick: 4 };

export const RARITY_NAMES: Record<Rarity, string> = {
  junk: 'Junk', standard: 'Standard', special: 'Special', cursed: 'Cursed', hosts_pick: 'Host\'s Pick',
};

/** Most items a contestant can carry, equipped ones included. */
export const INVENTORY_CAP = 12;
