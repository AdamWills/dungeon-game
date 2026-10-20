// AI-invented items (user decision: Rare and Legendary items are one of a
// kind, designed by the AI in the background). The shell asks for a design and
// hands the answer in as a recorded input; here it is checked against the
// rarity's budget, given plain help text written from its real numbers, and
// put in the run's pool for chests and bosses to give out. Deterministic.

import { type AiRarity, ITEM_BUDGETS, type ItemBrief } from '../data/aiPrompts';
import { DAMAGE_TYPES, type DamageType } from '../data/damage';
import { type EffectRef, type ItemDef, type ItemSlot, ITEMS, SLOT_NAMES, type StatKey } from '../data/items';
import { STATUSES, type StatusKind } from '../data/statuses';
import type { GameState } from './types';

/** A finished design arriving from the shell. */
/** `brief`: what was asked for; the design is held to it. */
export type AiDelivery = { kind: 'item'; rarity: AiRarity; id: string; answer: unknown; brief?: ItemBrief };

const STAT_ORDER: StatKey[] = ['maxHp', 'str', 'speed', 'evasion', 'armor', 'charm'];
const STAT_LABEL: Record<StatKey, string> = { maxHp: 'Max HP', str: 'Strength', speed: 'Speed', evasion: 'Evasion', armor: 'Armor', charm: 'Charm' };

const int = (v: unknown, lo: number, hi: number, dflt = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : dflt);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isStatus = (v: unknown): v is StatusKind => typeof v === 'string' && v in STATUSES;
const isDamage = (v: unknown): v is DamageType => typeof v === 'string' && v in DAMAGE_TYPES;

/** Check a design against its rarity's budget. Null if it is not usable at all. */
export function validateAiItem(raw: unknown, rarity: AiRarity, id: string, brief?: ItemBrief): ItemDef | null {
  const a = { ...((raw ?? {}) as Record<string, any>) };
  // Held to the brief: its kind, slot and damage, and no on-hit effect unless asked for.
  if (brief) {
    a.kind = brief.kind;
    if (brief.slot) a.slot = brief.slot;
    if (brief.weaponDamage) a.weaponDamage = brief.weaponDamage;
    if (!brief.onHit) a.onHit = null;
  }
  const B = ITEM_BUDGETS[rarity];
  const name = str(a.name, 40);
  if (!name) return null;
  const description = str(a.description, 160) || 'One of a kind. Nobody knows what it is for. Neither do we!';
  const def: ItemDef = { id, name, rarity, description, help: '', invented: true };

  if (a.kind === 'weapon') {
    const type = isDamage(a.damageType) ? a.damageType : 'bludgeoning';
    def.slot = 'weapon';
    def.weapon = { damage: int(a.weaponDamage, B.weapon[0], B.weapon[1], B.weapon[0]), type };
    if (a.onHit && isStatus(a.onHit.status))
      def.weapon.onHit = { status: a.onHit.status, turns: int(a.onHit.turns, 1, B.turns, 2), chance: Math.max(0.05, Math.min(B.onHitChance, Number(a.onHit.chance) || 0.2)) };
  } else if (a.kind === 'consumable') {
    const target = a.use?.target === 'one_enemy' || a.use?.target === 'all_enemies' ? a.use.target : 'self';
    const effects: EffectRef[] = [];
    for (const e of Array.isArray(a.use?.effects) ? a.use.effects.slice(0, 3) : []) {
      if (e?.kind === 'damage' && target !== 'self')
        effects.push({ kind: 'damage', amount: int(e.amount, 1, target === 'all_enemies' ? B.useDamageAll : B.useDamageOne, 4), type: isDamage(e.damageType) ? e.damageType : undefined });
      else if (e?.kind === 'heal' && target === 'self') effects.push({ kind: 'heal', amount: int(e.amount, 1, B.useHeal, 5) });
      else if (e?.kind === 'status' && isStatus(e.status)) {
        // On yourself only the good one (haste); on enemies only the rest.
        if ((target === 'self') !== (e.status === 'hasted')) continue;
        effects.push({ kind: 'status', status: e.status, turns: int(e.turns, 1, B.turns, 2) });
      } else if (e?.kind === 'cleanse' && target === 'self') effects.push({ kind: 'cleanse' });
    }
    if (!effects.length) effects.push(target === 'self' ? { kind: 'heal', amount: Math.round(B.useHeal / 2) } : { kind: 'damage', amount: Math.round(B.useDamageOne / 2) });
    def.use = { target, effects, consumable: true, battleOnly: target !== 'self' };
  } else {
    const slot: ItemSlot = typeof a.slot === 'string' && a.slot in SLOT_NAMES && a.slot !== 'weapon' ? (a.slot as ItemSlot) : 'body';
    def.slot = slot;
  }

  // Stat mods (weapons and wearables): downsides buy upside, within the budget.
  if (def.slot) {
    const mods: Partial<Record<StatKey, number>> = {};
    let plus = 0;
    let minus = 0;
    for (const k of STAT_ORDER) {
      const each = k === 'maxHp' ? B.hpPlus : B.statEach;
      const v = int(a.mods?.[k], -each, each);
      if (v < 0) minus += k === 'maxHp' ? -v / 2 : -v;
      mods[k] = v;
    }
    for (const k of STAT_ORDER) {
      const v = mods[k] ?? 0;
      if (v <= 0) continue;
      const cost = k === 'maxHp' ? v / 2 : v;
      const room = B.statPlus + minus - plus;
      const keep = Math.max(0, Math.floor(Math.min(cost, room) * (k === 'maxHp' ? 2 : 1)));
      mods[k] = keep;
      plus += k === 'maxHp' ? keep / 2 : keep;
    }
    const used = Object.fromEntries(Object.entries(mods).filter(([, v]) => v));
    if (Object.keys(used).length) def.mods = used;
    const resists = Array.isArray(a.resists) ? [...new Set(a.resists.filter(isStatus))].slice(0, rarity === 'hosts_pick' ? 2 : 1) : [];
    if (resists.length) def.resists = resists;
  }
  def.help = itemHelp(def);
  return def;
}

