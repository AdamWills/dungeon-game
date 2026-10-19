// Improvisation tables (GDD "Improvisation: the bad ideas system"). Every
// channel resolves to the same outcome shape: a grade, effects with targets,
// and a line from Chet. Generic tag rules make every prop and item work;
// hand-written combos override them for the funniest pairs.

import type { EffectRef } from './items';
import type { PropTag } from './props';

export type Grade = 'disaster' | 'meh' | 'brilliant' | 'legendary';

/** An effect plus who it lands on: you, one random enemy, or every enemy. */
export type OutcomeEffect = EffectRef & { target: 'self' | 'one' | 'all' };

export type OutcomeTemplate = { grade: Grade; effects: OutcomeEffect[]; line: string };

export type PropVerb = 'shove' | 'kick' | 'throw' | 'eat' | 'hide' | 'ignite';

export const VERBS: Record<PropVerb, { name: string; help: string }> = {
  shove: { name: 'Shove', help: 'Push it onto an enemy. Heavy things hit hard.' },
  kick: { name: 'Kick', help: 'Kick it at an enemy. Slippery things trip them up; heavy things hurt your foot.' },
  throw: { name: 'Throw', help: 'Throw it at an enemy. Sharp things cut. Heavy things will not leave your hands.' },
  eat: { name: 'Eat', help: 'Eat it. Edible things heal (and maybe worse). Inedible things fight back.' },
  hide: { name: 'Hide in', help: 'Hide in it. Containers make enemies lose track of you for a turn.' },
  ignite: { name: 'Ignite', help: 'Set it on fire. Flammable things burn everyone; explosive things explode.' },
};

/** Generic rules per verb: the first rule whose tag test passes wins. */
export const VERB_RULES: Record<PropVerb, ({ when: PropTag | 'any'; unless?: PropTag } & OutcomeTemplate)[]> = {
  shove: [
    { when: 'heavy', grade: 'brilliant', effects: [{ kind: 'damage', amount: 7, type: 'blunt', target: 'one' }, { kind: 'status', status: 'stunned', turns: 1, target: 'one' }],
      line: 'You shove the {prop} onto {target}! TIMBER! The folks at home felt that one.' },
    { when: 'any', grade: 'meh', effects: [{ kind: 'damage', amount: 2, type: 'blunt', target: 'one' }],
      line: 'You shove the {prop} at {target}. It sort of bumps into them. Polite applause.' },
  ],
  kick: [
    { when: 'heavy', grade: 'disaster', effects: [{ kind: 'damage', amount: 3, target: 'self' }],
      line: 'You kick the {prop}. The {prop} wins. Ooh, that is a broken toe, folks!' },
    { when: 'slippery', grade: 'brilliant', effects: [{ kind: 'damage', amount: 2, type: 'blunt', target: 'one' }, { kind: 'status', status: 'stunned', turns: 1, target: 'one' }],
      line: 'You kick the {prop} under {target}. They slip and go DOWN! Comedy!' },
    { when: 'any', grade: 'meh', effects: [{ kind: 'damage', amount: 3, type: 'blunt', target: 'one' }],
      line: 'You punt the {prop} into {target}. A solid, unglamorous {dmg}.' },
  ],
  throw: [
    { when: 'heavy', grade: 'meh', effects: [],
      line: 'You try to lift the {prop}. You do not lift the {prop}. Your back files a complaint.' },
    { when: 'sharp', grade: 'brilliant', effects: [{ kind: 'damage', amount: 5, type: 'sharp', target: 'one' }, { kind: 'status', status: 'bleed', turns: 2, target: 'one' }],
      line: 'You hurl the {prop} at {target}! It sticks! Somebody get a mop!' },
    { when: 'any', grade: 'meh', effects: [{ kind: 'damage', amount: 4, type: 'blunt', target: 'one' }],
      line: 'You throw the {prop} at {target}. Bonk!' },
  ],
  eat: [
    { when: 'edible', grade: 'brilliant', effects: [{ kind: 'heal', amount: 6, target: 'self' }],
      line: 'You eat the {prop}. Mmm. Chewy. +{heal} HP.' },
    { when: 'any', grade: 'disaster', effects: [{ kind: 'damage', amount: 3, target: 'self' }],
      line: 'You bite the {prop}. The {prop} bites back, metaphorically. Your teeth do not survive, literally.' },
  ],
  hide: [
    { when: 'container', grade: 'brilliant', effects: [{ kind: 'status', status: 'charmed', turns: 1, target: 'all' }],
      line: 'You hide in the {prop}! Where did the contestant go? Nobody knows! Nobody attacks!' },
    { when: 'any', grade: 'meh', effects: [],
      line: 'You hide behind the {prop}. All of you is still visible. Brave choice.' },
  ],
  ignite: [
    { when: 'explosive', grade: 'legendary', effects: [{ kind: 'damage', amount: 8, type: 'fire', target: 'all' }, { kind: 'damage', amount: 3, target: 'self' }],
      line: 'You set fire to the {prop} and it EXPLODES! Everyone is on the floor! Including you! Ratings!' },
    { when: 'flammable', grade: 'brilliant', effects: [{ kind: 'damage', amount: 2, type: 'fire', target: 'all' }, { kind: 'status', status: 'burning', turns: 2, target: 'all' }],
      line: 'You set the {prop} alight! The whole set is on fire! Beautiful!' },
    { when: 'any', grade: 'meh', effects: [],
      line: 'You try to set the {prop} on fire. It refuses. Fire safety: one, contestant: nil.' },
  ],
};

