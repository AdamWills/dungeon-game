// Core shapes, following docs/GDD.md "Data models". Later milestones extend
// these rather than replace them.

import type { Stance } from '../data/allies';
import type { HazardKind } from '../data/hazards';
import type { Grade, OutcomeEffect, PropVerb } from '../data/improv';
import type { StatKey } from '../data/items';
import type { StatusKind } from '../data/statuses';
import type { Rng } from './rng';
import type { Talk } from './talk';

export type Vec = { x: number; y: number };

export type Terrain = 'floor' | 'wall' | 'stairs' | 'door' | 'hazard';

export type GoreMark = { kind: 'blood' | 'gibs' };

export type Tile = {
  terrain: Terrain;
  explored: boolean;
  gore: GoreMark[];
  /** Doors only: closed doors block movement and sight. */
  door?: { open: boolean };
  /** Hazard tiles only. */
  hazard?: HazardKind;
};

export type Chest = { id: string; pos: Vec; opened: boolean };

/** A prop standing on the map (barrels, vending machines, ...). */
export type MapProp = { id: string; defId: string; pos: Vec; usesLeft: number };

/** A prop in a battle's arena, and where it came from on the map. */
export type ArenaProp = {
  id: string;
  defId: string;
  usesLeft: number;
  source: { kind: 'map'; propId: string } | { kind: 'corpse'; at: Vec } | { kind: 'sludge'; at: Vec };
};

/** Every improvisation, from any channel, resolves to this before it touches the game. */
export type ImprovOutcome = {
  grade: Grade;
  effects: OutcomeEffect[];
  narration: string;
  source: 'table' | 'parser' | 'llm';
  discoveryKey: string;
};

/** An item lying on the floor, waiting to be picked up. */
/** `left`: you saw it and chose to leave it; it no longer pops up when you step on it. */
export type FloorItem = { id: string; pos: Vec; item: ItemInstance; left?: boolean };

/** An item on offer on a prize card: take it, or leave it where it was found. */
export type Offer = { item: ItemInstance; from: 'chest' | 'floor'; at: Vec };

export type Room = { id: number; x1: number; y1: number; x2: number; y2: number; center: Vec };

export type Floor = {
  index: number;
  theme: string;
  seed: number;
  width: number;
  height: number;
  tiles: Tile[][]; // tiles[y][x]
  rooms: Room[];
  start: Vec;
  stairs: Vec;
  /** Enemies (and later allies, props) living on this floor. */
  entities: Entity[];
  chests: Chest[];
  items: FloorItem[];
  props: MapProp[];
  /** The floor boss's lair: the stairs room. Found once it roars; beaten unlocks the stairs. */
  lair?: { room: number; bossId: string; found: boolean; beaten: boolean };
  /** 1 where the player can currently see, flat index y * width + x. */
  visible: number[];
};

export type Stats = { hp: number; maxHp: number; str: number; speed: number; evasion: number; armor: number; charm: number };

export type Dir = 'up' | 'down' | 'left' | 'right';

/** A tile-to-tile step in progress. pos is interpolated from this. */
export type Motion = { from: Vec; to: Vec; tick: number; ticks: number };

export type Alert = 'idle' | 'suspicious' | 'chasing';

export type Patrol = {
  route: Vec[]; // waypoints, looped
  visionRange: number; // tiles
  visionArc: number; // radians, centered on facing
  hearingRadius: number; // tiles
  alert: Alert;
};

/** Roaming AI bookkeeping for one enemy. */
export type EnemyMind = {
  routeIndex: number;
  waitTicks: number;
  asleep: boolean;
  /** Ticks since the chased player was last seen. */
  lostSight: number;
  /** Ticks left in the current suspicious spell. */
  suspicion: number;
  /** Ticks before a suspicious enemy turns toward what it heard. */
  turnDelay: number;
  lastSeen: Vec | null;
  /** Tick the enemy last became alerted, for the "!" over its head. */
  alertedAt: number;
  /** Ticks to stand still (after a fled battle). */
  stunned: number;
};

export type ItemInstance = { defId: string; charges?: number; identified: boolean };

export type Status = { kind: StatusKind; turnsLeft: number; then?: { status: StatusKind; turns: number } };

/** Worn gear by paper-doll slot (see SLOTS in game/equipment). */
export type Equipment = Partial<Record<EquipSlot, ItemInstance>>;
export type EquipSlot = 'head' | 'neck' | 'shoulders' | 'body' | 'belt' | 'legs' | 'weapon' | 'offhand' | 'hands' | 'ring1' | 'ring2' | 'feet';

/** An ally's hidden feelings and orders. Captives waiting on the map are not recruited yet. */
export type AllyMind = {
  recruited: boolean;
  /** 0 to 100, hidden from the player. */
  loyalty: number;
  stance: Stance;
  /** Chet has read out their profile. */
  spotted?: boolean;
  /** You healed them during the current fight. */
  healedThisFight?: boolean;
  /** Chet has already warned you they are unhappy. */
  warned?: boolean;
  /** Facts you learned by talking to them, shown on their card. */
  known?: string[];
  /** The fight count when you last said something kind (chats). */
  lastKindAt?: number;
  /** HP they join with (a spared enemy keeps its wounds). */
  joinHp?: number;
};

