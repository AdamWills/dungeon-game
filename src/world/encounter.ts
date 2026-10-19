// Detects contact between the player and an enemy and builds the Encounter:
// who joins, and who gets the first strike. An unaware or sleeping enemy
// gives the player an ambush; a chasing enemy that runs into the player from
// behind ambushes them; anything else, face to face, is a normal fight.

import { TUNING } from '../data/tuning';
import type { Encounter, Entity, GameState } from '../game/types';
import { distance } from './motion';

export function findContact(state: GameState): Entity | null {
  if (state.grace > 0 || state.dash.active > 0) return null;
  // Touching anyone in the party starts the fight (user decision).
  const party = [state.player.pos, ...state.party.map((a) => a.pos)];
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of state.floor.entities) {
    if (e.kind !== 'enemy') continue;
    const d = Math.min(...party.map((p) => Math.max(Math.abs(e.pos.x - p.x), Math.abs(e.pos.y - p.y))));
    if (d < TUNING.contactRadius && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

export function buildEncounter(state: GameState, enemy: Entity): Encounter {
  const player = state.player;
  let start: Encounter['start'];
  if (enemy.mind!.asleep || enemy.patrol!.alert !== 'chasing') start = 'player_ambush';
  else if (approaching(enemy, player) && !approaching(player, enemy) && fromBehind(player, enemy)) start = 'enemy_ambush';
  else start = 'normal';

  const others = state.floor.entities
    .filter((e) => e !== enemy && e.kind === 'enemy' && distance(e.pos, player.pos) <= TUNING.joinRadius)
    .sort((a, b) => distance(a.pos, player.pos) - distance(b.pos, player.pos) || a.id.localeCompare(b.id))
    .slice(0, TUNING.maxEnemiesPerBattle - 1);

  const at = player.motion ? player.motion.from : player.pos;
  return {
    enemyIds: [enemy.id, ...others.map((e) => e.id)],
    start,
    tile: { x: Math.round(at.x), y: Math.round(at.y) },
  };
}

/**
 * True if the enemy reached you from the side you are not facing. Something
 * walking into your face is a normal fight, not an ambush (user feedback).
 */
function fromBehind(player: Entity, enemy: Entity): boolean {
  const dx = enemy.pos.x - player.pos.x;
  const dy = enemy.pos.y - player.pos.y;
  return Math.cos(player.facing) * dx + Math.sin(player.facing) * dy < 0;
}

/** True if `a` is mid-step and that step brings it closer to `b`. */
function approaching(a: Entity, b: Entity): boolean {
  if (!a.motion) return false;
  return distance(a.motion.to, b.pos) < distance(a.motion.from, b.pos);
}
