// Turn-based battles: Speed order, the player's menu command, enemy moves,
// and writing the outcome back to the map. Deterministic: every roll comes
// from state.rng, every text variant from a stable hash.

import { ABILITIES } from '../data/abilities';
import { BATTLE_TEXT as T, fill, variant } from '../data/battleText';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { TUNING } from '../data/tuning';
import { baseDamage, fleeChance, modifyDamage, rollHit, weightedPick } from '../game/combat';
import { nextFloat } from '../game/rng';
import type { BattleCommand, BattleState, Combatant, Encounter, GameState, LogLine, Vec } from '../game/types';

const PLAYER_ID = 'player';

export function startBattle(state: GameState, encounter: Encounter): void {
  const { player, floor } = state;
  snapToTile(player);
  const combatants: Combatant[] = [
    { id: PLAYER_ID, side: 'player', defId: player.defId, name: 'You', stats: { ...player.stats }, defending: false, alive: true },
  ];
  for (const id of encounter.enemyIds) {
    const e = floor.entities.find((x) => x.id === id)!;
    snapToTile(e);
    combatants.push({ id, side: 'enemy', defId: e.defId, name: ENEMIES[e.defId].name, stats: { ...e.stats }, defending: false, alive: true });
  }
  const battle: BattleState = {
    encounter,
    round: 0,
    order: [],
    turn: 0,
    combatants,
    ambushSide: encounter.start === 'player_ambush' ? 'player' : encounter.start === 'enemy_ambush' ? 'enemy' : null,
    log: [],
    fx: [],
    fxSeq: 0,
    result: null,
  };
  state.battle = battle;
  const from = state.mode;
  state.mode = 'battle';
  state.events.push({ type: 'modeChanged', from, to: 'battle' });
  state.events.push({ type: 'battleStarted', enemyIds: [...encounter.enemyIds], start: encounter.start });

  const salt = state.tick;
  say(battle, variant(T.open[encounter.start], salt), 'host');
  combatants.slice(2).forEach((c, i) => say(battle, fill(variant(T.joined, salt, i), { name: c.name }), 'info'));

  beginRound(battle);
  runEnemies(state);
}

/** The combatant whose turn it is, or null once the battle is decided. */
export function currentActor(battle: BattleState): Combatant | null {
  if (battle.result) return null;
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]) ?? null;
}

export function enemiesOf(battle: BattleState): Combatant[] {
  return battle.combatants.filter((c) => c.side === 'enemy');
}

export function battleCommand(state: GameState, cmd: BattleCommand): void {
  const battle = state.battle;
  if (!battle) return;
  if (battle.result) {
    if (cmd.kind === 'continue') endBattle(state);
    return;
  }
  const actor = currentActor(battle);
  if (!actor || actor.side !== 'player') return;
  if (!playerAct(state, battle, actor, cmd)) return; // invalid choice: still your turn
  if (!checkOver(state, battle)) {
    advance(battle);
    runEnemies(state);
  }
}

// --- rounds and turns -------------------------------------------------------

function beginRound(battle: BattleState): void {
  battle.round++;
  const alive = battle.combatants.filter((c) => c.alive);
  const bySpeed = (a: Combatant, b: Combatant) =>
    b.stats.speed - a.stats.speed || (a.side === 'player' ? -1 : b.side === 'player' ? 1 : a.id.localeCompare(b.id));
  alive.sort(bySpeed);
  if (battle.round === 1 && battle.ambushSide) {
    // The ambushing side takes the whole opening round first.
    const first = alive.filter((c) => c.side === battle.ambushSide);
    const rest = alive.filter((c) => c.side !== battle.ambushSide);
    battle.order = [...first, ...rest].map((c) => c.id);
  } else battle.order = alive.map((c) => c.id);
  battle.turn = 0;
}

function advance(battle: BattleState): void {
  for (;;) {
    battle.turn++;
    if (battle.turn >= battle.order.length) beginRound(battle);
    const c = currentActor(battle);
    if (c?.alive) return;
  }
}

/** Resolve enemy turns until it is the player's turn or the battle ends. */
function runEnemies(state: GameState): void {
  const battle = state.battle!;
  for (let guard = 0; guard < 100; guard++) {
    if (battle.result) return;
    const actor = currentActor(battle)!;
    if (actor.side === 'player') {
      startPlayerTurn(state, actor);
      return;
    }
    enemyAct(state, battle, actor);
    if (checkOver(state, battle)) return;
    advance(battle);
  }
}

