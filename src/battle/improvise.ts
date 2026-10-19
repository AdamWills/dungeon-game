// Improvisation (GDD "Improvisation: the bad ideas system"). Props, item jank
// and the Bad Idea button each resolve to an ImprovOutcome; every outcome,
// whatever its source, goes through validateOutcome before it touches the
// game: known effects only, clamped magnitudes, nothing created, no instant
// win, and never a self-inflicted death.

import {
  BACKFIRE_LINE,
  BAD_IDEAS,
  CHARM_NUDGE,
  IMPROV_LIMITS,
  ITEM_TAGS,
  JANK_BACKFIRE,
  JANK_COMBOS,
  JANK_FALLBACK,
  JANK_RULES,
  type OutcomeEffect,
  type OutcomeTemplate,
  PROP_COMBOS,
  type PropVerb,
  REPEAT_DECAY,
  REPEAT_LINE,
  VERB_RULES,
} from '../data/improv';
import { ITEMS } from '../data/items';
import { PROP_RULES, PROPS, type PropTag } from '../data/props';
import { STATUSES } from '../data/statuses';
import { weightedPick } from '../game/combat';
import { hasPerk } from '../game/progress';
import { nextFloat, pick } from '../game/rng';
import type { ArenaProp, BattleCommand, BattleState, Combatant, GameState, ImprovOutcome, Vec } from '../game/types';
import { distance } from '../world/motion';

type ImprovCommand = Extract<BattleCommand, { kind: 'improvise' }>;

const KNOWN_EFFECTS = new Set(['heal', 'damage', 'status', 'cleanse']);
const KNOWN_TARGETS = new Set(['self', 'one', 'all']);

/** Props within reach of the fight: placed props, remains and one sludge puddle. */
export function gatherArena(state: GameState, at: Vec): ArenaProp[] {
  const { floor } = state;
  const r = PROP_RULES.arenaRadius;
  const near = (p: Vec) => Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) <= r;
  const found: (ArenaProp & { d: number })[] = [];
  for (const p of floor.props)
    if (p.usesLeft > 0 && near(p.pos)) found.push({ id: p.id, defId: p.defId, usesLeft: p.usesLeft, source: { kind: 'map', propId: p.id }, d: distance(p.pos, at) });
  let sludge = false;
  for (let y = at.y - r; y <= at.y + r; y++)
    for (let x = at.x - r; x <= at.x + r; x++) {
      const t = floor.tiles[y]?.[x];
      if (!t) continue;
      if (t.gore.some((g) => g.kind === 'gibs'))
        found.push({ id: `corpse-${x}-${y}`, defId: 'corpse', usesLeft: 1, source: { kind: 'corpse', at: { x, y } }, d: distance({ x, y }, at) });
      if (t.hazard === 'sludge' && !sludge) {
        sludge = true;
        found.push({ id: `sludge-${x}-${y}`, defId: 'sludge_puddle', usesLeft: 1, source: { kind: 'sludge', at: { x, y } }, d: distance({ x, y }, at) });
      }
    }
  found.sort((a, b) => a.d - b.d || a.id.localeCompare(b.id));
  return found.slice(0, PROP_RULES.arenaMax).map(({ d: _d, ...p }) => p);
}

/** Bad Idea presses allowed per fight (Bad Habits doubles it). */
export function badIdeaLimit(state: GameState): number {
  return hasPerk(state, 'bad_habits') ? 2 : 1;
}

/** Work out what an improvisation does. Null if it is not possible right now. */
export function resolveImprov(state: GameState, battle: BattleState, cmd: ImprovCommand): (ImprovOutcome & { names: Record<string, string> }) | null {
  if (cmd.channel === 'prop') {
    const prop = battle.props.find((p) => p.id === cmd.propId && p.usesLeft > 0);
    if (!prop) return null;
    const def = PROPS[prop.defId];
    const t = PROP_COMBOS[`${cmd.verb}:${def.id}`] ?? verbRule(cmd.verb, def.tags);
    return { ...fromTemplate(t, 'table', `prop:${cmd.verb}:${def.id}`), names: { prop: def.name } };
  }

  if (cmd.channel === 'jank') {
    const [i, j] = cmd.slots;
    const inv = state.player.inventory;
    if (i === j || !inv[i] || !inv[j]) return null;
    const [a, b] = [inv[i].defId, inv[j].defId].sort();
    const key = `${a}+${b}`;
    const tagsA = ITEM_TAGS[a] ?? [];
    const tagsB = ITEM_TAGS[b] ?? [];
    const names = { a: ITEMS[a].name, b: ITEMS[b].name };
    let t: { name: string } & OutcomeTemplate =
      JANK_COMBOS[key] ??
      JANK_RULES.find((r) => (tagsA.includes(r.a) && (!r.b || tagsB.includes(r.b))) || (tagsB.includes(r.a) && (!r.b || tagsA.includes(r.b)))) ??
      pick(state.rng, JANK_FALLBACK);
    // The tagged item goes first in the line ("You tape the Pipe Bomb to the ...").
    if (!JANK_COMBOS[key] && 'a' in t && !tagsA.includes((t as { a: PropTag }).a)) [names.a, names.b] = [names.b, names.a];
    if (nextFloat(state.rng) < JANK_BACKFIRE) t = backfire(t);
    return { ...fromTemplate(t, 'table', `jank:${key}`), names: { ...names, name: t.name } };
  }

  if (battle.badIdeas >= badIdeaLimit(state)) return null;
  const charm = battle.combatants[0].stats.charm;
  const table = BAD_IDEAS.map((b) => ({
    ...b,
    weight: b.grade === 'brilliant' || b.grade === 'legendary' ? b.weight * (1 + CHARM_NUDGE * charm) : b.weight,
  }));
  const idea = weightedPick(state.rng, table);
  return { ...fromTemplate(idea, 'table', `badidea:${idea.id}`), names: { idea: idea.name } };
}

