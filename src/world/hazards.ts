// Hazard damage in real time. Anything standing on a hazard tile takes its
// damage on a timer; residents can die to it, and the player can too.

import { HAZARDS } from '../data/hazards';
import { addGore } from '../battle/turns';
import { eliminate } from '../game/report';
import type { Entity, GameState } from '../game/types';

/** Gas vents puff on and off; each vent's timing is offset by its position. */
export function hazardActive(kind: keyof typeof HAZARDS, x: number, y: number, tick: number): boolean {
  const cycle = HAZARDS[kind].cycle;
  if (!cycle) return true;
  return hazardPhase(kind, x, y, tick) < cycle.on;
}

/** Where a cycling hazard is in its cycle: below `on` it is active. Each tile is offset. */
export function hazardPhase(kind: keyof typeof HAZARDS, x: number, y: number, tick: number): number {
  const cycle = HAZARDS[kind].cycle;
  if (!cycle) return 0;
  return (tick + x * 37 + y * 53) % (cycle.on + cycle.off);
}

export function updateHazards(state: GameState): void {
  hurtIfOnHazard(state, state.player);
  for (const e of [...state.floor.entities]) hurtIfOnHazard(state, e);
}

function hurtIfOnHazard(state: GameState, e: Entity): void {
  const x = Math.round(e.pos.x);
  const y = Math.round(e.pos.y);
  const tile = state.floor.tiles[y]?.[x];
  if (!tile?.hazard) {
    e.onHazard = undefined;
    return;
  }
  const def = HAZARDS[tile.hazard];
  const key = `${x},${y}`;
  const entering = e.onHazard?.key !== key;
  const active = hazardActive(tile.hazard, x, y, state.tick);
  const rising = !entering && active && !e.onHazard!.active;
  if (entering) e.onHazard = { key, ticks: 0, active };
  else {
    e.onHazard!.ticks++;
    e.onHazard!.active = active;
  }
  const due = (entering && def.onEnter) || (rising && !!def.onRise) || (!entering && e.onHazard!.ticks % def.everyTicks === 0);
  if (!due || !active) return;

  e.stats.hp = Math.max(0, e.stats.hp - def.damage);
  state.events.push({ type: 'hazardHurt', id: e.id, kind: tile.hazard, dmg: def.damage });
  if (e.kind === 'player') state.record.lastAction = { kind: 'walk' };
  if (e.stats.hp > 0) return;

  state.events.push({ type: 'entityDied', id: e.id, defId: e.defId, killerId: `hazard:${tile.hazard}` });
  if (e.kind === 'player') {
    eliminate(state, def.name, def.deathMove);
  } else {
    addGore(state, e.pos, 'gibs');
    state.floor.entities.splice(state.floor.entities.indexOf(e), 1);
  }
}
