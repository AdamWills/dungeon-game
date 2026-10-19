// Your party (GDD "Recruitable party"): recruiting captives, hidden loyalty
// and what happens when it runs out, allies following you around the map,
// and the pause-screen orders (give an item, set a stance).

import { ALLIES, type AllyDef, bribePrice, LOYALTY, type Stance } from '../data/allies';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { TUNING } from '../data/tuning';
import { bfsDistances, isWalkable } from '../gen/reach';
import { advanceMotion, startMotion, tileOf } from '../world/motion';
import { gainXp } from './progress';
import { nextInt } from './rng';
import type { Entity, GameState, Stats, Vec } from './types';

/** An ally's stats at the player's level. */
export function allyStats(def: AllyDef, level: number): Stats {
  const s = { ...def.base, maxHp: def.base.hp };
  const up = level - 1;
  for (const [k, v] of Object.entries(def.growth) as [keyof typeof def.growth, number][]) s[k] += v * up;
  s.maxHp = s.hp;
  if (def.passive.id === 'survival_instinct') s.evasion += 3;
  return s;
}

export function makeAlly(defId: string, pos: Vec, level: number, recruited: boolean): Entity {
  const def = ALLIES[defId];
  return {
    id: `ally-${defId}`,
    kind: 'ally',
    defId,
    pos: { ...pos },
    facing: Math.PI / 2,
    stats: allyStats(def, level),
    cooldowns: {},
    inventory: [{ defId: def.item, identified: true }],
    ally: { recruited, loyalty: LOYALTY.start, stance: def.archetype === 'healer' ? 'support' : def.archetype === 'coward' ? 'defensive' : 'aggressive' },
  };
}

/** Rescale allies after a level-up, keeping the damage they have taken. */
export function refreshAllyStats(state: GameState): void {
  for (const a of state.party) {
    const lost = a.stats.maxHp - a.stats.hp;
    a.stats = allyStats(ALLIES[a.defId], state.level);
    a.stats.hp = Math.max(1, a.stats.maxHp - lost);
  }
}

/** The captive (cell or bribe) standing on this tile, if any. */
export function captiveAt(state: GameState, x: number, y: number): Entity | undefined {
  return state.floor.entities.find((e) => e.kind === 'ally' && Math.round(e.pos.x) === x && Math.round(e.pos.y) === y);
}

/** Bribe price for an ally, after the player's Charm. */
export function priceOf(state: GameState, defId: string): number {
  const r = ALLIES[defId].recruit;
  return r.kind === 'bribe' ? bribePrice(r.price, state.player.stats.charm) : 0;
}

/** Try to recruit a captive: open the cell, or pay the bribe. True if they joined. */
export function tryRecruit(state: GameState, captive: Entity): boolean {
  const def = ALLIES[captive.defId];
  if (def.recruit.kind === 'bribe') {
    const price = priceOf(state, def.id);
    if (state.tokens < price) {
      state.events.push({ type: 'bribeShort', allyId: def.id, price, tokens: state.tokens });
      return false;
    }
    state.tokens -= price;
  }
  state.floor.entities.splice(state.floor.entities.indexOf(captive), 1);
  recruit(state, captive);
  return true;
}

/** Add an ally to the party. They join at the player's level with full HP unless told otherwise. */
export function recruit(state: GameState, ally: Entity, hp?: number): void {
  if (state.party.length >= TUNING.party.maxAllies) return;
  ally.stats = allyStats(ALLIES[ally.defId], state.level);
  if (hp !== undefined) ally.stats.hp = Math.max(1, Math.min(ally.stats.maxHp, hp));
  ally.ally!.recruited = true;
  ally.motion = undefined;
  state.party.push(ally);
  state.record.alliesRecruited++;
  state.events.push({ type: 'allyRecruited', allyId: ally.defId });
  gainXp(state, TUNING.progression.recruitXp);
}

export function changeLoyalty(state: GameState, ally: Entity, delta: number): void {
  const mind = ally.ally;
  if (!mind) return;
  mind.loyalty = Math.max(0, Math.min(LOYALTY.max, mind.loyalty + delta));
  if (mind.loyalty < LOYALTY.low && !mind.warned && mind.loyalty > 0) {
    mind.warned = true;
    state.events.push({ type: 'loyaltyLow', allyId: ally.defId });
  }
  if (mind.loyalty >= LOYALTY.low) mind.warned = false;
}

