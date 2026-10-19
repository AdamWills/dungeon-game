// The single source of truth for a run. Pure data plus constructors; the
// world and battle modules advance it.

import { CLASSES } from '../data/classes';
import { RACES } from '../data/races';
import { TUNING } from '../data/tuning';
import { generateFloor } from '../gen/floor';
import { updateFov } from '../world/fov';
import { computeStats } from './equipment';
import { gatherParty } from './party';
import { createRng, deriveSeed } from './rng';
import type { Entity, Equipment, Floor, GameState } from './types';

export function createPlayer(raceId: string, classId: string): Entity {
  const cls = CLASSES[classId];
  if (!cls) throw new Error(`Unknown class: ${classId}`);
  if (!RACES[raceId]) throw new Error(`Unknown race: ${raceId}`);
  const equipment: Equipment = {};
  for (const [slot, defId] of Object.entries(cls.kit)) if (defId) equipment[slot as keyof Equipment] = { defId, identified: true };
  return {
    id: 'player',
    kind: 'player',
    defId: classId,
    pos: { x: 0, y: 0 },
    facing: Math.PI / 2,
    stats: computeStats(raceId, classId, equipment),
    cooldowns: {},
    inventory: cls.startingItems.map((defId) => ({ defId, identified: true })),
    equipment,
  };
}

export function createGameState(seed: number, raceId = 'human', classId = 'brawler'): GameState {
  const rng = createRng(seed);
  const floor = generateFloor(deriveSeed(rng), 1);
  const state: GameState = {
    seed,
    race: raceId,
    cls: classId,
    rng,
    tick: 0,
    mode: 'roaming',
    floor,
    player: createPlayer(raceId, classId),
    dash: { active: 0, cooldown: 0 },
    grace: 0,
    battle: null,
    runEnd: null,
    improvCounts: {},
    reveals: [],
    party: [],
    trail: [],
    tokens: 0,
    xp: 0,
    level: 1,
    trained: {},
    perks: [],
    skills: {},
    levelUp: null,
    record: { fights: 0, badIdeas: 0, alliesRecruited: 0, alliesLost: 0, lastAction: { kind: 'none' } },
    events: [],
  };
  enterFloor(state, floor);
  return state;
}

export function enterFloor(state: GameState, floor: Floor): void {
  state.floor = floor;
  state.player.pos = { ...floor.start };
  state.player.motion = undefined;
  gatherParty(state);
  updateFov(floor, floor.start, TUNING.fovRadius);
  state.events.push({ type: 'floorEntered', floor: floor.index, seed: floor.seed });
}
