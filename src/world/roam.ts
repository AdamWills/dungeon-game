// One fixed-timestep update: roaming movement, dash, doors, chests, pickups,
// hazards, enemy AI and contact; the battle command when a fight is on; the
// inventory command while paused. Holding a direction chains tile-to-tile
// steps with no pause between them.

import { TUNING } from '../data/tuning';
import { battleCommand, battleTick, startBattle } from '../battle/turns';
import { updateEnemy } from '../game/ai';
import { inventoryCommand } from '../game/equipment';
import { captiveAt, leaveTrail, spotCaptives, tryRecruit, updateParty } from '../game/party';
import type { BattleCommand, Dir, GameState, InputFrame, InvCommand, Mode, Vec } from '../game/types';
import { isWalkable } from '../gen/reach';
import { buildEncounter, findContact } from './encounter';
import { updateFov } from './fov';
import { updateHazards } from './hazards';
import { chestAt, eatRemains, facingTile, isClosedDoor, openChest, openDoor, pickUp, propAt } from './interact';
import { advanceMotion, FACING, startMotion, tileOf } from './motion';

const DELTA: Record<Dir, Vec> = {
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
};

export function step(state: GameState, input: InputFrame): void {
  if (input.pause && !state.levelUp) {
    if (state.mode === 'roaming') setMode(state, 'menu');
    else if (state.mode === 'menu') {
      state.reveals = []; // leaving the pause also closes any prize cards
      setMode(state, 'roaming');
    }
  }
  if (state.mode === 'battle') {
    battleTick(state);
    if (input.command && isBattleCommand(input.command)) battleCommand(state, input.command);
    return;
  }
  if (state.mode === 'menu') {
    if (input.command && !isBattleCommand(input.command)) inventoryCommand(state, input.command);
    return;
  }
  if (state.mode !== 'roaming') return; // time only passes while roaming

  state.tick++;
  if (state.grace > 0) state.grace--;
  // Catching your breath between fights.
  if (state.tick % TUNING.regenTicks === 0)
    for (const e of [state.player, ...state.party]) e.stats.hp = Math.min(e.stats.maxHp, e.stats.hp + (e.stats.hp > 0 ? 1 : 0));
  if (state.dash.cooldown > 0) state.dash.cooldown--;
  if (state.dash.active > 0) state.dash.active--;

  if (advanceMotion(state.player)) pickUp(state);
  if (!state.player.motion) {
    if (input.interact && interact(state)) return;
    if (input.dash && state.dash.cooldown === 0) {
      state.dash.active = TUNING.dash.ticks;
      state.dash.cooldown = TUNING.dash.cooldown;
    }
    const dir = input.move ?? (state.dash.active > 0 ? facingDir(state.player.facing) : null);
    if (dir) tryMove(state, dir);
  }

  if (state.mode !== 'roaming') return; // a prize card just went up; the world waits

  updateParty(state, state.dash.active > 0 ? TUNING.dash.ticksPerTile : TUNING.playerTicksPerTile);
  const here = state.player.pos;
  for (const e of state.floor.entities)
    if (e.kind === 'enemy' && Math.abs(e.pos.x - here.x) + Math.abs(e.pos.y - here.y) <= TUNING.ai.activeRadius) updateEnemy(state, e);
  spotCaptives(state);

  updateHazards(state);
  if (state.mode !== 'roaming') return; // a hazard finished you off

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
  // Bumping a closed door opens it; bumping a chest opens that.
  if (isClosedDoor(state, to.x, to.y)) return openDoor(state, to);
  if (chestAt(state, to.x, to.y)) {
    openChest(state, to.x, to.y);
    return;
  }
  // Bumping a captive asks them to join; they do not get out of the way.
  const captive = captiveAt(state, to.x, to.y);
  if (captive) {
    if (state.dash.active === 0) tryRecruit(state, captive);
    return;
  }
  if (!isWalkable(state.floor, to.x, to.y) || propAt(state, to.x, to.y)) return;
  leaveTrail(state, p.pos);
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

/** Inventory commands are the short, fixed list; everything else is for battle. */
function isBattleCommand(cmd: BattleCommand | InvCommand): cmd is BattleCommand {
  return !['equip', 'unequip', 'use', 'drop', 'dismiss', 'give', 'stance', 'train', 'perk'].includes(cmd.kind);
}

/** Returns true if the interact key did something. */
function interact(state: GameState): boolean {
  const { x, y } = playerTile(state);
  if (state.floor.tiles[y][x].terrain !== 'stairs') {
    if (eatRemains(state)) return true;
    const f = facingTile(state);
    if (openChest(state, f.x, f.y)) return true;
    const captive = captiveAt(state, f.x, f.y);
    if (captive) {
      tryRecruit(state, captive);
      return true;
    }
    if (isClosedDoor(state, f.x, f.y)) {
      openDoor(state, f);
      return true;
    }
    return false;
  }
  // Prototype rule (user decision): the stairs end the run as a win. The
  // mini-boss that guards them arrives in M5.
  state.events.push({ type: 'stairsTaken', floor: state.floor.index, tick: state.tick });
  state.runEnd = { kind: 'escaped' };
  state.events.push({ type: 'runEnded', end: state.runEnd });
  setMode(state, 'won');
  return true;
}