export type Entity = {
  id: string;
  kind: 'player' | 'ally' | 'enemy';
  defId: string;
  pos: Vec; // tile units, fractional while moving
  facing: number; // radians
  motion?: Motion;
  stats: Stats;
  cooldowns: Record<string, number>; // abilityId -> player turns left
  inventory: ItemInstance[];
  equipment?: Equipment; // player only for now
  patrol?: Patrol; // enemies only
  mind?: EnemyMind; // enemies only
  ally?: AllyMind; // allies only
  /** Enemies only: an elite trait (see data/bosses). */
  elite?: string;
  /** Which hazard tile it stands on and for how long, for damage timing. */
  onHazard?: { key: string; ticks: number; active?: boolean };
};

export type Mode = 'roaming' | 'battle' | 'menu' | 'dead' | 'won';

export type Encounter = {
  enemyIds: string[]; // enemies within the join radius, max 4
  start: 'player_ambush' | 'enemy_ambush' | 'normal';
  tile: Vec; // where gore and loot land afterwards
};

export type LogLine = { text: string; tone: 'info' | 'good' | 'bad' | 'host' };

/** A visible thing that happened in battle, for the UI to animate. */
export type BattleFx = { seq: number; targetId: string; kind: 'hit' | 'miss' | 'heal' | 'death' | 'defend' | 'status'; amount?: number };

export type Combatant = {
  id: string;
  side: 'player' | 'enemy';
  defId: string;
  name: string;
  stats: Stats; // snapshot; HP carries in and is written back afterwards
  defending: boolean;
  alive: boolean;
  statuses: Status[];
  /** One of your allies (including an enemy you just spared). */
  ally?: boolean;
  /** Enemies only: an elite trait. */
  elite?: string;
  /** Enemies only: the move and target it has lined up for its next turn. */
  intent?: { moveId: string; targetId: string };
};

export type BattleCommand =
  | { kind: 'attack'; targetId: string }
  | { kind: 'ability'; abilityId: string; targetId?: string }
  | { kind: 'item'; slot: number; targetId?: string }
  | { kind: 'defend' }
  | { kind: 'flee' }
  | { kind: 'spare'; targetId: string }
  | { kind: 'improvise'; channel: 'prop'; propId: string; verb: PropVerb }
  | { kind: 'improvise'; channel: 'jank'; slots: [number, number] }
  | { kind: 'improvise'; channel: 'badIdea' }
  | { kind: 'continue' }; // acknowledge the result screen

/** Inventory screen commands (time is paused). Slots index player.inventory. */
export type InvCommand =
  | { kind: 'equip'; slot: number }
  | { kind: 'unequip'; slot: EquipSlot }
  | { kind: 'use'; slot: number }
  | { kind: 'drop'; slot: number }
  | { kind: 'dismiss' } // take the item on the prize card
  | { kind: 'leave' } // leave it where it was found
  | { kind: 'give'; slot: number; allyId: string }
  | { kind: 'stance'; allyId: string; stance: Stance }
  | { kind: 'train'; stat: StatKey } // spend a level-up point
  | { kind: 'perk'; id: string }
  | { kind: 'say'; choice: number } // pick a line in a conversation
  | { kind: 'talk'; allyId: string }; // chat with a party member

export type BattleState = {
  encounter: Encounter;
  round: number;
  order: string[]; // combatant ids in acting order this round
  turn: number; // index into order
  combatants: Combatant[];
  /** Which side gets the opening-round +50% damage, if anyone. */
  ambushSide: 'player' | 'enemy' | null;
  log: LogLine[];
  fx: BattleFx[];
  fxSeq: number;
  result: 'won' | 'fled' | 'lost' | null;
  /** Props within reach of the fight, up to 4. */
  props: ArenaProp[];
  /** Bad Idea presses this fight. */
  badIdeas: number;
  /** Thick Skull: the first hit on you has been halved already. */
  skullUsed?: boolean;
  /** Enemies spared this fight: they leave with you as allies. */
  spared: string[];
  /** Ally ability cooldowns this fight, in that ally's turns. */
  allyCooldowns: Record<string, number>;
  /** Fixed steps until the next turn plays out (pacing; nothing happens meanwhile). */
  wait: number;
  /** Your turn has started and the menu is waiting for you. */
  yourTurn: boolean;
  /** XP and tokens won, worked out once when the fight is won. */
  spoils?: { xp: number; tokens: number };
  /** You always get a first turn: until then, nothing can take you below 1 HP. */
  playerHasActed: boolean;
  /** What killed the player, for the death screen. */
  killedBy?: { enemy: string; move: string };
};

