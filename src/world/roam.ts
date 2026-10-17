// One fixed-timestep update of roaming: tile-smooth movement with grid
// collision, FOV refresh, and the interact key. Holding a direction chains
// tile-to-tile steps with no pause between them.

import { TUNING } from '../data/tuning';
import { generateFloor } from '../gen/floor';
import { isWalkable } from '../gen/reach';
import { deriveSeed } from '../game/rng';
import { enterFloor } from '../game/state';
import type { Dir, GameState, InputFrame, Mode, Vec } from '../game/types';
import { updateFov } from './fov';

const DELTA: Record<Dir, Vec & { facing: number }> = {
  right: { x: 1, y: 0, facing: 0 },
  down: { x: 0, y: 1, facing: Math.PI / 2 },
  left: { x: -1, y: 0, facing: Math.PI },
  up: { x: 0, y: -1, facing: -Math.PI / 2 },
};

export function step(state: GameState, input: InputFrame): void {
  if (input.pause) {
    if (state.mode === 'roaming') setMode(state, 'menu');
    else if (state.mode === 'menu') setMode(state, 'roaming');
  }
  if (state.mode !== 'roaming') return; // time only passes while roaming

  state.tick++;
  advanceMotion(state);

  if (!state.player.motion) {
    if (input.interact && interact(state)) return;
    if (input.move) tryMove(state, input.move);
  }
}

/** The tile the player occupies, or is arriving at while moving. */
export function playerTile(state: GameState): Vec {
  const p = state.player;
  return p.motion ? { ...p.motion.to } : { x: Math.round(p.pos.x), y: Math.round(p.pos.y) };
}

function setMode(state: GameState, to: Mode): void {
  const from = state.mode;
  state.mode = to;
  state.events.push({ type: 'modeChanged', from, to });
}

function advanceMotion(state: GameState): void {
  const p = state.player;
  const m = p.motion;
  if (!m) return;
  m.tick++;
  if (m.tick >= m.ticks) {
    p.pos = { ...m.to };
    p.motion = undefined;
    return;
  }
  const t = m.tick / m.ticks;
  p.pos = { x: m.from.x + (m.to.x - m.from.x) * t, y: m.from.y + (m.to.y - m.from.y) * t };
}

function tryMove(state: GameState, dir: Dir): void {
  const p = state.player;
  const d = DELTA[dir];
  p.facing = d.facing;
  const from = { x: p.pos.x, y: p.pos.y };
  const to = { x: from.x + d.x, y: from.y + d.y };
  if (!isWalkable(state.floor, to.x, to.y)) return;
  p.motion = { from, to, tick: 0, ticks: TUNING.playerTicksPerTile };
  // Look from the destination so the view opens up as the step begins.
  updateFov(state.floor, to, TUNING.fovRadius);
}

/** Returns true if the interact key did something. */
function interact(state: GameState): boolean {
  const { x, y } = playerTile(state);
  if (state.floor.tiles[y][x].terrain !== 'stairs') return false;
  state.events.push({ type: 'stairsTaken', floor: state.floor.index, tick: state.tick });
  // M1 placeholder: the prototype has one floor, so descending generates a
  // fresh one. The real stairs (guarded, ends the run) arrive with the mini-boss.
  enterFloor(state, generateFloor(deriveSeed(state.rng), state.floor.index + 1));
  return true;
}
