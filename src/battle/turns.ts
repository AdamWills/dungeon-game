// Turn-based battles: Speed order, the player's menu command, enemy moves,
// status effects, and writing the outcome back to the map. Deterministic:
// every roll comes from state.rng, every text variant from a stable hash.

import { ABILITIES, HEX_TURNS } from '../data/abilities';
import { PROPS } from '../data/props';
import { BATTLE_TEXT as T, fill, variant } from '../data/battleText';
import { CLASSES } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { FLOOR_THEMES } from '../data/floors';
import { type EffectRef, ITEMS } from '../data/items';
import { STATUSES, type StatusKind } from '../data/statuses';
import { TUNING } from '../data/tuning';
import { baseDamage, fleeChance, modifyDamage, rollHit, weightedPick } from '../game/combat';
import { playerResists, weaponOf } from '../game/equipment';
import { rollItem } from '../game/loot';
import { nextFloat } from '../game/rng';
import { applyOutcome, applyRepeats, gatherArena, resolveImprov, validateOutcome } from './improvise';
import type { BattleCommand, BattleState, Combatant, Encounter, GameState, LogLine, Vec } from '../game/types';

const PLAYER_ID = 'player';

export function startBattle(state: GameState, encounter: Encounter): void {
  const { player, floor } = state;
  snapToTile(player);
  const combatants: Combatant[] = [
    { id: PLAYER_ID, side: 'player', defId: player.defId, name: 'You', stats: { ...player.stats }, defending: false, alive: true, statuses: [] },
  ];
  for (const id of encounter.enemyIds) {
    const e = floor.entities.find((x) => x.id === id)!;
    snapToTile(e);
    combatants.push({ id, side: 'enemy', defId: e.defId, name: ENEMIES[e.defId].name, stats: { ...e.stats }, defending: false, alive: true, statuses: [] });
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
    props: gatherArena(state, encounter.tile),
    badIdeaUsed: false,
    playerHasActed: false,
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
  runTurns(state);
}

/** The combatant whose turn it is, or null once the battle is decided. */
export function currentActor(battle: BattleState): Combatant | null {
  if (battle.result) return null;
  return battle.combatants.find((c) => c.id === battle.order[battle.turn]) ?? null;
}

export function enemiesOf(battle: BattleState): Combatant[] {
  return battle.combatants.filter((c) => c.side === 'enemy');
}

export function hasStatus(c: Combatant, kind: StatusKind): boolean {
  return c.statuses.some((s) => s.kind === kind);
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
  if (!playerAct(state, battle, actor, cmd)) return; // refused: still your turn
  battle.playerHasActed = true;
  if (!checkOver(state, battle)) {
    advance(battle);
    runTurns(state);
  }
}

// --- rounds and turns -------------------------------------------------------

function beginRound(battle: BattleState): void {
  battle.round++;
  const alive = battle.combatants.filter((c) => c.alive);
  const bySpeed = (a: Combatant, b: Combatant) =>
    b.stats.speed - a.stats.speed || (a.side === 'player' ? -1 : b.side === 'player' ? 1 : a.id.localeCompare(b.id));
  alive.sort(bySpeed);
  let order: Combatant[];
  if (battle.round === 1 && battle.ambushSide === 'player') {
    // Sneaking up on them: you take the whole opening round first.
    order = [...alive.filter((c) => c.side === 'player'), ...alive.filter((c) => c.side !== 'player')];
  } else if (battle.round === 1 && battle.ambushSide === 'enemy') {
    // Caught: the one that caught you strikes first; everyone else goes by Speed.
    const ambusher = alive.find((c) => c.id === battle.encounter.enemyIds[0]);
    order = ambusher ? [ambusher, ...alive.filter((c) => c !== ambusher)] : alive;
  } else order = alive;
  const ids = order.map((c) => c.id);
  // Hasted combatants get a second turn at the end of the round.
  for (const c of order) if (hasStatus(c, 'hasted')) ids.push(c.id);
  battle.order = ids;
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

/**
 * Resolve turns until the player has a choice to make or the battle ends.
 * Each turn starts with its holder's statuses ticking.
 */
function runTurns(state: GameState): void {
  const battle = state.battle!;
  for (let guard = 0; guard < 200; guard++) {
    if (battle.result) return;
    const actor = currentActor(battle)!;
    const canAct = startTurn(state, battle, actor);
    if (checkOver(state, battle)) return;
    if (canAct) {
      if (actor.side === 'player') return; // wait for the menu
      enemyAct(state, battle, actor);
      if (checkOver(state, battle)) return;
    }
    advance(battle);
  }
}

/** Tick statuses at the start of a turn. Returns false if the turn is lost. */
function startTurn(state: GameState, battle: BattleState, c: Combatant): boolean {
  const isYou = c.side === 'player';
  if (isYou) {
    c.defending = false;
    const cds = state.player.cooldowns;
    for (const k of Object.keys(cds)) cds[k] = Math.max(0, cds[k] - 1);
  }
  let skip = false;
  for (const s of [...c.statuses]) {
    const def = STATUSES[s.kind];
    if (def.dot && c.alive) {
      // Damage over time also respects the first-turn guarantee.
      const dmg = isYou && !battle.playerHasActed ? Math.min(def.dot, c.stats.hp - 1) : def.dot;
      c.stats.hp = Math.max(0, c.stats.hp - dmg);
      say(battle, fill((isYou ? def.youLine : def.tickLine) ?? '', { name: c.name, dmg }), isYou ? 'bad' : 'good');
      fx(battle, c.id, 'hit', dmg);
      if (c.stats.hp === 0) {
        if (isYou) battle.killedBy = { enemy: def.name.toLowerCase(), move: 'a lingering condition' };
        kill(state, battle, c, c);
        return false;
      }
    }
    if (s.kind === 'stunned' || (s.kind === 'charmed' && !isYou)) {
      skip = true;
      say(battle, fill((isYou ? def.youLine : def.tickLine) ?? '', { name: c.name }), 'info');
    }
    s.turnsLeft--;
    if (s.turnsLeft <= 0) {
      c.statuses.splice(c.statuses.indexOf(s), 1);
      say(battle, fill(T.statusOff, { target: c.name, status: def.name.toLowerCase() }), 'info');
      if (s.then) applyStatus(state, battle, c, s.then.status, s.then.turns);
    }
  }
  if (!skip && isYou && hasStatus(c, 'hasted') && battle.order.indexOf(c.id) !== battle.turn) say(battle, T.hasteExtra, 'host');
  return !skip;
}

/** The ambush bonus: all of your attacks in a sneak attack, or the catcher's first blow. */
function ambushActive(battle: BattleState, side: 'player' | 'enemy', actorId?: string): boolean {
  if (battle.round !== 1 || battle.ambushSide !== side) return false;
  return side === 'player' || actorId === battle.encounter.enemyIds[0];
}

// --- actions ----------------------------------------------------------------

/** Returns false if the command was refused and the turn is not spent. */
function playerAct(state: GameState, battle: BattleState, me: Combatant, cmd: BattleCommand): boolean {
  const cls = CLASSES[state.cls];
  const salt = [battle.round, battle.turn, battle.log.length];
  const aliveEnemy = (id?: string) => battle.combatants.find((c) => c.id === id && c.side === 'enemy' && c.alive);
  switch (cmd.kind) {
    case 'attack': {
      const target = aliveEnemy(cmd.targetId);
      if (!target) return false;
      playerStrike(state, battle, me, target, salt);
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
      if (ability.target === 'one_enemy') {
        const target = aliveEnemy(cmd.targetId);
        if (!target) return false;
        say(battle, fill(ability.useLine, { target: target.name }), 'good');
        if (ability.id === 'hex') applyStatus(state, battle, target, 'hexed', HEX_TURNS);
      } else {
        say(battle, ability.useLine, 'good');
        for (const target of enemiesOf(battle).filter((c) => c.alive)) playerStrike(state, battle, me, target, [...salt, target.id.length]);
      }
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
      if (!def.use) {
        say(battle, T.cantUseHere, 'host');
        return false;
      }
      let targets: Combatant[];
      if (def.use.target === 'self') targets = [me];
      else if (def.use.target === 'all_enemies') targets = enemiesOf(battle).filter((c) => c.alive);
      else {
        const t = aliveEnemy(cmd.targetId);
        if (!t) return false;
        targets = [t];
      }
      const amount = def.use.effects.find((e) => e.kind === 'heal' || e.kind === 'damage');
      const healed = amount?.kind === 'heal' ? Math.min(amount.amount, me.stats.maxHp - me.stats.hp) : (amount?.amount ?? 0);
      say(battle, fill(def.useLine ?? 'You use the {item}.', { item: def.name, target: targets[0]?.name ?? '', amount: healed }), 'good');
      for (const t of targets) applyEffects(state, battle, me, t, def.use.effects);
      if (def.use.consumable) state.player.inventory.splice(cmd.slot, 1);
      state.events.push({ type: 'itemUsed', defId: def.id });
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
    case 'improvise':
      return improvise(state, battle, me, cmd);
    case 'continue':
      return false;
  }
}

/** Props, item jank or the Bad Idea button. Returns false if it was not possible. */
function improvise(state: GameState, battle: BattleState, me: Combatant, cmd: Extract<BattleCommand, { kind: 'improvise' }>): boolean {
  const res = resolveImprov(state, battle, cmd);
  if (!res) {
    say(battle, cmd.channel === 'badIdea' ? T.badIdeaSpent : T.cantImprov, 'host');
    return false;
  }
  const { names, ...raw } = res;
  const times = state.improvCounts[raw.discoveryKey] ?? 0;
  const outcome = applyRepeats(validateOutcome(raw), times);
  state.improvCounts[raw.discoveryKey] = times + 1;

  // Pay for it: the prop takes wear, the items are used up, the button is spent.
  let wrecked: string | null = null;
  if (cmd.channel === 'prop') {
    const prop = battle.props.find((p) => p.id === cmd.propId)!;
    if (--prop.usesLeft <= 0) wrecked = PROPS[prop.defId].name;
  } else if (cmd.channel === 'jank') {
    for (const slot of [...cmd.slots].sort((a, b) => b - a)) state.player.inventory.splice(slot, 1);
  } else battle.badIdeaUsed = true;

  const idx = battle.log.length;
  say(battle, '', outcome.grade === 'disaster' ? 'bad' : outcome.grade === 'meh' ? 'info' : 'good');
  battle.log[idx].text = applyOutcome(state, battle, outcome, names, {
    say: (text, tone) => say(battle, text, tone),
    apply: (target, { target: _t, ...effect }) => applyEffects(state, battle, me, target, [effect]),
    selfHarm: (amount) => {
      const dmg = Math.max(0, Math.min(amount, me.stats.hp - 1));
      me.stats.hp -= dmg;
      if (dmg) fx(battle, me.id, 'hit', dmg);
      return dmg;
    },
  });
  if (wrecked) say(battle, fill(T.propWrecked, { prop: wrecked }), 'info');
  state.events.push({ type: 'improvised', key: outcome.discoveryKey, grade: outcome.grade, firstThisRun: times === 0 });
  return true;
}

/** Item and improvisation effects, applied to one target. */
export function applyEffects(state: GameState, battle: BattleState, user: Combatant, target: Combatant, effects: EffectRef[]): void {
  for (const eff of effects) {
    if (!target.alive) return;
    switch (eff.kind) {
      case 'heal': {
        const before = target.stats.hp;
        target.stats.hp = Math.min(target.stats.maxHp, target.stats.hp + eff.amount);
        if (target.stats.hp > before) fx(battle, target.id, 'heal', target.stats.hp - before);
        break;
      }
      case 'damage': {
        const raw = eff.pierce ? eff.amount : Math.max(1, eff.amount - target.stats.armor);
        hurt(state, battle, target, user, raw);
        break;
      }
      case 'status':
        applyStatus(state, battle, target, eff.status, eff.turns, eff.then);
        break;
      case 'cleanse':
        target.statuses = [];
        break;
    }
  }
}

/** Add a status, stacking by duration. Respects the player's resistances. */
export function applyStatus(
  state: GameState,
  battle: BattleState,
  target: Combatant,
  kind: StatusKind,
  turns: number,
  then?: { status: StatusKind; turns: number },
): boolean {
  const name = STATUSES[kind].name.toLowerCase();
  if (target.side === 'player' && playerResists(state).includes(kind)) {
    say(battle, fill(T.resisted, { target: target.name, status: name }), 'good');
    return false;
  }
  const existing = target.statuses.find((s) => s.kind === kind);
  if (existing) existing.turnsLeft += turns;
  else target.statuses.push({ kind, turnsLeft: turns, then });
  say(battle, fill(target.side === 'player' ? T.statusOnYou : T.statusOn, { target: target.name, status: name }), target.side === 'player' ? 'bad' : 'good');
  fx(battle, target.id, 'status');
  return true;
}

/** Final damage after Hex and bracing; kills if HP hits 0. */
function hurt(state: GameState, battle: BattleState, target: Combatant, source: Combatant, raw: number): number {
  let dmg = raw;
  if (hasStatus(target, 'hexed')) dmg *= 2;
  if (target.defending) dmg = Math.ceil(dmg * TUNING.combat.defendMultiplier);
  dmg = Math.max(1, dmg);
  // No dying before your first turn, however bad the ambush.
  if (target.side === 'player' && !battle.playerHasActed) dmg = Math.min(dmg, target.stats.hp - 1);
  target.stats.hp = Math.max(0, target.stats.hp - dmg);
  fx(battle, target.id, 'hit', dmg);
  if (target.stats.hp === 0) kill(state, battle, target, source);
  return dmg;
}

function playerStrike(state: GameState, battle: BattleState, me: Combatant, target: Combatant, salt: (number | string)[]) {
  const weapon = weaponOf(state.player);
  const s = salt.map((x) => (typeof x === 'number' ? x : x.length));
  if (!rollHit(state.rng, target.stats.evasion)) {
    say(battle, fill(variant(T.playerMiss, ...s), { target: target.name }), 'info');
    fx(battle, target.id, 'miss');
    return;
  }
  const ambush = ambushActive(battle, 'player');
  const raw = modifyDamage(baseDamage(weapon.damage, me.stats.str, target.stats.armor), { ambush, defending: false });
  const hexed = hasStatus(target, 'hexed');
  const line = fill(variant(T.playerHit, ...s), { target: target.name, weapon: weapon.name, dmg: '{dmg}' });
  const idx = battle.log.length;
  say(battle, line, 'good');
  const dmg = hurt(state, battle, target, me, raw);
  battle.log[idx].text = line.replace('{dmg}', String(dmg)) + (ambush ? T.bonus : '') + (hexed ? ' (Hexed: double damage.)' : '');
  if (target.alive && weapon.onHit && nextFloat(state.rng) < weapon.onHit.chance)
    applyStatus(state, battle, target, weapon.onHit.status, weapon.onHit.turns);
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
  const ambush = ambushActive(battle, 'enemy', actor.id);
  const raw = modifyDamage(baseDamage(def.weapon + move.bonus, actor.stats.str, me.stats.armor), { ambush, defending: false });
  const braced = me.defending;
  const idx = battle.log.length;
  say(battle, '', 'bad');
  battle.killedBy = { enemy: actor.name, move: move.name };
  const dmg = hurt(state, battle, me, actor, raw);
  battle.log[idx].text = fill(variant(move.hit, ...salt), { actor: actor.name, dmg }) + (ambush ? T.bonus : '') + (braced ? T.braced : '');
  if (me.alive) {
    battle.killedBy = undefined;
    if (move.status && nextFloat(state.rng) < move.status.chance) applyStatus(state, battle, me, move.status.kind, move.status.turns);
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
  const theme = FLOOR_THEMES[floor.theme];

  for (const c of enemiesOf(battle)) {
    const idx = floor.entities.findIndex((e) => e.id === c.id);
    if (idx < 0) continue;
    const e = floor.entities[idx];
    if (!c.alive) {
      addGore(state, e.pos, 'gibs');
      floor.entities.splice(idx, 1);
      if (nextFloat(state.rng) < theme.dropChance)
        floor.items.push({ id: `loot-${c.id}`, pos: { x: Math.round(e.pos.x), y: Math.round(e.pos.y) }, item: rollItem(state.rng) });
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

  // Props wrecked in battle stay wrecked on the map; the rest stay put.
  for (const p of battle.props) {
    const src = p.source;
    if (src.kind === 'map') {
      const mp = floor.props.find((m) => m.id === src.propId);
      if (mp) mp.usesLeft = p.usesLeft;
      if (mp && p.usesLeft <= 0) floor.props.splice(floor.props.indexOf(mp), 1);
    } else if (p.usesLeft <= 0) {
      const tile = floor.tiles[src.at.y][src.at.x];
      const gibs = tile.gore.findIndex((g) => g.kind === 'gibs');
      if (src.kind === 'corpse') {
        if (gibs >= 0) tile.gore.splice(gibs, 1);
      }
      else {
        tile.terrain = 'floor';
        tile.hazard = undefined;
      }
    }
  }

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

export function addGore(state: GameState, at: Vec, kind: 'blood' | 'gibs'): void {
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
