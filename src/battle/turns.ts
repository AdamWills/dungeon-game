// Turn-based battles: Speed order, the player's menu command, enemy moves,
// status effects, and writing the outcome back to the map. Deterministic:
// every roll comes from state.rng, every text variant from a stable hash.

import { ABILITIES, HEX_TURNS } from '../data/abilities';
import { ALLIES, LOYALTY, REMEDY_SIDE_EFFECTS, SPARE } from '../data/allies';
import { PROPS } from '../data/props';
import { BATTLE_TEXT as T, fill, variant } from '../data/battleText';
import { CLASSES } from '../data/classes';
import { ELITE, eliteName } from '../data/bosses';
import { DAMAGE_TYPES, type DamageType, WEAK_SPOTS } from '../data/damage';
import { ENEMIES, type EnemyMove } from '../data/enemies';
import { FLOOR_THEMES } from '../data/floors';
import { type EffectRef, ITEMS } from '../data/items';
import { STATUSES, type StatusKind } from '../data/statuses';
import { TUNING } from '../data/tuning';
import { baseDamage, fleeChance, modifyDamage, rollHit, weightedPick } from '../game/combat';
import { inventoryCommand, playerResists, weaponOf } from '../game/equipment';
import { depthOf, rollItem, rollItemOf } from '../game/loot';
import { changeLoyalty, makeAlly, settleLoyalty } from '../game/party';
import { startTalk } from '../game/talk';
import { gainXp, hasPerk, openLevelUp } from '../game/progress';
import { eliminate } from '../game/report';
import { practice, skillLevel } from '../game/skills';
import { SKILLS } from '../data/skills';
import { nextFloat, nextInt, pick } from '../game/rng';
import { leaveBossRoom, leaveLair } from '../world/lair';
import { owned, takeFromPool } from '../game/aiItems';
import { applyOutcome, applyRepeats, gatherArena, resolveImprov, validateOutcome } from './improvise';
import type { BattleCommand, BattleState, Combatant, Encounter, Entity, GameState, LogLine, Vec } from '../game/types';

const PLAYER_ID = 'player';

/** True for the player's own combatant (not an ally). */
export function isYou(c: Combatant): boolean {
  return c.id === PLAYER_ID;
}

export function youIn(battle: BattleState): Combatant {
  return battle.combatants.find(isYou)!;
}

/** The party member behind an ally combatant (a just-spared enemy has none yet). */
function memberOf(state: GameState, c: Combatant): Entity | undefined {
  return state.party.find((a) => a.id === c.id);
}

/** Hex lasts longer with Fine Print. */
export function hexTurns(state: GameState): number {
  return HEX_TURNS + (hasPerk(state, 'fine_print') ? 2 : 0);
}

/** A class ability's cooldown after perks. */
export function abilityCooldown(state: GameState, abilityId: string): number {
  const base = ABILITIES[abilityId].cooldown;
  return abilityId === 'rampage' && hasPerk(state, 'knuckle_sandwich') ? Math.max(1, base - 2) : base;
}

export function startBattle(state: GameState, encounter: Encounter): void {
  const { player, floor } = state;
  snapToTile(player);
  const combatants: Combatant[] = [
    { id: PLAYER_ID, side: 'player', defId: player.defId, name: 'You', stats: { ...player.stats }, defending: false, alive: true, statuses: [] },
  ];
  for (const a of state.party) {
    snapToTile(a);
    a.ally!.healedThisFight = false;
    combatants.push({ id: a.id, side: 'player', defId: a.defId, name: ALLIES[a.defId].short, stats: { ...a.stats }, defending: false, alive: true, statuses: [], ally: true });
  }
  for (const id of encounter.enemyIds) {
    const e = floor.entities.find((x) => x.id === id)!;
    snapToTile(e);
    combatants.push({ id, side: 'enemy', defId: e.defId, name: eliteName(ENEMIES[e.defId].name, e.elite), stats: { ...e.stats }, defending: false, alive: true, statuses: [], elite: e.elite });
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
    badIdeas: 0,
    spared: [],
    allyCooldowns: {},
    playerHasActed: false,
    wait: 0,
    yourTurn: false,
  };
  state.record.fights++;
  state.battle = battle;
  for (const c of enemiesOf(battle)) planIntent(state, battle, c);
  const from = state.mode;
  state.mode = 'battle';
  state.events.push({ type: 'modeChanged', from, to: 'battle' });
  state.events.push({ type: 'battleStarted', enemyIds: [...encounter.enemyIds], start: encounter.start });

  const salt = state.tick;
  say(battle, variant(T.open[encounter.start], salt), 'host');
  enemiesOf(battle)
    .slice(1)
    .forEach((c, i) => say(battle, fill(variant(T.joined, salt, i), { name: c.name }), 'info'));
  if (enemiesOf(battle).some((c) => ENEMIES[c.defId].spare)) say(battle, T.skitchSpotted, 'host');
  for (const c of enemiesOf(battle)) {
    const intro = ENEMIES[c.defId].intro;
    if (intro) say(battle, intro, 'host');
    else if (c.elite) say(battle, fill(T.eliteSpotted, { name: c.name }), 'host');
  }
  for (const c of enemiesOf(battle)) announceWindup(battle, c);

  beginRound(battle);
  // The opening line gets a moment on screen before anyone moves.
  battle.wait = TUNING.battle.turnTicks;
  // Bosses get a big entrance first (user request: more build-up). The floor boss wins over a room boss.
  const bosses = enemiesOf(battle).filter((c) => ENEMIES[c.defId].tier);
  const star = bosses.find((c) => ENEMIES[c.defId].tier === 'floor') ?? bosses[0];
  if (star) battle.intro = star.defId;
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
  if (battle.intro) {
    // The boss intro card: Continue starts the fight.
    if (cmd.kind === 'continue') battle.intro = undefined;
    return;
  }
  if (battle.wait > 0) return; // something is still playing out
  if (battle.result) {
    if (cmd.kind === 'continue') endBattle(state);
    return;
  }
  const actor = currentActor(battle);
  if (!actor || !isYou(actor) || !battle.yourTurn) return;
  if (!playerAct(state, battle, actor, cmd)) return; // refused: still your turn
  battle.playerHasActed = true;
  const over = checkOver(state, battle);
  // A weak spot knocks them off balance: you go again, once per turn.
  const again = battle.offBalance && !battle.bonusUsed && !over;
  battle.offBalance = false;
  if (again) {
    battle.bonusUsed = true;
    say(battle, T.goAgain, 'host');
    battle.wait = TUNING.battle.turnTicks;
    return;
  }
  battle.yourTurn = false;
  if (!over) advance(battle);
  // Let your move land on screen before the next one.
  battle.wait = battle.result ? TUNING.battle.resultTicks : TUNING.battle.turnTicks;
}