function startPlayerTurn(state: GameState, me: Combatant): void {
  me.defending = false;
  const cds = state.player.cooldowns;
  for (const k of Object.keys(cds)) cds[k] = Math.max(0, cds[k] - 1);
}

function ambushActive(battle: BattleState, side: 'player' | 'enemy'): boolean {
  return battle.round === 1 && battle.ambushSide === side;
}

// --- actions ----------------------------------------------------------------

/** Returns false if the command was refused and the turn is not spent. */
function playerAct(state: GameState, battle: BattleState, me: Combatant, cmd: BattleCommand): boolean {
  const cls = CLASSES[state.player.defId];
  const salt = [battle.round, battle.turn, battle.log.length];
  switch (cmd.kind) {
    case 'attack': {
      const target = battle.combatants.find((c) => c.id === cmd.targetId && c.side === 'enemy' && c.alive);
      if (!target) return false;
      playerStrike(state, battle, me, target, cls.weapon, salt);
      return true;
    }
    case 'ability': {
      const ability = ABILITIES[cmd.abilityId];
      if (!ability || cls.ability !== ability.id) return false;
      const cd = state.player.cooldowns[ability.id] ?? 0;
      if (cd > 0) {
        say(battle, fill(T.cooldown, { ability: ability.name, turns: cd }), 'host');
        return false;
      }
      say(battle, ability.useLine, 'good');
      for (const target of enemiesOf(battle).filter((c) => c.alive)) playerStrike(state, battle, me, target, cls.weapon, [...salt, target.id.length]);
      // +1 because the countdown ticks at the start of each of your turns.
      state.player.cooldowns[ability.id] = ability.cooldown + 1;
      return true;
    }
    case 'item': {
      const inst = state.player.inventory[cmd.slot];
      const def = inst && ITEMS[inst.defId];
      if (!def) {
        say(battle, T.noItems, 'host');
        return false;
      }
      for (const eff of def.effects) {
        if (eff.kind === 'heal') {
          const before = me.stats.hp;
          me.stats.hp = Math.min(me.stats.maxHp, me.stats.hp + eff.amount);
          const healed = me.stats.hp - before;
          say(battle, fill(def.useLine ?? 'You use the {item}.', { amount: healed, item: def.name }), 'good');
          fx(battle, me.id, 'heal', healed);
        }
      }
      if (def.consumable) state.player.inventory.splice(cmd.slot, 1);
      return true;
    }
    case 'defend':
      me.defending = true;
      say(battle, variant(T.defend, ...salt), 'info');
      fx(battle, me.id, 'defend');
      return true;
    case 'flee': {
      const foes = enemiesOf(battle).filter((c) => c.alive);
      if (nextFloat(state.rng) < fleeChance(me.stats.speed, foes.map((c) => c.stats.speed))) {
        say(battle, variant(T.fleeOk, ...salt), 'info');
        battle.result = 'fled';
      } else say(battle, variant(T.fleeFail, ...salt), 'bad');
      return true;
    }
    case 'continue':
      return false;
  }
}

function playerStrike(state: GameState, battle: BattleState, me: Combatant, target: Combatant, weapon: { name: string; damage: number }, salt: number[]) {
  if (!rollHit(state.rng, target.stats.evasion)) {
    say(battle, fill(variant(T.playerMiss, ...salt), { target: target.name }), 'info');
    fx(battle, target.id, 'miss');
    return;
  }
  const ambush = ambushActive(battle, 'player');
  const dmg = modifyDamage(baseDamage(weapon.damage, me.stats.str, target.stats.armor), { ambush, defending: target.defending });
  target.stats.hp = Math.max(0, target.stats.hp - dmg);
  say(battle, fill(variant(T.playerHit, ...salt), { target: target.name, weapon: weapon.name, dmg }) + (ambush ? T.bonus : ''), 'good');
  fx(battle, target.id, 'hit', dmg);
  if (target.stats.hp === 0) kill(state, battle, target, me);
}

