// Core shapes, following docs/GDD.md "Data models". Later milestones extend
// these rather than replace them.

import type { Rng } from './rng';

export type Vec = { x: number; y: number };

export type Terrain = 'floor' | 'wall' | 'stairs' | 'door' | 'hazard';

export type GoreMark = { kind: 'blood' | 'gibs' };

export type Tile = { terrain: Terrain; explored: boolean; gore: GoreMark[] };

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

export type EffectRef =
  | { kind: 'heal'; amount: number }
  | { kind: 'damage'; amount: number };

export type ItemInstance = { defId: string; charges?: number; identified: boolean };

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
  patrol?: Patrol; // enemies only
  mind?: EnemyMind; // enemies only
};

export type Mode = 'roaming' | 'battle' | 'menu' | 'dead' | 'won';

export type Encounter = {
  enemyIds: string[]; // enemies within the join radius, max 4
  start: 'player_ambush' | 'enemy_ambush' | 'normal';
  tile: Vec; // where gore and loot land afterwards
};

export type LogLine = { text: string; tone: 'info' | 'good' | 'bad' | 'auditor' };

/** A visible thing that happened in battle, for the UI to animate. */
export type BattleFx = { seq: number; targetId: string; kind: 'hit' | 'miss' | 'heal' | 'death' | 'defend'; amount?: number };

export type Combatant = {
  id: string;
  side: 'player' | 'enemy';
  defId: string;
  name: string;
  stats: Stats; // snapshot; HP carries in and is written back afterwards
  defending: boolean;
  alive: boolean;
};

export type BattleCommand =
  | { kind: 'attack'; targetId: string }
  | { kind: 'ability'; abilityId: string; targetId?: string }
  | { kind: 'item'; slot: number }
  | { kind: 'defend' }
  | { kind: 'flee' }
  | { kind: 'continue' }; // acknowledge the result screen

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
  | { type: 'runEnded'; end: RunEnd };

export type GameState = {
  seed: number;
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
  /** Events raised during the current step; the shell drains them onto the bus. */
  events: GameEvent[];
};

/** One tick of input. The shell samples the keyboard; logic only sees this. */
export type InputFrame = {
  move: Dir | null;
  interact: boolean;
  pause: boolean;
  dash: boolean;
  command: BattleCommand | null;
};

export const NO_INPUT: InputFrame = { move: null, interact: false, pause: false, dash: false, command: null };