/** Hand-written verb and prop combos, keyed `verb:propId`. */
export const PROP_COMBOS: Record<string, OutcomeTemplate> = {
  'shove:vending_machine': { grade: 'legendary', effects: [{ kind: 'damage', amount: 10, type: 'blunt', target: 'one' }, { kind: 'status', status: 'stunned', turns: 2, target: 'one' }],
    line: 'You tip the Vending Machine onto {target}! It dispenses ONE ENEMY, flattened! LEGENDARY!' },
  'kick:vending_machine': { grade: 'brilliant', effects: [{ kind: 'heal', amount: 5, target: 'self' }],
    line: 'You kick the Vending Machine and a free snack drops out! Expired, but free! +{heal} HP.' },
  'ignite:sludge_puddle': { grade: 'legendary', effects: [{ kind: 'status', status: 'burning', turns: 3, target: 'all' }, { kind: 'damage', amount: 3, type: 'fire', target: 'all' }],
    line: 'You light the Sludge Puddle and it goes up like a season finale! Everybody is ON FIRE!' },
  'throw:folding_chair': { grade: 'brilliant', effects: [{ kind: 'damage', amount: 6, type: 'blunt', target: 'one' }, { kind: 'status', status: 'stunned', turns: 1, target: 'one' }],
    line: 'FOLDING CHAIR to the back of {target}! Folks, it is a CLASSIC for a reason!' },
  'kick:fire_extinguisher': { grade: 'brilliant', effects: [{ kind: 'status', status: 'stunned', turns: 1, target: 'all' }],
    line: 'You kick the Fire Extinguisher and it rockets around the room spraying foam! Everybody down!' },
  'eat:corpse': { grade: 'meh', effects: [{ kind: 'heal', amount: 8, target: 'self' }, { kind: 'status', status: 'poison', turns: 3, target: 'self' }],
    line: 'You eat the Remains, mid-fight. +{heal} HP. The judges are speechless. So is your stomach.' },
  'hide:barrel': { grade: 'brilliant', effects: [{ kind: 'status', status: 'charmed', turns: 2, target: 'all' }],
    line: 'You climb into the Barrel and pull the lid shut. They search. They do not search well.' },
};

// --- item jank ----------------------------------------------------------------

