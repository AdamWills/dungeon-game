// Hazard damage in real time. Anything standing on a hazard tile takes its
// damage on a timer; residents can die to it, and the player can too.

import { HAZARDS } from '../data/hazards';
import { addGore } from '../battle/turns';
import type { Entity, GameState } from '../game/types';

/** Gas vents puff on and off; each vent's timing is offset by its position. */
export function hazardActive(kind: keyof typeof HAZARDS, x: number, y: number, tick: number): boolean {
  const cycle = HAZARDS[kind].cycle;
  if (!cycle) return true;
  const period = cycle.on + cycle.off;
  return (tick + x * 37 + y * 53) % period < cycle.on;
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
  if (entering) e.onHazard = { key, ticks: 0 };
  else e.onHazard!.ticks++;
  const due = (entering && def.onEnter) || (!entering && e.onHazard!.ticks % def.everyTicks === 0);
  if (!due || !hazardActive(tile.hazard, x, y, state.tick)) return;

  e.stats.hp = Math.max(0, e.stats.hp - def.damage);
  state.events.push({ type: 'hazardHurt', id: e.id, kind: tile.hazard, dmg: def.damage });
  if (e.stats.hp > 0) return;

  state.events.push({ type: 'entityDied', id: e.id, defId: e.defId, killerId: `hazard:${tile.hazard}` });
  if (e.kind === 'player') {
    state.runEnd = { kind: 'died', enemy: `the ${def.name}`, move: def.deathMove };
    const from = state.mode;
    state.mode = 'dead';
    state.events.push({ type: 'modeChanged', from, to: 'dead' });
    state.events.push({ type: 'runEnded', end: state.runEnd });
  } else {
    addGore(state, e.pos, 'gibs');
    state.floor.entities.splice(state.floor.entities.indexOf(e), 1);
  }
}
