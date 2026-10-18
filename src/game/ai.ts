// Enemy roaming AI: patrol a route, notice the player through a vision cone
// or by hearing, chase at their own speed, give up after losing sight.

import { ENEMIES } from '../data/enemies';
import { TUNING } from '../data/tuning';
import { bfsDistances, isWalkable } from '../gen/reach';
import { lineOfSight } from '../world/los';
import { advanceMotion, distance, startMotion, tileOf } from '../world/motion';
import { nextInt } from './rng';
import type { Entity, GameState, Vec } from './types';

export function updateEnemy(state: GameState, e: Entity): void {
  const mind = e.mind!;
  if (mind.stunned > 0) {
    mind.stunned--;
    return;
  }
  perceive(state, e);
  if (e.motion) {
    advanceMotion(e);
    if (e.motion) return;
  }
  decide(state, e);
}

/** Whether the enemy could see this spot right now (cone, range, walls). */
export function canSee(state: GameState, e: Entity, p: Vec): boolean {
  const patrol = e.patrol!;
  if (e.mind!.asleep) return false;
  if (distance(e.pos, p) > patrol.visionRange) return false;
  if ((p.x !== e.pos.x || p.y !== e.pos.y) && angleDiff(e.facing, Math.atan2(p.y - e.pos.y, p.x - e.pos.x)) > patrol.visionArc / 2)
    return false;
  return lineOfSight(state.floor, e.pos, p);
}

function perceive(state: GameState, e: Entity): void {
  const patrol = e.patrol!;
  const mind = e.mind!;
  const def = ENEMIES[e.defId];
  const player = state.player;
  const pTile = tileOf(player);
  const dist = distance(e.pos, player.pos);

  if (patrol.alert === 'chasing') {
    // Once chasing, it tracks you all around, not just in its cone.
    if (dist <= patrol.visionRange + 2 && lineOfSight(state.floor, e.pos, player.pos)) {
      mind.lostSight = 0;
      mind.lastSeen = pTile;
    } else if (++mind.lostSight > def.roam.giveUpTicks) {
      patrol.alert = 'idle';
      mind.lastSeen = null;
      mind.waitTicks = 30;
    }
    return;
  }

  if (canSee(state, e, player.pos)) {
    patrol.alert = 'chasing';
    mind.lastSeen = pTile;
    mind.lostSight = 0;
    mind.alertedAt = state.tick;
    state.events.push({ type: 'enemyAlerted', id: e.id, defId: e.defId });
    return;
  }

  const hearing = mind.asleep ? patrol.hearingRadius / 2 : patrol.hearingRadius;
  if (player.motion && dist <= hearing) {
    mind.asleep = false;
    patrol.alert = 'suspicious';
    mind.suspicion = TUNING.ai.suspicionTicks;
    mind.lastSeen = pTile;
    if (!e.motion) e.facing = Math.atan2(player.pos.y - e.pos.y, player.pos.x - e.pos.x);
  }
}

function decide(state: GameState, e: Entity): void {
  const patrol = e.patrol!;
  const mind = e.mind!;
  const def = ENEMIES[e.defId];
  if (mind.asleep) return;

  if (patrol.alert === 'chasing') {
    const target = mind.lastSeen ?? tileOf(state.player);
    stepToward(state, e, target, def.roam.chaseTicksPerTile);
    return;
  }

  if (patrol.alert === 'suspicious') {
    if (mind.lastSeen) e.facing = Math.atan2(mind.lastSeen.y - e.pos.y, mind.lastSeen.x - e.pos.x);
    if (--mind.suspicion <= 0) patrol.alert = 'idle';
    return;
  }

  if (mind.waitTicks > 0) {
    mind.waitTicks--;
    return;
  }
  const waypoint = patrol.route[mind.routeIndex % patrol.route.length];
  if (samePlace(e.pos, waypoint)) {
    mind.routeIndex = (mind.routeIndex + 1) % patrol.route.length;
    const [lo, hi] = TUNING.ai.waypointWait;
    mind.waitTicks = patrol.route.length > 1 ? nextInt(state.rng, lo, hi) : 0;
    return;
  }
  if (!stepToward(state, e, waypoint, def.roam.patrolTicksPerTile)) mind.waitTicks = 15; // blocked; try again shortly
}

/** Start a one-tile step along the shortest path. False if none is free. */
function stepToward(state: GameState, e: Entity, target: Vec, ticks: number): boolean {
  const { floor } = state;
  const here = tileOf(e);
  if (here.x === target.x && here.y === target.y) return false;
  const dist = bfsDistances(floor, target);
  const d0 = dist[here.y * floor.width + here.x];
  const blocked = occupiedBy(state, e);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = here.x + dx;
    const ny = here.y + dy;
    if (!isWalkable(floor, nx, ny) || blocked.has(`${nx},${ny}`)) continue;
    const d = dist[ny * floor.width + nx];
    if (d >= 0 && (d0 < 0 || d < d0)) {
      startMotion(e, { x: nx, y: ny }, ticks);
      return true;
    }
  }
  return false;
}

/** Tiles other enemies stand on or are moving into. */
function occupiedBy(state: GameState, self: Entity): Set<string> {
  const s = new Set<string>();
  for (const o of state.floor.entities) {
    if (o === self) continue;
    const t = tileOf(o);
    s.add(`${t.x},${t.y}`);
    s.add(`${Math.round(o.pos.x)},${Math.round(o.pos.y)}`);
  }
  return s;
}

function samePlace(a: Vec, b: Vec): boolean {
  return Math.round(a.x) === b.x && Math.round(a.y) === b.y;
}

function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
}