/** Hand-written combos for two specific items, keyed by both ids sorted and joined with '+'. */
export const JANK_COMBOS: Record<string, { name: string } & OutcomeTemplate> = {
  'pipe_bomb+rubber_chicken': { name: 'Squeaky Shrapnel', grade: 'legendary', effects: [{ kind: 'damage', amount: 10, type: 'sharp', target: 'all' }, { kind: 'status', status: 'stunned', turns: 1, target: 'all' }],
    line: 'You stuff the Rubber Chicken with the Pipe Bomb. SQUEAK-BOOM! Squeaky Shrapnel everywhere!' },
  'craft_services_sandwich+ghost_pepper_sauce': { name: 'Inferno Hoagie', grade: 'brilliant', effects: [{ kind: 'heal', amount: 12, target: 'self' }, { kind: 'status', status: 'hasted', turns: 2, target: 'self' }],
    line: 'You make an Inferno Hoagie and eat it in one go. +{heal} HP and your legs are moving on their own!' },
  'glitter_bomb+pipe_bomb': { name: 'Glitterpocalypse', grade: 'legendary', effects: [{ kind: 'damage', amount: 8, type: 'sharp', target: 'all' }, { kind: 'status', status: 'stunned', turns: 1, target: 'all' }],
    line: 'GLITTERPOCALYPSE! It is sharp, it is sparkly, it is EVERYWHERE!' },
  'expired_energy_drink+ghost_pepper_sauce': { name: 'Liquid Regret', grade: 'brilliant', effects: [{ kind: 'status', status: 'burning', turns: 3, target: 'all' }],
    line: 'You shake up Liquid Regret and spray the room. Everything it touches catches fire. Do not drink that.' },
  'mystery_antidote+suspicious_bandage': { name: 'Field Surgery', grade: 'brilliant', effects: [{ kind: 'cleanse', target: 'self' }, { kind: 'heal', amount: 18, target: 'self' }],
    line: 'You perform Field Surgery on yourself. With a crayon antidote. It WORKS! +{heal} HP!' },
  'giant_novelty_check+hex_scroll': { name: 'Cursed Cheque', grade: 'brilliant', effects: [{ kind: 'status', status: 'hexed', turns: 3, target: 'all' }],
    line: 'You write a hex on the Giant Novelty Check. A Cursed Cheque! Everyone it is made out to is hexed!' },
  'previous_contestant_jar+smelling_salts': { name: 'He\'s Awake!', grade: 'legendary', effects: [{ kind: 'status', status: 'charmed', turns: 3, target: 'all' }],
    line: 'You wave the Smelling Salts under the jar. HE\'S AWAKE! He screams! Nobody wants to fight anymore!' },
  'canned_laughter+rubber_chicken': { name: 'Comedy Gold', grade: 'brilliant', effects: [{ kind: 'status', status: 'charmed', turns: 3, target: 'all' }],
    line: 'Rubber Chicken plus Canned Laughter: COMEDY GOLD! The whole room is in stitches!' },
  'expired_energy_drink+mystery_antidote': { name: 'Second Wind', grade: 'brilliant', effects: [{ kind: 'heal', amount: 8, target: 'self' }, { kind: 'status', status: 'hasted', turns: 2, target: 'self' }],
    line: 'You mix a Second Wind. It fizzes in a colour that does not exist. +{heal} HP, and you are FAST!' },
  'giant_novelty_check+glitter_bomb': { name: 'Prize Reveal', grade: 'brilliant', effects: [{ kind: 'status', status: 'stunned', turns: 2, target: 'all' }],
    line: 'You stage a Prize Reveal! Glitter! A giant check! Everyone stands frozen, waiting for the money!' },
};

/** Tags for items used in jank (items without tags count as junk). */
export const ITEM_TAGS: Record<string, PropTag[]> = {
  pipe_bomb: ['explosive'],
  glitter_bomb: ['explosive'],
  ghost_pepper_sauce: ['flammable'],
  expired_energy_drink: ['edible', 'flammable'],
  craft_services_sandwich: ['edible'],
  suspicious_bandage: ['flammable'],
  mystery_antidote: ['edible'],
  smelling_salts: ['edible'],
  hex_scroll: ['flammable'],
  giant_novelty_check: ['flammable'],
  rubber_chicken: ['slippery'],
  previous_contestant_jar: ['container', 'heavy'],
  canned_laughter: ['container'],
  sharpened_trophy: ['sharp'],
  chainless_chainsaw: ['sharp', 'heavy'],
  prize_wheel_spoke: ['sharp'],
  mop_of_reckoning: ['slippery'],
  bin_lid_shield: ['heavy', 'conductive'],
  bubble_wrap_vest: ['slippery'],
  traffic_cone_helmet: ['container'],
};

/** Generic jank: the first rule where one item has `a` (and the other has `b`, if given) wins. */
export const JANK_RULES: ({ a: PropTag; b?: PropTag; name: string } & OutcomeTemplate)[] = [
  { a: 'explosive', name: 'Improvised Device', grade: 'brilliant', effects: [{ kind: 'damage', amount: 6, type: 'fire', target: 'all' }],
    line: 'You tape the {a} to the {b} and throw it. BOOM! The {name} works!' },
  { a: 'flammable', b: 'flammable', name: 'Bonfire', grade: 'brilliant', effects: [{ kind: 'status', status: 'burning', turns: 2, target: 'all' }],
    line: 'You set the {a} and the {b} alight together. A Bonfire! Toasty, deadly television!' },
  { a: 'edible', b: 'edible', name: 'Mystery Smoothie', grade: 'brilliant', effects: [{ kind: 'heal', amount: 8, target: 'self' }],
    line: 'You blend the {a} and the {b} into a Mystery Smoothie. +{heal} HP. Do not ask.' },
  { a: 'sharp', name: 'Spiky Surprise', grade: 'brilliant', effects: [{ kind: 'damage', amount: 5, type: 'sharp', target: 'one' }, { kind: 'status', status: 'bleed', turns: 2, target: 'one' }],
    line: 'You strap the {a} to the {b}. Spiky Surprise! {target} is surprised. And spiky.' },
];

/** When nothing matches: mild, random results. */
export const JANK_FALLBACK: ({ name: string } & OutcomeTemplate)[] = [
  { name: 'Contraption', grade: 'meh', effects: [{ kind: 'damage', amount: 2, type: 'blunt', target: 'one' }],
    line: 'You combine the {a} and the {b} into a Contraption and throw it at {target}. It does... something. {dmg}.' },
  { name: 'Snack', grade: 'meh', effects: [{ kind: 'heal', amount: 3, target: 'self' }],
    line: 'You combine the {a} and the {b} and, for reasons, eat it. +{heal} HP.' },
  { name: 'Art', grade: 'meh', effects: [],
    line: 'You combine the {a} and the {b} into Art. It does nothing. It is very moving.' },
];