/** Allies whose loyalty has run out leave, each in their own way. */
export function settleLoyalty(state: GameState): void {
  for (const ally of [...state.party]) {
    if (ally.ally!.loyalty > 0) continue;
    const def = ALLIES[ally.defId];
    state.party.splice(state.party.indexOf(ally), 1);
    let item: string | null = null;
    if (def.betrayal.kind === 'steal' && state.player.inventory.length) {
      const i = nextInt(state.rng, 0, state.player.inventory.length - 1);
      item = state.player.inventory.splice(i, 1)[0].defId;
    }
    if (def.betrayal.kind === 'turn') state.floor.entities.push(turncoat(state, ally, def.betrayal.enemyId));
    state.events.push({ type: 'allyLeft', allyId: def.id, how: def.betrayal.kind, item });
  }
}

/** An ex-ally on the warpath: an enemy that already knows where you are. */
function turncoat(state: GameState, ally: Entity, enemyId: string): Entity {
  const def = ENEMIES[enemyId];
  const at = tileOf(ally);
  return {
    id: `turncoat-${ally.defId}`,
    kind: 'enemy',
    defId: enemyId,
    pos: at,
    facing: ally.facing,
    stats: { ...def.stats, maxHp: def.stats.hp },
    cooldowns: {},
    inventory: [],
    patrol: {
      route: [at],
      visionRange: def.roam.visionRange,
      visionArc: (def.roam.visionArcDeg * Math.PI) / 180,
      hearingRadius: def.roam.hearingRadius,
      alert: 'chasing',
    },
    mind: { routeIndex: 0, waitTicks: 0, asleep: false, lostSight: 0, suspicion: 0, turnDelay: 0, lastSeen: tileOf(state.player), alertedAt: state.tick, stunned: TUNING.fleeStunTicks },
  };
}

/** Remember the tile the player just left: the party walks along this trail. */
export function leaveTrail(state: GameState, from: Vec): void {
  state.trail.unshift({ x: Math.round(from.x), y: Math.round(from.y) });
  if (state.trail.length > TUNING.party.maxAllies + 1) state.trail.length = TUNING.party.maxAllies + 1;
}

/** Each roaming tick: allies walk in a line behind you, catching up at a run if left behind. */
export function updateParty(state: GameState, ticksPerTile: number): void {
  state.party.forEach((ally, i) => {
    if (ally.motion && !advanceMotion(ally)) return;
    const here = tileOf(ally);
    const goal = state.trail[i] ?? tileOf(state.player);
    if (here.x === goal.x && here.y === goal.y) return;
    const far = Math.abs(here.x - goal.x) + Math.abs(here.y - goal.y) > TUNING.party.catchUpDistance;
    const ticks = far ? TUNING.party.catchUpTicksPerTile : ticksPerTile;
    const next = nextStep(state, here, goal);
    if (!next) {
      ally.pos = { ...goal }; // boxed in somehow: catch up off-camera
      return;
    }
    ally.facing = Math.atan2(next.y - here.y, next.x - here.x);
    startMotion(ally, next, ticks);
  });
}

function nextStep(state: GameState, from: Vec, to: Vec): Vec | null {
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) === 1 && isWalkable(state.floor, to.x, to.y)) return to;
  const dist = bfsDistances(state.floor, to);
  const w = state.floor.width;
  const d0 = dist[from.y * w + from.x];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = from.x + dx;
    const y = from.y + dy;
    const d = dist[y * w + x];
    if (isWalkable(state.floor, x, y) && d >= 0 && (d0 < 0 || d < d0)) return { x, y };
  }
  return null;
}

/** Put the party on the player's tile (new floor, or after something odd). */
export function gatherParty(state: GameState): void {
  state.trail = [];
  for (const a of state.party) {
    a.pos = { ...tileOf(state.player) };
    a.motion = undefined;
  }
}

/** Pause-screen orders: give an ally a consumable, or change its stance. */
export function giveItem(state: GameState, slot: number, allyId: string): void {
  const ally = state.party.find((a) => a.id === allyId);
  const inst = state.player.inventory[slot];
  const def = inst && ITEMS[inst.defId];
  if (!ally || !def?.use?.consumable) return;
  state.player.inventory.splice(slot, 1);
  for (const eff of def.use.effects) if (eff.kind === 'heal') ally.stats.hp = Math.min(ally.stats.maxHp, ally.stats.hp + eff.amount);
  changeLoyalty(state, ally, LOYALTY.give);
  state.events.push({ type: 'itemUsed', defId: def.id });
}

export function setStance(state: GameState, allyId: string, stance: Stance): void {
  const ally = state.party.find((a) => a.id === allyId);
  if (ally?.ally) ally.ally.stance = stance;
}

/** Captives Chet has not introduced yet, now in view. */
export function spotCaptives(state: GameState): void {
  const f = state.floor;
  for (const e of f.entities) {
    if (e.kind !== 'ally' || e.ally?.spotted) continue;
    if (f.visible[Math.round(e.pos.y) * f.width + Math.round(e.pos.x)] !== 1) continue;
    e.ally!.spotted = true;
    state.events.push({ type: 'captiveSpotted', allyId: e.defId });
  }
}
