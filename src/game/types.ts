// Core shapes, following docs/GDD.md "Data models". Later milestones extend
// these rather than replace them.

import type { HazardKind } from '../data/hazards';
import type { Grade, OutcomeEffect, PropVerb } from '../data/improv';
import type { StatusKind } from '../data/statuses';
import type { Rng } from './rng';

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
export type FloorItem = { id: string; pos: Vec; item: ItemInstance };

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

export type Equipment = { weapon?: ItemInstance; armor?: ItemInstance; trinket?: ItemInstance };

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
  /** Which hazard tile it stands on and for how long, for damage timing. */
  onHazard?: { key: string; ticks: number };
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
};

export type BattleCommand =
  | { kind: 'attack'; targetId: string }
  | { kind: 'ability'; abilityId: string; targetId?: string }
  | { kind: 'item'; slot: number; targetId?: string }
  | { kind: 'defend' }
  | { kind: 'flee' }
  | { kind: 'improvise'; channel: 'prop'; propId: string; verb: PropVerb }
  | { kind: 'improvise'; channel: 'jank'; slots: [number, number] }
  | { kind: 'improvise'; channel: 'badIdea' }
  | { kind: 'continue' }; // acknowledge the result screen

/** Inventory screen commands (time is paused). Slots index player.inventory. */
export type InvCommand =
  | { kind: 'equip'; slot: number }
  | { kind: 'unequip'; slot: 'weapon' | 'armor' | 'trinket' }
  | { kind: 'use'; slot: number }
  | { kind: 'drop'; slot: number };

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
  badIdeaUsed: boolean;
  /** What killed the player, for the death screen. */
  killedBy?: { enemy: string; move: string };
};

export type RunEnd = { kind: 'died'; enemy: string; move: string } | { kind: 'escaped' };

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
  | { type: 'itemEquipped'; defId: string; slot: 'weapon' | 'armor' | 'trinket' }
  | { type: 'itemRefused'; defId: string; reason: 'cursed' | 'battleOnly' | 'notUsable' }
  | { type: 'hazardHurt'; id: string; kind: HazardKind; dmg: number }
  | { type: 'corpseEaten'; hp: number }
  | { type: 'improvised'; key: string; grade: Grade; firstThisRun: boolean };

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