/** Plain help for any item, written from its real numbers (never by the AI). */
export function itemHelp(def: ItemDef): string {
  const parts: string[] = [];
  if (def.weapon) {
    const w = def.weapon;
    let s = `Weapon, ${DAMAGE_TYPES[w.type].name}. ${w.damage} damage`;
    if (w.onHit) s += `; ${Math.round(w.onHit.chance * 100)}% chance a hit makes the target ${STATUSES[w.onHit.status].name.toLowerCase()} for ${w.onHit.turns} turn${w.onHit.turns === 1 ? '' : 's'}`;
    parts.push(`${s}.`);
  } else if (def.slot) parts.push(`${SLOT_NAMES[def.slot]}.`);
  const mods = Object.entries(def.mods ?? {}).map(([k, v]) => `${v! > 0 ? '+' : ''}${v} ${STAT_LABEL[k as StatKey]}`);
  if (mods.length) parts.push(`${mods.join(', ')}.`);
  if (def.resists?.length) parts.push(`Protects you from ${def.resists.map((r) => STATUSES[r].name.toLowerCase()).join(' and ')}.`);
  if (def.use) {
    const who = def.use.target === 'self' ? 'you' : def.use.target === 'all_enemies' ? 'every enemy' : 'one enemy';
    const what = def.use.effects.map((e) =>
      e.kind === 'damage' ? `${e.amount}${e.type ? ` ${DAMAGE_TYPES[e.type].name.toLowerCase()}` : ''} damage` : e.kind === 'heal' ? `heals ${e.amount} HP` : e.kind === 'status' ? `${STATUSES[e.status].name.toLowerCase()} for ${e.turns} turn${e.turns === 1 ? '' : 's'}` : 'removes all status effects',
    );
    parts.push(`${def.use.battleOnly ? 'In battle: ' : ''}${what.join(', ')} (${who}). Used up.`);
  }
  return parts.join(' ');
}

/** A finished design arrives: check it, register it, and put it in the pool. */
export function receiveAi(state: GameState, d: AiDelivery): void {
  if (d.kind !== 'item' || state.aiItems[d.id]) return;
  const def = validateAiItem(d.answer, d.rarity, d.id, d.brief);
  if (!def) return;
  state.aiItems[d.id] = def;
  ITEMS[d.id] = def;
  state.aiPool[d.rarity].push(d.id);
  state.events.push({ type: 'aiItemReady', defId: d.id, rarity: d.rarity });
}

/** Take the next one-of-a-kind item of this rarity, if one is ready. */
export function takeFromPool(state: GameState, rarity: string): string | undefined {
  if (rarity !== 'special' && rarity !== 'hosts_pick') return undefined;
  const id = state.aiPool[rarity].shift();
  // A saved run reloaded in a fresh page: put its items back in the table.
  if (id && !ITEMS[id] && state.aiItems[id]) ITEMS[id] = state.aiItems[id];
  return id;
}

/** Item defs you already have (worn or carried), so a boss never hands you a second copy. */
export function owned(state: GameState): Set<string> {
  return new Set([...state.player.inventory.map((i) => i.defId), ...Object.values(state.player.equipment ?? {}).map((i) => i?.defId ?? '')]);
}