/**
 * One fixed step of a battle. Turns other than yours play out one at a time,
 * a beat apart, so you can see each one land (user feedback: "things move
 * too fast").
 */
export function battleTick(state: GameState): void {
  const battle = state.battle;
  if (!battle || battle.wait <= 0 || battle.intro) return;
  if (--battle.wait > 0 || battle.result) return;
  if (battle.yourTurn) return; // a bonus action: still yours
  runTurns(state);
}

// --- rounds and turns -------------------------------------------------------

function beginRound(battle: BattleState): void {
  battle.round++;
  const alive = battle.combatants.filter((c) => c.alive);
  const bySpeed = (a: Combatant, b: Combatant) =>
    b.stats.speed - a.stats.speed || (isYou(a) ? -1 : isYou(b) ? 1 : a.side !== b.side ? (a.side === 'player' ? -1 : 1) : a.id.localeCompare(b.id));
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
/** Resolve the next turn: yours waits for the menu; anyone else's plays out, then a pause. */
function runTurns(state: GameState): void {
  const battle = state.battle!;
  if (battle.result) return;
  const actor = currentActor(battle)!;
  const canAct = startTurn(state, battle, actor);
  if (checkOver(state, battle)) {
    battle.wait = TUNING.battle.resultTicks;
    return;
  }
  if (canAct && isYou(actor)) {
    battle.yourTurn = true; // wait for the menu
    battle.bonusUsed = false;
    return;
  }
  if (canAct) {
    if (actor.side === 'player') allyAct(state, battle, actor);
    else enemyAct(state, battle, actor);
  }
  if (checkOver(state, battle)) {
    battle.wait = TUNING.battle.resultTicks;
    return;
  }
  advance(battle);
  battle.wait = canAct ? TUNING.battle.turnTicks : TUNING.battle.skipTicks;
}

/** Tick statuses at the start of a turn. Returns false if the turn is lost. */
function startTurn(state: GameState, battle: BattleState, c: Combatant): boolean {
  const mine = isYou(c);
  c.defending = false;
  if (mine) {
    const cds = state.player.cooldowns;
    for (const k of Object.keys(cds)) cds[k] = Math.max(0, cds[k] - 1);
  } else if (battle.allyCooldowns[c.id]) battle.allyCooldowns[c.id]--;
  // Overdue Invoice: hexed enemies pay late fees at the start of their turn.
  if (c.side === 'enemy' && hasStatus(c, 'hexed') && hasPerk(state, 'overdue_invoice')) {
    const dmg = Math.min(3, c.stats.hp);
    c.stats.hp -= dmg;
    say(battle, fill(T.lateFees, { name: c.name, dmg }), 'good');
    fx(battle, c.id, 'hit', dmg);
    if (c.stats.hp === 0) {
      kill(state, battle, c, youIn(battle));
      return false;
    }
  }
  let skip = false;
  for (const s of [...c.statuses]) {
    const def = STATUSES[s.kind];
    if (def.dot && c.alive) {
      // Damage over time also respects the first-turn guarantee.
      const dmg = mine && !battle.playerHasActed ? Math.min(def.dot, c.stats.hp - 1) : def.dot;
      c.stats.hp = Math.max(0, c.stats.hp - dmg);
      say(battle, fill((mine ? def.youLine : def.tickLine) ?? '', { name: c.name, dmg }), c.side === 'player' ? 'bad' : 'good');
      fx(battle, c.id, 'hit', dmg);
      if (c.stats.hp === 0) {
        if (mine) battle.killedBy = { enemy: def.killer ?? def.name, move: 'slow, lingering finish' };
        kill(state, battle, c, c);
        return false;
      }
    }
    if (s.kind === 'stunned' || (s.kind === 'charmed' && !mine)) {
      skip = true;
      say(battle, fill((mine ? def.youLine : def.tickLine) ?? '', { name: c.name }), 'info');
    }
    s.turnsLeft--;
    if (s.turnsLeft <= 0) {
      c.statuses.splice(c.statuses.indexOf(s), 1);
      say(battle, fill(isYou(c) ? T.statusOffYou : T.statusOff, { target: c.name, status: def.name.toLowerCase() }), 'info');
      if (s.then) applyStatus(state, battle, c, s.then.status, s.then.turns);
    }
  }
  if (!skip && mine && hasStatus(c, 'hasted') && battle.order.indexOf(c.id) !== battle.turn) say(battle, T.hasteExtra, 'host');
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
  const lastAction = (kind: string, item?: string) => (state.record.lastAction = { kind, item });
  switch (cmd.kind) {
    case 'attack': {
      lastAction('attack');
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
        if (ability.id === 'hex') applyStatus(state, battle, target, 'hexed', hexTurns(state));
      } else {
        say(battle, ability.useLine, 'good');
        for (const target of enemiesOf(battle).filter((c) => c.alive)) playerStrike(state, battle, me, target, [...salt, target.id.length]);
      }
      // +1 because the countdown ticks at the start of each of your turns.
      state.player.cooldowns[ability.id] = abilityCooldown(state, ability.id) + 1;
      lastAction('ability');
      return true;
    }
    case 'item': {
      const inst = state.player.inventory[cmd.slot];
      const def = inst && ITEMS[inst.defId];
      if (!def) {
        say(battle, T.noItems, 'host');
        return false;
      }
      // Swapping weapons is free, so you can hunt for a weak spot.
      if (def.slot === 'weapon') {
        const before = weaponOf(state.player).name;
        inventoryCommand(state, { kind: 'equip', slot: cmd.slot });
        if (weaponOf(state.player).name === before) return false; // cursed: it will not let go
        const p = state.player.stats;
        Object.assign(me.stats, { str: p.str, speed: p.speed, evasion: p.evasion, armor: p.armor, charm: p.charm, maxHp: p.maxHp });
        me.stats.hp = Math.min(me.stats.hp, me.stats.maxHp);
        const w = weaponOf(state.player);
        say(battle, fill(T.swapped, { weapon: w.name, type: DAMAGE_TYPES[w.type].name }), 'info');
        return false; // still your turn
      }
      if (!def.use) {
        say(battle, T.cantUseHere, 'host');
        return false;
      }
      let targets: Combatant[];
      if (def.use.target === 'self') {
        // Healing items can go to an ally instead of you.
        const friend = battle.combatants.find((c) => c.id === cmd.targetId && c.side === 'player' && c.alive);
        targets = [friend ?? me];
      }
      else if (def.use.target === 'all_enemies') targets = enemiesOf(battle).filter((c) => c.alive);
      else {
        const t = aliveEnemy(cmd.targetId);
        if (!t) return false;
        targets = [t];
      }
      const amount = def.use.effects.find((e) => e.kind === 'heal' || e.kind === 'damage');
      const first = targets[0];
      const healed = amount?.kind === 'heal' ? Math.min(amount.amount, first.stats.maxHp - first.stats.hp) : (amount?.amount ?? 0);
      if (first.ally) {
        say(battle, fill(T.itemOnAlly, { item: def.name, target: first.name, amount: healed }), 'good');
        const member = memberOf(state, first);
        if (member && !member.ally!.healedThisFight && def.use.effects.some((e) => e.kind === 'heal')) {
          member.ally!.healedThisFight = true;
          changeLoyalty(state, member, LOYALTY.healed);
        }
      } else say(battle, fill(def.useLine ?? 'You use the {item}.', { item: def.name, target: first?.name ?? '', amount: healed }), 'good');
      for (const t of targets) applyEffects(state, battle, me, t, def.use.effects);
      lastAction('item', def.id);
      if (def.use.consumable) state.player.inventory.splice(cmd.slot, 1);
      state.events.push({ type: 'itemUsed', defId: def.id });
      return true;
    }
    case 'defend':
      lastAction('defend');
      me.defending = true;
      say(battle, variant(T.defend, ...salt), 'info');
      fx(battle, me.id, 'defend');
      return true;
    case 'flee': {
      lastAction('flee');
      const foes = enemiesOf(battle).filter((c) => c.alive);
      if (nextFloat(state.rng) < fleeChance(me.stats.speed, foes.map((c) => c.stats.speed))) {
        say(battle, variant(T.fleeOk, ...salt), 'info');
        partingShots(state, battle, foes);
        battle.result = 'fled';
      } else say(battle, variant(T.fleeFail, ...salt), 'bad');
      return true;
    }
    case 'spare': {
      const target = aliveEnemy(cmd.targetId);
      const allyId = target && ENEMIES[target.defId].spare;
      if (!target || !allyId) return false;
      if (target.stats.hp > target.stats.maxHp * SPARE.hpFraction) {
        say(battle, fill(T.spareNotYet, { target: target.name }), 'host');
        return false;
      }
      lastAction('spare');
      const chance = Math.min(SPARE.max, Math.max(SPARE.min, SPARE.base + SPARE.perCharm * me.stats.charm));
      if (nextFloat(state.rng) < chance) {
        say(battle, fill(variant(T.spareOk, ...salt), { target: target.name }), 'good');
        target.side = 'player';
        target.ally = true;
        target.defId = allyId;
        target.name = ALLIES[allyId].short;
        target.statuses = [];
        target.intent = undefined;
        battle.spared.push(target.id);
        retarget(state, battle);
      } else say(battle, fill(variant(T.spareFail, ...salt), { target: target.name }), 'bad');
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
  } else if (cmd.channel === 'typed') {
    // Whatever the AI says you used is used up, if you really had it.
    const prop = battle.props.find((p) => p.id === res.propId);
    if (prop && --prop.usesLeft <= 0) wrecked = PROPS[prop.defId].name;
    if (res.itemSlot !== undefined) state.player.inventory.splice(res.itemSlot, 1);
  } else {
    battle.badIdeas++;
    state.record.badIdeas++;
  }
  state.record.lastAction = { kind: cmd.channel === 'badIdea' ? 'badIdea' : cmd.channel };

  // A disaster with friends nearby: half the time it lands on one of them instead.
  const friends = battle.combatants.filter((c) => c.ally && c.alive);
  const victim = outcome.grade === 'disaster' && friends.length && nextFloat(state.rng) < 0.5 ? pick(state.rng, friends) : me;
  const victimHp = victim.stats.hp;

  const hpBefore = new Map(battle.combatants.map((c) => [c.id, c.stats.hp]));
  const idx = battle.log.length;
  say(battle, '', outcome.grade === 'disaster' ? 'bad' : outcome.grade === 'meh' ? 'info' : 'good');
  battle.log[idx].text = applyOutcome(state, battle, outcome, names, {
    say: (text, tone) => say(battle, text, tone),
    apply: (target, { target: _t, ...effect }) => applyEffects(state, battle, me, target === me ? victim : target, [effect]),
    selfHarm: (amount) => {
      const dmg = Math.max(0, Math.min(amount, victim.stats.hp - 1));
      victim.stats.hp -= dmg;
      if (dmg) fx(battle, victim.id, 'hit', dmg);
      return dmg;
    },
  }, res.focusId);
  if (victim !== me) {
    say(battle, fill(T.backfireAlly, { target: victim.name, dmg: victimHp - victim.stats.hp }), 'bad');
    const member = memberOf(state, victim);
    if (member) changeLoyalty(state, member, LOYALTY.hurtByYou);
  }
  // The AI's narration has no numbers in it, so a plain results line follows it.
  if (cmd.channel === 'typed') {
    const changes = battle.combatants
      .map((c) => ({ c, d: c.stats.hp - (hpBefore.get(c.id) ?? c.stats.hp) }))
      .filter(({ d }) => d !== 0)
      .map(({ c, d }) => `${c.name} ${d > 0 ? '+' : ''}${d} HP`);
    say(battle, changes.length ? `(${changes.join(', ')})` : T.typedNoEffect, 'info');
  }
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
        const hit = typed(state, battle, user, target, eff.pierce ? eff.amount : Math.max(1, eff.amount - target.stats.armor), eff.type);
        if (hit.note) say(battle, `${target.name}:${hit.note}`, 'info');
        hurt(state, battle, target, user, hit.dmg, eff.type);
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
  const mine = isYou(target);
  if (mine && playerResists(state).includes(kind)) {
    say(battle, fill(T.resisted, { target: target.name, status: name }), 'good');
    return false;
  }
  const existing = target.statuses.find((s) => s.kind === kind);
  if (existing) existing.turnsLeft += turns;
  else target.statuses.push({ kind, turnsLeft: turns, then });
  say(battle, fill(mine ? T.statusOnYou : T.statusOn, { target: target.name, status: name }), target.side === 'player' ? 'bad' : 'good');
  fx(battle, target.id, 'status');
  return true;
}

/**
 * Weak spots: scale a hit on an enemy by its damage type and remember what
 * that type does to this kind of creature. Your weak-spot hits knock it off
 * balance (you go again). Returns the damage and a note for the log.
 */
function typed(state: GameState, battle: BattleState, attacker: Combatant, target: Combatant, raw: number, type?: DamageType): { dmg: number; note: string } {
  if (!type || target.side !== 'enemy') return { dmg: raw, note: '' };
  const def = ENEMIES[target.defId];
  const name = DAMAGE_TYPES[type].name;
  const tried = (state.weakSpots[def.id] ??= []);
  const first = !tried.includes(type);
  if (first) tried.push(type);
  if (def.weak?.includes(type)) {
    if (isYou(attacker)) battle.offBalance = true;
    fx(battle, target.id, 'weak');
    // The first time, Chet makes a fuss about it (same line, so it reads in order).
    const found = first ? ` ${fill(T.weakFound, { target: def.name, type: name.toLowerCase() })}` : '';
    if (first) state.events.push({ type: 'weakSpotFound', defId: def.id, damage: type });
    return { dmg: Math.max(1, Math.round(raw * WEAK_SPOTS.weakMult)), note: fill(T.weakNote, { type: name }) + found };
  }
  if (def.resists?.includes(type)) {
    fx(battle, target.id, 'resist');
    return { dmg: Math.max(1, Math.round(raw * WEAK_SPOTS.resistMult)), note: fill(T.resistNote, { type: name.toLowerCase() }) };
  }
  return { dmg: raw, note: '' };
}

/** Final damage after Hex, bracing and passives; kills if HP hits 0. */
function hurt(state: GameState, battle: BattleState, target: Combatant, source: Combatant, raw: number, dtype?: string): number {
  let dmg = raw;
  if (hasStatus(target, 'hexed')) dmg *= 2;
  if (target.defending) dmg = Math.ceil(dmg * TUNING.combat.defendMultiplier);
  if (target.ally && ALLIES[target.defId]?.passive.id === 'load_bearing') dmg -= 1;
  if (isYou(target) && !battle.skullUsed && hasPerk(state, 'thick_skull')) {
    battle.skullUsed = true;
    dmg = Math.ceil(dmg / 2);
  }
  dmg = Math.max(1, dmg);
  // No dying before your first turn, however bad the ambush.
  if (isYou(target) && !battle.playerHasActed) dmg = Math.min(dmg, target.stats.hp - 1);
  target.stats.hp = Math.max(0, target.stats.hp - dmg);
  fx(battle, target.id, 'hit', dmg, { dtype, big: dmg >= target.stats.maxHp * 0.3 || target.stats.hp === 0 });
  if (target.stats.hp === 0) kill(state, battle, target, source);
  return dmg;
}

function playerStrike(state: GameState, battle: BattleState, me: Combatant, target: Combatant, salt: (number | string)[]) {
  const weapon = weaponOf(state.player);
  const s = salt.map((x) => (typeof x === 'number' ? x : x.length));
  fx(battle, me.id, 'lunge', undefined, { toId: target.id });
  if (!rollHit(state.rng, target.stats.evasion)) {
    say(battle, fill(variant(T.playerMiss, ...s), { target: target.name }), 'info');
    fx(battle, target.id, 'miss');
    return;
  }
  const ambush = ambushActive(battle, 'player');
  const hit = typed(state, battle, me, target, modifyDamage(baseDamage(weapon.damage, me.stats.str, target.stats.armor), { ambush, defending: false }), weapon.type);
  const hexed = hasStatus(target, 'hexed');
  const line = fill(variant(T.playerHit, ...s), { target: target.name, weapon: weapon.name, dmg: '{dmg}' });
  const idx = battle.log.length;
  say(battle, line, 'good');
  const dmg = hurt(state, battle, target, me, hit.dmg, weapon.type);
  battle.log[idx].text = line.replace('{dmg}', String(dmg)) + hit.note + (ambush ? T.bonus : '') + (hexed ? ' (Hexed: double damage.)' : '');
  if (target.alive && weapon.onHit && nextFloat(state.rng) < weapon.onHit.chance)
    applyStatus(state, battle, target, weapon.onHit.status, weapon.onHit.turns);
}

/**
 * Who an enemy goes for: you or an ally. Defensive allies draw fire; Skitch
 * (Survival Instinct) is only a target when nobody else is standing.
 */
function pickVictim(state: GameState, battle: BattleState): Combatant {
  const side = battle.combatants.filter((c) => c.side === 'player' && c.alive);
  const shy = (c: Combatant) => c.ally && ALLIES[c.defId]?.passive.id === 'survival_instinct';
  const bold = side.filter((c) => !shy(c));
  const pool = bold.length ? bold : side;
  const weight = (c: Combatant) => (c.ally && memberOf(state, c)?.ally?.stance === 'defensive' ? 2 : 1);
  return weightedPick(state.rng, pool.map((c) => ({ c, weight: weight(c) }))).c;
}

/**
 * Each enemy lines up its next move and target in advance, so Read the Room
 * can show it. Targets that fall (or switch sides) are re-picked.
 */
function planIntent(state: GameState, battle: BattleState, enemy: Combatant): void {
  // A summon only while there is room for more of its kind.
  const up = (defId: string) => battle.combatants.filter((c) => c.alive && c.side === 'enemy' && c.defId === defId).length;
  const moves = ENEMIES[enemy.defId].moves.filter((m) => !m.summon || up(m.summon.defId) < m.summon.max);
  const move = weightedPick(state.rng, moves);
  enemy.intent = { moveId: move.id, targetId: pickVictim(state, battle).id };
}

/** A big move lined up: say so, whatever your Read the Room. */
function announceWindup(battle: BattleState, enemy: Combatant): void {
  const move = ENEMIES[enemy.defId].moves.find((m) => m.id === enemy.intent?.moveId);
  if (move?.windup && enemy.alive) say(battle, fill(move.hitsAll ? T.windupAll : T.windup, { actor: enemy.name, move: move.name }), 'host');
}

function retarget(state: GameState, battle: BattleState): void {
  if (!battle.combatants.some((c) => c.side === 'player' && c.alive)) return; // nobody left to go for
  for (const e of enemiesOf(battle)) {
    if (!e.alive || !e.intent) continue;
    const t = battle.combatants.find((c) => c.id === e.intent!.targetId);
    if (!t?.alive || t.side !== 'player') e.intent.targetId = pickVictim(state, battle).id;
  }
}

function enemyAct(state: GameState, battle: BattleState, actor: Combatant): void {
  const def = ENEMIES[actor.defId];
  if (!actor.intent) planIntent(state, battle, actor);
  const plan = actor.intent!;
  const move = def.moves.find((m) => m.id === plan.moveId) ?? def.moves[0];
  const target = battle.combatants.find((c) => c.id === plan.targetId && c.alive && c.side === 'player') ?? pickVictim(state, battle);
  // Watching them work is how you learn to read them.
  const knew = skillLevel(state, 'read_the_room');
  practice(state, 'read_the_room');
  const now = skillLevel(state, 'read_the_room');
  if (now > knew) say(battle, fill(T.skillUp, { skill: SKILLS.read_the_room.name, level: now, help: SKILLS.read_the_room.levels[now] }), 'host');
  if (move.summon) {
    summon(state, battle, actor, move);
  } else if (move.hitsAll) {
    for (const t of battle.combatants.filter((c) => c.side === 'player' && c.alive)) enemyStrike(state, battle, actor, move, t);
  } else enemyStrike(state, battle, actor, move, target);
  // Line up the next move (after this one, so a summon sees its own blobs).
  if (battle.combatants.some((c) => c.side === 'player' && c.alive)) {
    planIntent(state, battle, actor);
    announceWindup(battle, actor);
  }
}

function enemyStrike(state: GameState, battle: BattleState, actor: Combatant, move: EnemyMove, target: Combatant): void {
  const def = ENEMIES[actor.defId];
  const mine = isYou(target);
  const salt = [battle.round, battle.turn, battle.log.length];
  fx(battle, actor.id, 'lunge', undefined, { toId: target.id });
  if (!rollHit(state.rng, target.stats.evasion)) {
    say(battle, fill(variant(mine ? T.enemyMiss : T.enemyMissesAlly, ...salt), { actor: actor.name, move: move.name, target: target.name }), 'info');
    fx(battle, target.id, 'miss');
    return;
  }
  const ambush = ambushActive(battle, 'enemy', actor.id);
  const raw = modifyDamage(baseDamage(def.weapon + move.bonus, actor.stats.str, target.stats.armor), { ambush, defending: false });
  const braced = target.defending;
  const idx = battle.log.length;
  say(battle, '', 'bad');
  if (mine) battle.killedBy = { enemy: actor.name, move: move.name };
  const dmg = hurt(state, battle, target, actor, raw);
  const line = mine ? variant(move.hit, ...salt) : variant(T.enemyHitsAlly, ...salt);
  battle.log[idx].text = fill(line, { actor: actor.name, dmg, target: target.name, move: move.name }) + (ambush ? T.bonus : '') + (braced ? T.braced : '');
  if (target.alive) {
    if (mine) battle.killedBy = undefined;
    if (move.status && nextFloat(state.rng) < move.status.chance) applyStatus(state, battle, target, move.status.kind, move.status.turns);
  }
}

/** Call in reinforcements; they join the turn order next round. */
function summon(state: GameState, battle: BattleState, actor: Combatant, move: EnemyMove): void {
  const s = move.summon!;
  const def = ENEMIES[s.defId];
  const up = battle.combatants.filter((c) => c.alive && c.side === 'enemy' && c.defId === def.id).length;
  for (let i = 0; i < Math.min(s.count, s.max - up); i++) {
    const id = `${actor.id}-s${battle.combatants.length}`;
    const c: Combatant = { id, side: 'enemy', defId: def.id, name: def.name, stats: { ...def.stats, maxHp: def.stats.hp }, defending: false, alive: true, statuses: [] };
    battle.combatants.push(c);
    planIntent(state, battle, c);
  }
  say(battle, variant(move.hit, battle.round, battle.log.length).replace('{actor}', actor.name), 'bad');
}

/** Fleeing: each ally still standing takes a parting hit while covering you, and remembers it. */
function partingShots(state: GameState, battle: BattleState, foes: Combatant[]): void {
  for (const c of battle.combatants.filter((x) => x.ally && x.alive)) {
    if (!foes.length) break;
    const foe = pick(state.rng, foes);
    const raw = baseDamage(ENEMIES[foe.defId].weapon, foe.stats.str, c.stats.armor);
    const idx = battle.log.length;
    say(battle, '', 'bad');
    const dmg = hurt(state, battle, c, foe, raw);
    battle.log[idx].text = fill(T.partingHit, { actor: foe.name, target: c.name, dmg });
    const member = memberOf(state, c);
    if (member) changeLoyalty(state, member, LOYALTY.fled);
  }
}

// --- allies -------------------------------------------------------------------

/** An ally's turn, by stance (GDD: no direct control in the prototype). */
function allyAct(state: GameState, battle: BattleState, me: Combatant): void {
  const def = ALLIES[me.defId];
  const stance = memberOf(state, me)?.ally?.stance ?? 'aggressive';
  // Allies leave a beaten would-be deserter alone, so you get the chance to spare it.
  const spareable = (c: Combatant) => !!ENEMIES[c.defId].spare && c.stats.hp <= c.stats.maxHp * SPARE.hpFraction;
  const foes = enemiesOf(battle).filter((c) => c.alive && !spareable(c));
  if (!foes.length) {
    if (enemiesOf(battle).some((c) => c.alive)) say(battle, fill(T.allyHolds, { ally: me.name }), 'info');
    return;
  }
  const friends = battle.combatants.filter((c) => c.side === 'player' && c.alive);
  const ready = !battle.allyCooldowns[me.id];

  // Is the ability worth using now? Support waits for the moment; Aggressive does not.
  const hurtMost = [...friends].sort((a, b) => a.stats.hp / a.stats.maxHp - b.stats.hp / b.stats.maxHp)[0];
  const need = hurtMost.stats.hp / hurtMost.stats.maxHp;
  const worth =
    def.ability.id === 'remedy'
      ? stance === 'aggressive' ? need < 1 : need < 0.5
      : stance === 'aggressive' ? true : foes.length >= 2;
  if (ready && worth) {
    useAllyAbility(state, battle, me, def, foes, hurtMost);
    battle.allyCooldowns[me.id] = def.ability.cooldown + 1;
    return;
  }
  if (stance === 'defensive' && me.stats.hp < me.stats.maxHp / 2) {
    me.defending = true;
    say(battle, fill(variant(T.allyDefend, battle.round, battle.log.length), { ally: me.name }), 'info');
    fx(battle, me.id, 'defend');
    return;
  }
  const target = stance === 'aggressive' ? [...foes].sort((a, b) => a.stats.hp - b.stats.hp)[0] : pick(state.rng, foes);
  allyStrike(state, battle, me, def, target, def.weapon.damage);
}

function allyStrike(state: GameState, battle: BattleState, me: Combatant, def: (typeof ALLIES)[string], target: Combatant, weapon: number): void {
  const salt = [battle.round, battle.turn, battle.log.length];
  fx(battle, me.id, 'lunge', undefined, { toId: target.id });
  if (!rollHit(state.rng, target.stats.evasion)) {
    say(battle, fill(variant(T.allyMiss, ...salt), { ally: me.name, target: target.name }), 'info');
    fx(battle, target.id, 'miss');
    return;
  }
  const ambush = ambushActive(battle, 'player');
  const hit = typed(state, battle, me, target, modifyDamage(baseDamage(weapon, me.stats.str, target.stats.armor), { ambush, defending: false }), def.weapon.type);
  const idx = battle.log.length;
  say(battle, '', 'good');
  const dmg = hurt(state, battle, target, me, hit.dmg, def.weapon.type);
  battle.log[idx].text = fill(variant(def.attackLines, ...salt), { ally: me.name, target: target.name, dmg }) + hit.note + (ambush ? T.bonus : '');
}

function useAllyAbility(state: GameState, battle: BattleState, me: Combatant, def: (typeof ALLIES)[string], foes: Combatant[], hurtMost: Combatant): void {
  const ab = def.ability;
  switch (ab.id) {
    case 'lift': {
      const target = [...foes].sort((a, b) => a.stats.hp - b.stats.hp)[0];
      const other = foes.find((f) => f !== target);
      say(battle, fill(ab.line, { ally: me.name, target: target.name, other: other?.name ?? 'the floor' }), 'good');
      const raw = baseDamage(def.weapon.damage + 2, me.stats.str, target.stats.armor);
      hurt(state, battle, target, me, raw);
      if (other?.alive) hurt(state, battle, other, me, baseDamage(def.weapon.damage + 2, me.stats.str, other.stats.armor));
      return;
    }
    case 'panic_fire': {
      say(battle, fill(ab.line, { ally: me.name }), 'good');
      for (let i = 0; i < 3; i++) {
        const alive = foes.filter((f) => f.alive);
        if (!alive.length) break;
        const t = pick(state.rng, alive);
        hurt(state, battle, t, me, Math.max(1, 2 - t.stats.armor));
      }
      return;
    }
    case 'remedy': {
      const before = hurtMost.stats.hp;
      hurtMost.stats.hp = Math.min(hurtMost.stats.maxHp, hurtMost.stats.hp + 8);
      const amount = hurtMost.stats.hp - before;
      fx(battle, hurtMost.id, 'heal', amount);
      say(battle, fill(ab.line, { ally: me.name, target: hurtMost.name === 'You' ? 'you' : hurtMost.name, amount }), 'good');
      if (nextFloat(state.rng) < 0.1) {
        const side = pick(state.rng, REMEDY_SIDE_EFFECTS);
        say(battle, fill(T.remedySide, { target: hurtMost.name, status: STATUSES[side.status].name.toLowerCase() }), 'host');
        applyStatus(state, battle, hurtMost, side.status, side.turns);
      }
      return;
    }
  }
}

function kill(state: GameState, battle: BattleState, target: Combatant, killer: Combatant): void {
  target.alive = false;
  fx(battle, target.id, 'death');
  state.events.push({ type: 'entityDied', id: target.id, defId: target.defId, killerId: killer.id });
  if (target.side === 'enemy') say(battle, fill(variant(T.kill, battle.round, battle.log.length), { target: target.name }), 'good');
  else if (target.ally) say(battle, fill(variant(T.allyDown, battle.round, battle.log.length), { target: target.name }), 'host');
  if (target.side === 'player') retarget(state, battle);
}

/** Sets the result if one side is wiped out. */
function checkOver(state: GameState, battle: BattleState): boolean {
  if (battle.result) return true;
  if (!youIn(battle).alive) {
    battle.result = 'lost';
    say(battle, variant(T.defeat, state.tick), 'host');
  } else if (enemiesOf(battle).every((c) => !c.alive)) {
    battle.result = 'won';
    say(battle, variant(T.victory, state.tick, battle.round), 'host');
    // Spoils, announced in the log so the result screen shows them.
    const spoils = battleSpoils(state, battle);
    if (spoils.xp) say(battle, fill(T.xp, { xp: spoils.xp }), 'good');
    if (spoils.tokens) say(battle, fill(spoils.tokens === 1 ? T.token : T.tokens, { amount: spoils.tokens }), 'good');
  }
  return battle.result !== null;
}

/** XP and Prize Tokens for the enemies killed (spared ones join instead). */
function battleSpoils(state: GameState, battle: BattleState): { xp: number; tokens: number } {
  if (battle.spoils) return battle.spoils;
  let xp = 0;
  let tokens = 0;
  for (const c of battle.combatants) {
    if (c.side !== 'enemy' || c.alive) continue;
    const def = ENEMIES[c.defId];
    const elite = c.elite ? ELITE : null;
    xp += Math.round(def.xp * (elite?.xpMult ?? 1));
    tokens += Math.round(nextInt(state.rng, def.tokens[0], def.tokens[1]) * (elite?.tokenMult ?? 1));
  }
  if (battle.ambushSide === 'player') xp = Math.round(xp * (1 + TUNING.progression.ambushXpBonus));
  battle.spoils = { xp, tokens };
  return battle.spoils;
}

// --- leaving the battle -----------------------------------------------------

function endBattle(state: GameState): void {
  const battle = state.battle!;
  const { floor, player } = state;
  const me = youIn(battle);
  player.stats.hp = me.stats.hp;
  const theme = FLOOR_THEMES[floor.theme];
  const result = battle.result!;

  for (const c of enemiesOf(battle)) {
    const idx = floor.entities.findIndex((e) => e.id === c.id);
    if (idx < 0) continue;
    const e = floor.entities[idx];
    if (!c.alive) {
      addGore(state, e.pos, 'gibs');
      floor.entities.splice(idx, 1);
      const at = { x: Math.round(e.pos.x), y: Math.round(e.pos.y) };
      const def = ENEMIES[c.defId];
      // Bosses always drop their prize, elites always drop something; the rest sometimes.
      if (def.prize) floor.items.push({ id: `loot-${c.id}`, pos: at, item: rollItemOf(state.rng, def.prize, (r) => takeFromPool(state, r), owned(state)) });
      else if (c.elite || nextFloat(state.rng) < theme.dropChance) floor.items.push({ id: `loot-${c.id}`, pos: at, item: rollItem(state.rng, depthOf(floor, at), 'drop', (r) => takeFromPool(state, r)) });
      const tier = def.tier ?? (c.elite ? 'elite' : null);
      if (tier) state.events.push({ type: 'bossDefeated', defId: c.defId, tier, name: c.name });
      if (floor.lair?.bossId === c.id) floor.lair.beaten = true;
    } else {
      e.stats.hp = c.stats.hp;
      if (result === 'fled' && e.patrol && e.mind && ENEMIES[e.defId].tier !== 'floor') {
        e.patrol.alert = 'chasing';
        e.mind.asleep = false;
        e.mind.lastSeen = { ...player.pos };
        e.mind.lostSight = 0;
        e.mind.stunned = TUNING.fleeStunTicks;
      }
    }
  }
  if (battle.combatants.some((c) => c.side === 'enemy' && !c.alive)) addGore(state, battle.encounter.tile, 'blood');

  // Allies: the fallen drop their gear; the rest carry their HP back out.
  for (const c of battle.combatants.filter((x) => x.ally && !battle.spared.includes(x.id))) {
    const member = memberOf(state, c);
    if (!member) continue;
    if (c.alive) {
      member.stats.hp = c.stats.hp;
      continue;
    }
    state.party.splice(state.party.indexOf(member), 1);
    state.record.alliesLost++;
    addGore(state, member.pos, 'gibs');
    const drop = member.inventory[0] ?? null;
    if (drop) floor.items.push({ id: `fallen-${member.id}`, pos: { x: Math.round(member.pos.x), y: Math.round(member.pos.y) }, item: drop });
    state.events.push({ type: 'allyDied', allyId: member.defId, item: drop?.defId ?? null });
  }

  // Spared enemies leave their side and wait to talk to you (they join if you say so).
  const deserters: Entity[] = [];
  for (const id of battle.spared) {
    const c = battle.combatants.find((x) => x.id === id)!;
    const idx = floor.entities.findIndex((e) => e.id === id);
    const at = idx >= 0 ? floor.entities[idx].pos : player.pos;
    if (idx >= 0) floor.entities.splice(idx, 1);
    if (!c.alive) continue;
    const ally = makeAlly(c.defId, { x: Math.round(at.x), y: Math.round(at.y) }, state.level, false);
    ally.ally!.joinHp = c.stats.hp;
    ally.ally!.spotted = true;
    floor.entities.push(ally);
    deserters.push(ally);
  }

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
      } else {
        tile.terrain = 'floor';
        tile.hazard = undefined;
      }
    }
  }

  state.battle = null;
  state.events.push({ type: 'battleEnded', result });
  if (result === 'lost') {
    eliminate(state, battle.killedBy?.enemy ?? 'something', battle.killedBy?.move ?? 'unknown causes');
    return;
  }
  if (result === 'fled') state.grace = TUNING.fleeGraceTicks;
  if (result === 'fled' && floor.lair && battle.encounter.enemyIds.includes(floor.lair.bossId)) leaveLair(state);
  const roomBoss = floor.bossRooms?.find((b) => battle.encounter.enemyIds.includes(b.bossId));
  if (result === 'fled' && roomBoss) leaveBossRoom(state, roomBoss.bossId);
  setMode(state, 'roaming');

  if (result === 'won') {
    // Loyalty: a win together helps; being left badly hurt without help does not.
    for (const a of state.party) {
      changeLoyalty(state, a, LOYALTY.wonTogether);
      if (a.stats.hp < a.stats.maxHp * LOYALTY.hurtFraction && !a.ally!.healedThisFight) changeLoyalty(state, a, LOYALTY.leftHurt);
    }
    const doc = state.party.find((a) => ALLIES[a.defId].passive.id === 'second_opinion');
    if (doc) {
      for (const m of [player, ...state.party]) m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + 3);
    }
    const spoils = battleSpoils(state, battle);
    if (spoils.tokens) {
      state.tokens += spoils.tokens;
      state.events.push({ type: 'tokensGained', amount: spoils.tokens, from: 'battle' });
    }
    gainXp(state, spoils.xp);
  }
  settleLoyalty(state);
  if (player.stats.hp > 0 && player.stats.hp < player.stats.maxHp * 0.25) state.events.push({ type: 'lowHp', hp: player.stats.hp });
  // Any level gained in the fight opens its screen now; then a spared enemy wants a word.
  openLevelUp(state);
  if (deserters.length && state.mode !== 'dead') startTalk(state, deserters[0], 'meet');
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

function fx(battle: BattleState, targetId: string, kind: BattleState['fx'][number]['kind'], amount?: number, extra: { dtype?: string; toId?: string; big?: boolean } = {}): void {
  battle.fx.push({ seq: ++battle.fxSeq, targetId, kind, amount, ...extra });
  if (battle.fx.length > 40) battle.fx.shift();
}
