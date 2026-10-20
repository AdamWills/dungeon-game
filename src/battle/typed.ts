// Typed actions (GDD "Free-text improv", AI-first). The shell sends the scene
// and the player's text to the AI; the answer comes back here as a recorded
// command and is checked like any other improvisation: unknown names and
// effects are dropped, totals are capped by grade, items are only used up if
// you really have them. Pure and deterministic: no AI calls in here.

import { ACTION_CAPS } from '../data/aiPrompts';
import { DAMAGE_TYPES, type DamageType } from '../data/damage';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { PROPS } from '../data/props';
import { STATUSES, type StatusKind } from '../data/statuses';
import type { Grade, OutcomeEffect } from '../data/improv';
import { weaponOf } from '../game/equipment';
import { knownSpots } from '../game/weakspots';
import type { BattleState, GameState, ImprovOutcome } from '../game/types';

/** The shape the AI answers in (see ACTION_SCHEMA); treated as untrusted. */
export type TypedAnswer = {
  grade: string;
  narration: string;
  effects: { kind: string; target: string; targetName: string | null; amount: number | null; damageType: string | null; status: string | null; turns: number | null }[];
  usesItem: string | null;
  usesProp: string | null;
  key: string;
};

/** What the AI is told about the fight: names it can use, nothing hidden. */
export function actionScene(state: GameState, battle: BattleState): object {
  const me = battle.combatants[0];
  const weapon = weaponOf(state.player);
  const statuses = (c: (typeof battle.combatants)[number]) => c.statuses.map((s) => STATUSES[s.kind].name);
  return {
    floor: 'The Intake Sewers',
    contestant: { race: state.race, class: state.cls, hp: `${me.stats.hp}/${me.stats.maxHp}`, strength: me.stats.str, weapon: `${weapon.name} (${DAMAGE_TYPES[weapon.type].name})`, statuses: statuses(me) },
    allies: battle.combatants.filter((c) => c.ally && c.alive).map((c) => ({ name: c.name, hp: `${c.stats.hp}/${c.stats.maxHp}` })),
    enemies: battle.combatants
      .filter((c) => c.side === 'enemy' && c.alive)
      .map((c) => {
        const k = knownSpots(state, c.defId);
        return { name: c.name, what: ENEMIES[c.defId].blurb, hp: `${c.stats.hp}/${c.stats.maxHp}`, statuses: statuses(c), knownWeakTo: k.weak, knownShrugsOff: k.resists };
      }),
    arenaProps: battle.props.filter((p) => p.usesLeft > 0).map((p) => ({ name: PROPS[p.defId].name, is: PROPS[p.defId].tags })),
    pockets: state.player.inventory.map((i) => ITEMS[i.defId]?.name).filter(Boolean),
  };
}

export type TypedResolution = ImprovOutcome & {
  /** The enemy the named effects land on. */
  focusId?: string;
  /** Pocket slot to use up, and arena prop to wear, if the AI said so and it is real. */
  itemSlot?: number;
  propId?: string;
};

const GRADES: Grade[] = ['disaster', 'meh', 'brilliant', 'legendary'];
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Turn an AI answer into a safe outcome. Anything that does not check out is dropped or shrunk. */
export function resolveTyped(state: GameState, battle: BattleState, text: string, raw: unknown): TypedResolution {
  const a = (raw ?? {}) as Partial<TypedAnswer>;
  const grade: Grade = GRADES.includes(a.grade as Grade) ? (a.grade as Grade) : 'meh';
  const foes = battle.combatants.filter((c) => c.side === 'enemy' && c.alive);
  let focusId: string | undefined;
  // A disaster hurts only you; ACTION_CAPS.damage.disaster caps that self-harm.
  let damageLeft = grade === 'disaster' ? 0 : ACTION_CAPS.damage[grade];
  let healLeft = ACTION_CAPS.heal[grade];
  const effects: OutcomeEffect[] = [];
  for (const e of Array.isArray(a.effects) ? a.effects.slice(0, ACTION_CAPS.maxEffects) : []) {
    if (!e || typeof e !== 'object') continue;
    const target = e.target === 'self' ? 'self' : e.target === 'all_enemies' ? 'all' : e.target === 'enemy' ? 'one' : null;
    if (!target) continue;
    if (target === 'one') {
      const named = foes.find((c) => typeof e.targetName === 'string' && same(c.name, e.targetName));
      if (named && !focusId) focusId = named.id;
    }
    const amount = typeof e.amount === 'number' && Number.isFinite(e.amount) ? Math.max(0, Math.round(e.amount)) : 0;
    if (e.kind === 'damage') {
      // Self-harm is a disaster's cost and does not use up the damage allowance.
      const dmg = target === 'self' ? Math.min(amount, ACTION_CAPS.damage.disaster) : Math.min(amount, damageLeft);
      if (target !== 'self') damageLeft -= dmg;
      const type = typeof e.damageType === 'string' && e.damageType in DAMAGE_TYPES ? (e.damageType as DamageType) : undefined;
      if (dmg > 0) effects.push({ kind: 'damage', amount: dmg, type, target });
    } else if (e.kind === 'heal') {
      const heal = Math.min(amount, healLeft);
      healLeft -= heal;
      if (heal > 0) effects.push({ kind: 'heal', amount: heal, target: 'self' });
    } else if (e.kind === 'status') {
      if (typeof e.status !== 'string' || !(e.status in STATUSES)) continue;
      // A disaster only lands statuses on you; a success never lands a bad one on you.
      const status = e.status as StatusKind;
      if (grade === 'disaster' && target !== 'self') continue;
      if (grade !== 'disaster' && target === 'self' && status !== 'hasted') continue;
      const turns = Math.max(1, Math.min(ACTION_CAPS.maxTurns, Math.round(Number(e.turns) || 1)));
      effects.push({ kind: 'status', status, turns, target });
    } else if (e.kind === 'cleanse') effects.push({ kind: 'cleanse', target: 'self' });
  }

  // Using something up only counts if you really have it.
  const itemSlot = typeof a.usesItem === 'string' ? state.player.inventory.findIndex((i) => same(ITEMS[i.defId]?.name ?? '', a.usesItem!)) : -1;
  const prop = typeof a.usesProp === 'string' ? battle.props.find((p) => p.usesLeft > 0 && same(PROPS[p.defId].name, a.usesProp!)) : undefined;

  const slug = (typeof a.key === 'string' ? a.key : text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const narration = (typeof a.narration === 'string' && a.narration.trim() ? a.narration.trim() : 'Well, that happened, folks!').slice(0, ACTION_CAPS.narrationChars);
  return {
    grade,
    effects,
    narration,
    source: 'llm',
    discoveryKey: `typed:${slug || 'something'}`,
    focusId,
    itemSlot: itemSlot >= 0 ? itemSlot : undefined,
    propId: prop?.id,
  };
}
