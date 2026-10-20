// Keeps a few one-of-a-kind items designed and ready (user decision: Rare and
// Legendary items are AI-invented). Runs in the browser shell: asks the AI
// for a design, queues it to enter the game as a recorded input, then makes
// its icon with the image model. Quietly backs off when calls fail.

import { type AiRarity, BRIEF_GIMMICKS, BRIEF_KINDS, BRIEF_SLOTS, ITEM_BUDGETS, ITEM_SCHEMA, ITEM_SYSTEM, iconPrompt, type ItemBrief } from '../data/aiPrompts';
import { ITEMS } from '../data/items';
import { pixelize } from '../art/pixelize';
import { decodePixels, toCanvas } from '../art/decode';
import type { AiDelivery } from '../game/aiItems';
import type { GameState } from '../game/types';
import { INVENTED_ICONS } from '../ui/itemIcons';
import { type Client, image, structured } from './openai';

/** How many of each to keep ready (not yet handed out). */
const READY: Record<AiRarity, number> = { special: 2, hosts_pick: 1 };
const RETRY_MS = 30_000;
const NAMES: Record<AiRarity, string> = { special: 'Rare', hosts_pick: 'Legendary' };

export class ItemSupplier {
  /** Finished designs waiting to go into the next game step. */
  queue: AiDelivery[] = [];
  private busy: Record<AiRarity, boolean> = { special: false, hosts_pick: false };
  private failedAt = -Infinity;
  private stopped = false;
  private made = 0;

  constructor(private client: () => Client) {}

  reset(): void {
    this.queue = [];
    this.failedAt = -Infinity;
    this.stopped = false;
  }

  /** Call every frame: starts a design when the pool runs low. */
  tick(state: GameState, now: number): void {
    if (this.stopped || now - this.failedAt < RETRY_MS) return;
    for (const r of Object.keys(READY) as AiRarity[]) {
      const waiting = state.aiPool[r].length + this.queue.filter((d) => d.rarity === r).length;
      if (!this.busy[r] && waiting < READY[r]) void this.design(state, r, now);
    }
  }

  private async design(state: GameState, rarity: AiRarity, now: number): Promise<void> {
    this.busy[rarity] = true;
    const brief = pickBrief(rarity);
    // Earlier designs this run, so the new one is clearly different (user feedback: they were all alike).
    const earlier = Object.values(state.aiItems).map((d) => `${d.name}: ${d.help}`);
    const avoid = Object.values(ITEMS).filter((d) => !d.invented).map((d) => d.name);
    const user = JSON.stringify({ rarity: NAMES[rarity], brief, budget: ITEM_BUDGETS[rarity], contestant: { race: state.race, class: state.cls }, earlierItemsThisRun: earlier.slice(-12), namesTaken: avoid.slice(0, 60) });
    const res = await structured<{ iconPrompt?: string }>(this.client(), { system: ITEM_SYSTEM, user, schemaName: 'invented_item', schema: ITEM_SCHEMA, maxOutputTokens: 700, purpose: `item design (${NAMES[rarity]})` });
    this.busy[rarity] = false;
    if (!res.ok) {
      this.failedAt = now;
      if (res.error.kind === 'budget' || res.error.kind === 'no_key') this.stopped = true;
      return;
    }
    const id = `ai-${state.seed}-${++this.made}`;
    this.queue.push({ kind: 'item', rarity, id, answer: res.value, brief });
    // The icon follows; until it arrives the item shows the generic icon for its kind.
    const look = typeof res.value.iconPrompt === 'string' && res.value.iconPrompt ? res.value.iconPrompt : 'a strange object';
    const pic = await image(this.client(), { prompt: iconPrompt(look.slice(0, 200)), quality: 'low', transparent: true, purpose: `item icon (${NAMES[rarity]})` });
    if (!pic.ok) return;
    try {
      const { pixels } = await decodePixels(`data:image/png;base64,${pic.value.b64}`, pic.value.keyed, 256);
      const icon = pixelize(pixels, 16, 12);
      if (icon) INVENTED_ICONS.set(id, toCanvas(icon));
    } catch {
      // A broken image: keep the generic icon.
    }
  }

  /** Designs ready to hand to the game this step. */
  take(): AiDelivery[] {
    return this.queue.splice(0);
  }
}

const any = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/** A random design brief: what kind of item, which slot, how hard it hits, and its gimmick. */
export function pickBrief(rarity: AiRarity): ItemBrief {
  const total = BRIEF_KINDS.reduce((n, k) => n + k.weight, 0);
  let roll = Math.random() * total;
  const kind = BRIEF_KINDS.find((k) => (roll -= k.weight) < 0)?.kind ?? 'wearable';
  const g = any(BRIEF_GIMMICKS[kind]);
  const [lo, hi] = ITEM_BUDGETS[rarity].weapon;
  const brief: ItemBrief = { kind, onHit: !!g.onHit, gimmick: g.gimmick };
  if (kind === 'wearable') brief.slot = any(BRIEF_SLOTS);
  if (kind === 'weapon') brief.weaponDamage = g.damage === 'high' ? hi : g.damage === 'low' ? lo : Math.round((lo + hi) / 2);
  return brief;
}
