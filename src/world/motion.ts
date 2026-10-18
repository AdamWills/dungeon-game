// Tile-to-tile motion shared by the player and enemies.

import type { Entity, Vec } from '../game/types';

export const FACING = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 };

export function startMotion(e: Entity, to: Vec, ticks: number): void {
  const from = { x: Math.round(e.pos.x), y: Math.round(e.pos.y) };
  e.facing = Math.atan2(to.y - from.y, to.x - from.x);
  e.motion = { from, to: { ...to }, tick: 0, ticks };
}

/** Advance one tick. Returns true on the tick the entity arrives. */
export function advanceMotion(e: Entity): boolean {
  const m = e.motion;
  if (!m) return false;
  m.tick++;
  if (m.tick >= m.ticks) {
    e.pos = { ...m.to };
    e.motion = undefined;
    return true;
  }
  const t = m.tick / m.ticks;
  e.pos = { x: m.from.x + (m.to.x - m.from.x) * t, y: m.from.y + (m.to.y - m.from.y) * t };
  return false;
}

/** The tile an entity stands on, or is arriving at while moving. */
export function tileOf(e: Entity): Vec {
  return e.motion ? { ...e.motion.to } : { x: Math.round(e.pos.x), y: Math.round(e.pos.y) };
}

export function distance(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
