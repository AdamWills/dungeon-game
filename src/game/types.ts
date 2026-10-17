// Core shapes, following docs/GDD.md "Data models". Only what M1 needs is
// filled in; later milestones extend these rather than replace them.

import type { Rng } from './rng';

export type Vec = { x: number; y: number };

export type Terrain = 'floor' | 'wall' | 'stairs' | 'door' | 'hazard';

export type GoreMark = { kind: string };

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
  /** 1 where the player can currently see, flat index y * width + x. */
  visible: number[];
};

export type Stats = { hp: number; maxHp: number; str: number; speed: number; evasion: number; armor: number; charm: number };

export type Dir = 'up' | 'down' | 'left' | 'right';

/** A tile-to-tile step in progress. pos is interpolated from this. */
export type Motion = { from: Vec; to: Vec; tick: number; ticks: number };

export type Entity = {
  id: string;
  kind: 'player' | 'ally' | 'enemy';
  defId: string;
  pos: Vec; // tile units, fractional while moving
  facing: number; // radians
  motion?: Motion;
  stats: Stats;
};

export type Mode = 'roaming' | 'battle' | 'menu' | 'dead';

export type GameEvent =
  | { type: 'floorEntered'; floor: number; seed: number }
  | { type: 'stairsTaken'; floor: number; tick: number }
  | { type: 'modeChanged'; from: Mode; to: Mode };

export type GameState = {
  seed: number;
  rng: Rng;
  tick: number;
  mode: Mode;
  floor: Floor;
  player: Entity;
  /** Events raised during the current step; the shell drains them onto the bus. */
  events: GameEvent[];
};

/** One tick of input. The shell samples the keyboard; logic only sees this. */
export type InputFrame = {
  move: Dir | null;
  interact: boolean;
  pause: boolean;
};

export const NO_INPUT: InputFrame = { move: null, interact: false, pause: false };