/** The elimination report (GDD "EliminationReport"), with the run's numbers. */
export type EliminationReport = {
  runSeed: number;
  floor: number;
  race: string;
  cls: string;
  level: number;
  enemy: string;
  move: string;
  fights: number;
  badIdeas: number;
  alliesRecruited: number;
  alliesLost: number;
  lastWords: string;
  partingGift: string;
  hostLine: string;
  source: 'scripted' | 'llm';
};

export type RunEnd = { kind: 'died'; enemy: string; move: string; report: EliminationReport } | { kind: 'escaped' };

/** Running totals for the report, and your last action for your last words. */
export type RunRecord = {
  fights: number;
  badIdeas: number;
  alliesRecruited: number;
  alliesLost: number;
  lastAction: { kind: string; item?: string };
};

export type GameEvent =
  | { type: 'floorEntered'; floor: number; seed: number }
  | { type: 'stairsTaken'; floor: number; tick: number }
  | { type: 'modeChanged'; from: Mode; to: Mode }
  | { type: 'enemyAlerted'; id: string; defId: string }
  | { type: 'battleStarted'; enemyIds: string[]; start: Encounter['start'] }
  | { type: 'entityDied'; id: string; defId: string; killerId: string }
  | { type: 'battleEnded'; result: 'won' | 'fled' | 'lost' }
  | { type: 'runEnded'; end: RunEnd }
  | { type: 'itemPicked'; defId: string; from: 'chest' | 'floor' }
  | { type: 'inventoryFull'; defId: string }
  | { type: 'chestOpened'; id: string }
  | { type: 'doorOpened'; at: Vec }
  | { type: 'itemUsed'; defId: string }
  | { type: 'itemEquipped'; defId: string; slot: EquipSlot }
  | { type: 'itemRefused'; defId: string; reason: 'cursed' | 'battleOnly' | 'notUsable' }
  | { type: 'hazardHurt'; id: string; kind: HazardKind; dmg: number }
  | { type: 'corpseEaten'; hp: number }
  | { type: 'improvised'; key: string; grade: Grade; firstThisRun: boolean }
  | { type: 'tokensGained'; amount: number; from: 'chest' | 'battle' }
  | { type: 'xpGained'; amount: number }
  | { type: 'levelUp'; level: number }
  | { type: 'perkTaken'; id: string }
  | { type: 'lowHp'; hp: number }
  | { type: 'captiveSpotted'; allyId: string }
  | { type: 'bribeShort'; allyId: string; price: number; tokens: number }
  | { type: 'allyRecruited'; allyId: string }
  | { type: 'allyDied'; allyId: string; item: string | null }
  | { type: 'allyLeft'; allyId: string; how: 'quit' | 'steal' | 'turn'; item: string | null }
  | { type: 'loyaltyLow'; allyId: string }
  | { type: 'skillUp'; id: string; level: number }
  | { type: 'allyDismissed'; allyId: string }
  | { type: 'bossRoared'; defId: string }
  | { type: 'bossDefeated'; defId: string; tier: 'elite' | 'room' | 'floor'; name: string }
  | { type: 'stairsSealed'; defId: string };

export type GameState = {
  seed: number;
  race: string;
  cls: string;
  rng: Rng;
  tick: number;
  mode: Mode;
  floor: Floor;
  player: Entity;
  /** Dash state: ticks of dash left and cooldown before the next one. */
  dash: { active: number; cooldown: number };
  /** Ticks after a fled battle during which contact does not start a fight. */
  grace: number;
  battle: BattleState | null;
  runEnd: RunEnd | null;
  /** How often each improvisation has been done this run (repeats get weaker). */
  improvCounts: Record<string, number>;
  /** New items waiting to be shown on a prize card; time is paused while any are. */
  reveals: Offer[];
  /** Recruited allies, in following order. */
  party: Entity[];
  /** Tiles the player has just left, newest first: the party walks along this. */
  trail: Vec[];
  /** Prize Tokens, the in-run money. */
  tokens: number;
  xp: number;
  level: number;
  /** Level-up points spent on each stat. */
  trained: Partial<Record<StatKey, number>>;
  perks: string[];
  /** Skills level through use (Read the Room, ...). */
  skills: Record<string, { level: number; xp: number }>;
  /** A conversation in progress (time is paused). */
  talk: Talk | null;
  /** A level-up waiting on the player: points to spend and perks to pick from. */
  levelUp: { points: number; perkChoices: string[] | null } | null;
  record: RunRecord;
  /** Events raised during the current step; the shell drains them onto the bus. */
  events: GameEvent[];
};

/** One tick of input. The shell samples the keyboard; logic only sees this. */
export type InputFrame = {
  move: Dir | null;
  interact: boolean;
  pause: boolean;
  dash: boolean;
  command: BattleCommand | InvCommand | null;
};

export const NO_INPUT: InputFrame = { move: null, interact: false, pause: false, dash: false, command: null };