function enemyAct(state: GameState, battle: BattleState, actor: Combatant): void {
  const def = ENEMIES[actor.defId];
  const me = battle.combatants.find((c) => c.side === 'player')!;
  const move = weightedPick(state.rng, def.moves);
  const salt = [battle.round, battle.turn, battle.log.length];
  if (!rollHit(state.rng, me.stats.evasion)) {
    say(battle, fill(variant(T.enemyMiss, ...salt), { actor: actor.name, move: move.name }), 'info');
    fx(battle, me.id, 'miss');
    return;
  }
  const ambush = ambushActive(battle, 'enemy');
  const dmg = modifyDamage(baseDamage(def.weapon + move.bonus, actor.stats.str, me.stats.armor), { ambush, defending: me.defending });
  me.stats.hp = Math.max(0, me.stats.hp - dmg);
  const line = fill(variant(move.hit, ...salt), { actor: actor.name, dmg });
  say(battle, line + (ambush ? T.bonus : '') + (me.defending ? T.braced : ''), 'bad');
  fx(battle, me.id, 'hit', dmg);
  if (me.stats.hp === 0) {
    battle.killedBy = { enemy: actor.name, move: move.name };
    kill(state, battle, me, actor);
  }
}

function kill(state: GameState, battle: BattleState, target: Combatant, killer: Combatant): void {
  target.alive = false;
  fx(battle, target.id, 'death');
  state.events.push({ type: 'entityDied', id: target.id, defId: target.defId, killerId: killer.id });
  if (target.side === 'enemy') say(battle, fill(variant(T.kill, battle.round, battle.log.length), { target: target.name }), 'good');
}

/** Sets the result if one side is wiped out. */
function checkOver(state: GameState, battle: BattleState): boolean {
  if (battle.result) return true;
  const me = battle.combatants.find((c) => c.side === 'player')!;
  if (!me.alive) {
    battle.result = 'lost';
    say(battle, variant(T.defeat, state.tick), 'host');
  } else if (enemiesOf(battle).every((c) => !c.alive)) {
    battle.result = 'won';
    say(battle, variant(T.victory, state.tick, battle.round), 'host');
  }
  return battle.result !== null;
}

// --- leaving the battle -----------------------------------------------------

function endBattle(state: GameState): void {
  const battle = state.battle!;
  const { floor, player } = state;
  const me = battle.combatants.find((c) => c.side === 'player')!;
  player.stats.hp = me.stats.hp;

  for (const c of enemiesOf(battle)) {
    const idx = floor.entities.findIndex((e) => e.id === c.id);
    if (idx < 0) continue;
    const e = floor.entities[idx];
    if (!c.alive) {
      addGore(state, e.pos, 'gibs');
      floor.entities.splice(idx, 1);
    } else {
      e.stats.hp = c.stats.hp;
      if (battle.result === 'fled' && e.patrol && e.mind) {
        e.patrol.alert = 'chasing';
        e.mind.asleep = false;
        e.mind.lastSeen = { ...player.pos };
        e.mind.lostSight = 0;
        e.mind.stunned = TUNING.fleeStunTicks;
      }
    }
  }
  if (battle.combatants.some((c) => c.side === 'enemy' && !c.alive)) addGore(state, battle.encounter.tile, 'blood');

  const result = battle.result!;
  state.battle = null;
  state.events.push({ type: 'battleEnded', result });
  if (result === 'lost') {
    state.runEnd = { kind: 'died', enemy: battle.killedBy?.enemy ?? 'something', move: battle.killedBy?.move ?? 'unknown causes' };
    setMode(state, 'dead');
    state.events.push({ type: 'runEnded', end: state.runEnd });
    return;
  }
  if (result === 'fled') state.grace = TUNING.fleeGraceTicks;
  setMode(state, 'roaming');
}

function addGore(state: GameState, at: Vec, kind: 'blood' | 'gibs'): void {
  const tile = state.floor.tiles[Math.round(at.y)]?.[Math.round(at.x)];
  if (tile && tile.terrain !== 'wall' && tile.gore.length < 3) tile.gore.push({ kind });
}

function setMode(state: GameState, to: GameState['mode']): void {
  const from = state.mode;
  state.mode = to;
  state.events.push({ type: 'modeChanged', from, to });
}

function snapToTile(e: { pos: Vec; motion?: { from: Vec } }): void {
  if (e.motion) {
    e.pos = { ...e.motion.from };
    e.motion = undefined;
  }
}

function say(battle: BattleState, text: string, tone: LogLine['tone']): void {
  battle.log.push({ text, tone });
}

function fx(battle: BattleState, targetId: string, kind: BattleState['fx'][number]['kind'], amount?: number): void {
  battle.fx.push({ seq: ++battle.fxSeq, targetId, kind, amount });
  if (battle.fx.length > 20) battle.fx.shift();
}
