import { ENEMIES } from '../src/data/enemies';
import { createGameState } from '../src/game/state';
import type { Entity, GameState, Vec } from '../src/game/types';
import { isWalkable } from '../src/gen/reach';

/** A fresh run with the floor's enemies removed, so tests can place their own. */
export function emptyRun(seed = 11): GameState {
  const state = createGameState(seed);
  state.floor.entities = [];
  state.events = [];
  return state;
}

export function spawn(
  state: GameState,
  defId: string,
  pos: Vec,
  opts: { facing?: number; asleep?: boolean; alert?: 'idle' | 'suspicious' | 'chasing'; route?: Vec[] } = {},
): Entity {
  const def = ENEMIES[defId];
  const e: Entity = {
    id: `t${state.floor.entities.length}`,
    kind: 'enemy',
    defId,
    pos: { ...pos },
    facing: opts.facing ?? 0,
    stats: { ...def.stats, maxHp: def.stats.hp },
    cooldowns: {},
    inventory: [],
    patrol: {
      route: opts.route ?? [{ ...pos }],
      visionRange: def.roam.visionRange,
      visionArc: (def.roam.visionArcDeg * Math.PI) / 180,
      hearingRadius: def.roam.hearingRadius,
      alert: opts.alert ?? 'idle',
    },
    mind: { routeIndex: 0, waitTicks: 0, asleep: !!opts.asleep, lostSight: 0, suspicion: 0, lastSeen: null, alertedAt: -1000, stunned: 0 },
  };
  state.floor.entities.push(e);
  return e;
}

/** A walkable tile at the given offset from the player, or throw. */
export function nearPlayer(state: GameState, dx: number, dy: number): Vec {
  const p = { x: state.player.pos.x + dx, y: state.player.pos.y + dy };
  if (!isWalkable(state.floor, p.x, p.y)) throw new Error(`not walkable: ${dx},${dy}`);
  return p;
}
