// One fixed-timestep update: roaming movement, dash, enemy AI and contact,
// or the battle command when a fight is on. Holding a direction chains
// tile-to-tile steps with no pause between them.

import { TUNING } from '../data/tuning';
import { battleCommand, startBattle } from '../battle/turns';
import { updateEnemy } from '../game/ai';
import type { Dir, GameState, InputFrame, Mode, Vec } from '../game/types';
import { isWalkable } from '../gen/reach';
import { buildEncounter, findContact } from './encounter';
import { updateFov } from './fov';
import { advanceMotion, FACING, startMotion, tileOf } from './motion';

const DELTA: Record<Dir, Vec> = {
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
};

export function step(state: GameState, input: InputFrame): void {
  if (input.pause) {
    if (state.mode === 'roaming') setMode(state, 'menu');
    else if (state.mode === 'menu') setMode(state, 'roaming');
  }
  if (state.mode === 'battle') {
    if (input.command) battleCommand(state, input.command);
    return;
  }
  if (state.mode !== 'roaming') return; // time only passes while roaming

  state.tick++;
  if (state.grace > 0) state.grace--;
  if (state.dash.cooldown > 0) state.dash.cooldown--;
  if (state.dash.active > 0) state.dash.active--;

  advanceMotion(state.player);
  if (!state.player.motion) {
    if (input.interact && interact(state)) return;
    if (input.dash && state.dash.cooldown === 0) {
      state.dash.active = TUNING.dash.ticks;
      state.dash.cooldown = TUNING.dash.cooldown;
    }
    const dir = input.move ?? (state.dash.active > 0 ? facingDir(state.player.facing) : null);
    if (dir) tryMove(state, dir);
  }

  for (const e of state.floor.entities) if (e.kind === 'enemy') updateEnemy(state, e);

  const contact = findContact(state);
  if (contact) startBattle(state, buildEncounter(state, contact));
}

/** The tile the player occupies, or is arriving at while moving. */
export function playerTile(state: GameState): Vec {
  return tileOf(state.player);
}

function setMode(state: GameState, to: Mode): void {
  const from = state.mode;
  state.mode = to;
  state.events.push({ type: 'modeChanged', from, to });
}

function tryMove(state: GameState, dir: Dir): void {
  const p = state.player;
  const d = DELTA[dir];
  p.facing = FACING[dir];
  const to = { x: Math.round(p.pos.x) + d.x, y: Math.round(p.pos.y) + d.y };
  if (!isWalkable(state.floor, to.x, to.y)) return;
  startMotion(p, to, state.dash.active > 0 ? TUNING.dash.ticksPerTile : TUNING.playerTicksPerTile);
  // Look from the destination so the view opens up as the step begins.
  updateFov(state.floor, to, TUNING.fovRadius);
}

function facingDir(facing: number): Dir {
  const x = Math.cos(facing);
  const y = Math.sin(facing);
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? 'right' : 'left';
  return y >= 0 ? 'down' : 'up';
}

/** Returns true if the interact key did something. */
function interact(state: GameState): boolean {
  const { x, y } = playerTile(state);
  if (state.floor.tiles[y][x].terrain !== 'stairs') return false;
  // Prototype rule (user decision): the stairs end the run as a win. The
  // mini-boss that guards them arrives in M5.
  state.events.push({ type: 'stairsTaken', floor: state.floor.index, tick: state.tick });
  state.runEnd = { kind: 'escaped' };
  state.events.push({ type: 'runEnded', end: state.runEnd });
  setMode(state, 'won');
  return true;
}
