// The single source of truth for a run. Pure data plus constructors; the
// world modules advance it.

import { CLASSES } from '../data/classes';
import { TUNING } from '../data/tuning';
import { generateFloor } from '../gen/floor';
import { updateFov } from '../world/fov';
import { createRng, deriveSeed } from './rng';
import type { Entity, Floor, GameState } from './types';

export function createPlayer(classId: string): Entity {
  const cls = CLASSES[classId];
  if (!cls) throw new Error(`Unknown class: ${classId}`);
  return {
    id: 'player',
    kind: 'player',
    defId: classId,
    pos: { x: 0, y: 0 },
    facing: Math.PI / 2,
    stats: { ...cls.base, maxHp: cls.base.hp },
  };
}

export function createGameState(seed: number, classId = 'brawler'): GameState {
  const rng = createRng(seed);
  const floor = generateFloor(deriveSeed(rng), 1);
  const state: GameState = {
    seed,
    rng,
    tick: 0,
    mode: 'roaming',
    floor,
    player: createPlayer(classId),
    events: [],
  };
  enterFloor(state, floor);
  return state;
}

export function enterFloor(state: GameState, floor: Floor): void {
  state.floor = floor;
  state.player.pos = { ...floor.start };
  state.player.motion = undefined;
  updateFov(floor, floor.start, TUNING.fovRadius);
  state.events.push({ type: 'floorEntered', floor: floor.index, seed: floor.seed });
}