/** Jank backfires this often; the result hits you instead (never fatally). */
export const JANK_BACKFIRE = 0.15;
export const BACKFIRE_LINE = 'BACKFIRE! The {name} goes off in your hands! Folks, THAT is why we read the instructions!';

// --- the Bad Idea button --------------------------------------------------------

export type BadIdea = { id: string; name: string; weight: number } & OutcomeTemplate;

export const BAD_IDEAS: BadIdea[] = [
  { id: 'backflip', name: 'Do a Backflip', grade: 'meh', weight: 10, effects: [],
    line: 'You do a backflip! It is technically impressive. Nobody is hurt, which is the problem.' },
  { id: 'negotiate', name: 'Negotiate', grade: 'brilliant', weight: 7, effects: [{ kind: 'status', status: 'charmed', turns: 2, target: 'all' }],
    line: 'You open negotiations. Everyone is so confused they agree to a two-turn ceasefire!' },
  { id: 'pretend_management', name: 'Pretend to Be Management', grade: 'brilliant', weight: 7, effects: [{ kind: 'status', status: 'stunned', turns: 1, target: 'all' }],
    line: 'You clear your throat and say "Let\'s circle back." Everyone freezes in corporate terror!' },
  { id: 'play_dead', name: 'Play Dead', grade: 'meh', weight: 9, effects: [{ kind: 'status', status: 'charmed', turns: 1, target: 'one' }],
    line: 'You play dead. {target} buys it, briefly. Everyone else is unconvinced.' },
  { id: 'lick_floor', name: 'Lick the Floor', grade: 'disaster', weight: 8, effects: [{ kind: 'status', status: 'poison', turns: 3, target: 'self' }],
    line: 'You lick the sewer floor. Why? WHY? The judges have so many questions. So does your liver.' },
  { id: 'theme_song', name: 'Sing the Theme Song', grade: 'legendary', weight: 2, effects: [{ kind: 'status', status: 'charmed', turns: 3, target: 'all' }, { kind: 'heal', amount: 5, target: 'self' }],
    line: 'You sing the DESCEND & WIN! theme song, all four verses! Everyone is weeping! Chet is weeping!' },
  { id: 'punch_yourself', name: 'Punch Yourself', grade: 'disaster', weight: 8, effects: [{ kind: 'damage', amount: 4, target: 'self' }],
    line: 'You punch yourself in the face to assert dominance. It does not assert dominance. -{selfdmg} HP.' },
  { id: 'hug_it_out', name: 'Hug It Out', grade: 'meh', weight: 8, effects: [{ kind: 'status', status: 'charmed', turns: 1, target: 'one' }, { kind: 'damage', amount: 2, target: 'self' }],
    line: 'You hug {target}. It is moist. It is confused. You are slightly bitten.' },
  { id: 'phone_a_friend', name: 'Phone a Friend', grade: 'brilliant', weight: 6, effects: [{ kind: 'heal', amount: 10, target: 'self' }],
    line: 'You phone a friend! Nobody picks up, but the hold music is so soothing. +{heal} HP.' },
  { id: 'spin_around', name: 'Spin Around Really Fast', grade: 'disaster', weight: 7, effects: [{ kind: 'status', status: 'stunned', turns: 1, target: 'self' }],
    line: 'You spin around really fast. You are now very dizzy and lying down. Bold strategy!' },
  { id: 'call_out_chet', name: 'Call Out the Host', grade: 'legendary', weight: 2, effects: [{ kind: 'damage', amount: 9, target: 'all' }],
    line: 'You call Chet a hack, live on air. A spotlight drops from the ceiling. It misses you. It does NOT miss them!' },
  { id: 'moonwalk', name: 'Moonwalk', grade: 'meh', weight: 9, effects: [{ kind: 'status', status: 'hasted', turns: 1, target: 'self' }],
    line: 'You moonwalk. Smooth! You somehow end up slightly faster. Nobody knows how.' },
];

/** Charm nudges the odds: brilliant and legendary weights grow by this much per point. */
export const CHARM_NUDGE = 0.06;

/** Each repeat of the same improvisation in a run is this much weaker (multiplied per repeat). */
export const REPEAT_DECAY = 0.7;
export const REPEAT_LINE = ' (You have done this before. It is less impressive now.)';

/** The validator's caps, whatever the source. */
export const IMPROV_LIMITS = { maxDamage: 12, maxHeal: 18, maxTurns: 4 };