function verbRule(verb: PropVerb, tags: PropTag[]): OutcomeTemplate {
  return VERB_RULES[verb].find((r) => (r.when === 'any' || tags.includes(r.when)) && !(r.unless && tags.includes(r.unless)))!;
}

/** A backfire: everything aimed at enemies lands on you instead; helpful bits fizzle. */
function backfire<T extends { name: string } & OutcomeTemplate>(t: T): T {
  const effects: OutcomeEffect[] = t.effects
    .filter((e) => e.target !== 'self' && e.kind !== 'heal' && e.kind !== 'cleanse')
    .map((e) => ({ ...e, target: 'self' }));
  return { ...t, grade: 'disaster', effects, line: BACKFIRE_LINE };
}

function fromTemplate(t: OutcomeTemplate, source: ImprovOutcome['source'], key: string): ImprovOutcome {
  return { grade: t.grade, effects: t.effects.map((e) => ({ ...e })), narration: t.line, source, discoveryKey: key };
}

/**
 * The one gate every outcome passes, table, parser or LLM alike: unknown
 * effects and targets are dropped and magnitudes are clamped. There is no
 * effect that creates items or ends a battle, so none can get through.
 */
export function validateOutcome(o: ImprovOutcome): ImprovOutcome {
  const L = IMPROV_LIMITS;
  const effects: OutcomeEffect[] = [];
  for (const e of o.effects) {
    if (!KNOWN_EFFECTS.has(e.kind) || !KNOWN_TARGETS.has(e.target)) continue;
    if (e.kind === 'damage') effects.push({ ...e, amount: clamp(Math.round(e.amount), 0, L.maxDamage) });
    else if (e.kind === 'heal') effects.push({ ...e, amount: clamp(Math.round(e.amount), 0, L.maxHeal) });
    else if (e.kind === 'status') {
      if (!(e.status in STATUSES)) continue;
      effects.push({ ...e, turns: clamp(Math.round(e.turns), 1, L.maxTurns), then: undefined });
    } else effects.push(e);
  }
  const grade = ['disaster', 'meh', 'brilliant', 'legendary'].includes(o.grade) ? o.grade : 'meh';
  return { ...o, grade, effects, narration: String(o.narration).slice(0, 300) };
}

/** Weaken an outcome that has been done before this run. */
export function applyRepeats(o: ImprovOutcome, times: number): ImprovOutcome {
  if (times <= 0) return o;
  const f = Math.pow(REPEAT_DECAY, times);
  const effects = o.effects.map((e) =>
    e.kind === 'damage' || e.kind === 'heal' ? { ...e, amount: e.amount > 0 ? Math.max(1, Math.round(e.amount * f)) : 0 } : e,
  );
  return { ...o, effects, narration: o.narration + REPEAT_LINE };
}

export type ApplyHooks = {
  say: (text: string, tone: 'good' | 'bad' | 'info' | 'host') => void;
  /** Apply an item-style effect to a combatant (shared with items). */
  apply: (target: Combatant, effect: OutcomeEffect) => void;
  /** Self-inflicted damage that can never kill. */
  selfHarm: (amount: number) => number;
};

/** Apply a validated outcome. Returns the line to log with numbers filled in. */
export function applyOutcome(state: GameState, battle: BattleState, o: ImprovOutcome, names: Record<string, string>, hooks: ApplyHooks): string {
  const me = battle.combatants[0];
  const alive = () => battle.combatants.filter((c) => c.side === 'enemy' && c.alive);
  const one = alive().length ? pick(state.rng, alive()) : null;
  const vars: Record<string, string | number> = { ...names, target: one?.name ?? 'nobody', dmg: 0, heal: 0, selfdmg: 0 };
  for (const e of o.effects) {
    if (e.target === 'self') {
      if (e.kind === 'damage') vars.selfdmg = hooks.selfHarm(e.amount);
      else {
        if (e.kind === 'heal') vars.heal = Math.min(e.amount, me.stats.maxHp - me.stats.hp);
        hooks.apply(me, e);
      }
    } else {
      const targets = e.target === 'all' ? alive() : one?.alive ? [one] : [];
      if (e.kind === 'damage') vars.dmg = e.amount;
      for (const t of targets) hooks.apply(t, e);
    }
  }
  return o.narration.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
