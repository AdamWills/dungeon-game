// Conversations (user request: meeting an ally should be an exchange, not an
// instant join). Meeting a captive or a spared enemy runs its script from
// data/dialogue; choices can recruit them, pay or haggle, change loyalty,
// teach you facts about them, or send them away. Party members can also be
// chatted with from the pause screen. Time is paused while you talk.

import { ALLIES, bribePrice } from '../data/allies';
import { CHAT_CHOICES, CHATS, HAGGLE, MEETINGS, type TalkChoice, type TalkEffect } from '../data/dialogue';
import { LOYALTY } from '../data/allies';
import { changeLoyalty, recruit } from './party';
import { openLevelUp } from './progress';
import { nextFloat } from './rng';
import type { Entity, GameState, Mode } from './types';

export type Talk = {
  allyId: string;
  entityId: string;
  kind: 'meet' | 'chat';
  node: string;
  /** Bribe price for this conversation (haggling moves it). */
  price: number;
  haggled: boolean;
  /** Where to go back to when it ends. */
  returnTo: Mode;
};

function entityOf(state: GameState, t: Talk): Entity | undefined {
  return state.floor.entities.find((e) => e.id === t.entityId) ?? state.party.find((e) => e.id === t.entityId);
}

/** Start talking to an ally (a captive, a spared enemy, or a party member). */
export function startTalk(state: GameState, ally: Entity, kind: Talk['kind']): void {
  const def = ALLIES[ally.defId];
  const returnTo: Mode = state.mode === 'menu' ? 'menu' : 'roaming';
  state.talk = {
    allyId: ally.defId,
    entityId: ally.id,
    kind,
    node: kind === 'meet' ? MEETINGS[ally.defId].start : 'chat',
    price: def.recruit.kind === 'bribe' ? bribePrice(def.recruit.price, state.player.stats.charm) : 0,
    haggled: false,
    returnTo,
  };
  if (state.mode !== 'menu') {
    const from = state.mode;
    state.mode = 'menu';
    state.events.push({ type: 'modeChanged', from, to: 'menu' });
  }
}

/** What the ally says now, and the choices you have (only those you can take). */
export function talkView(state: GameState): { line: string; choices: TalkChoice[] } | null {
  const t = state.talk;
  if (!t) return null;
  const vars = (s: string) => s.replace('{price}', String(t.price)).replace('{tokens}', String(state.tokens)).replace('{name}', ALLIES[t.allyId].short);
  if (t.kind === 'chat') {
    const chat = CHATS[t.allyId];
    const loyalty = entityOf(state, t)?.ally?.loyalty ?? LOYALTY.start;
    const line = t.node === 'advice' ? chat.advice : loyalty >= 60 ? chat.high : loyalty >= LOYALTY.low ? chat.mid : chat.low;
    return {
      line,
      choices: [
        { text: CHAT_CHOICES.kind, effects: [{ kind: 'end' }] },
        { text: CHAT_CHOICES.advice, next: 'advice' },
        { text: CHAT_CHOICES.done, effects: [{ kind: 'end' }] },
      ],
    };
  }
  const node = MEETINGS[t.allyId].nodes[t.node];
  const ok = (c: TalkChoice) => !c.requires || (c.requires === 'canPay' ? state.tokens >= t.price : !t.haggled);
  return { line: vars(node.line), choices: node.choices.filter(ok).map((c) => ({ ...c, text: vars(c.text) })) };
}

/** Pick a choice by its index in talkView's list. */
export function choose(state: GameState, index: number): void {
  const t = state.talk;
  const view = talkView(state);
  const choice = view?.choices[index];
  if (!t || !choice) return;
  const ally = entityOf(state, t);
  if (!ally) return closeTalk(state);

  // Chats: a kind word helps loyalty, but only every couple of fights.
  if (t.kind === 'chat' && index === 0) {
    const mind = ally.ally!;
    if (mind.lastKindAt === undefined || state.record.fights - mind.lastKindAt >= CHAT_CHOICES.kindEvery) {
      mind.lastKindAt = state.record.fights;
      changeLoyalty(state, ally, CHAT_CHOICES.kindLoyalty);
    }
  }

  let next = choice.next;
  let close = false;
  for (const eff of choice.effects ?? []) {
    const result = apply(state, t, ally, eff);
    if (result === 'close') close = true;
    else if (result) next = result;
  }
  if (close) return closeTalk(state);
  if (next) t.node = next;
}

/** Returns 'close' to end the conversation, or a node name to jump to. */
function apply(state: GameState, t: Talk, ally: Entity, eff: TalkEffect): string | 'close' | void {
  switch (eff.kind) {
    case 'learn': {
      const known = (ally.ally!.known ??= []);
      if (!known.includes(eff.fact)) known.push(eff.fact);
      return;
    }
    case 'loyalty':
      ally.ally!.loyalty = Math.max(0, Math.min(LOYALTY.max, ally.ally!.loyalty + eff.amount));
      return;
    case 'pay':
      state.tokens -= t.price;
      return;
    case 'haggle': {
      t.haggled = true;
      const chance = Math.min(HAGGLE.max, HAGGLE.base + HAGGLE.perCharm * state.player.stats.charm);
      const win = nextFloat(state.rng) < chance;
      t.price = Math.max(1, t.price + (win ? -HAGGLE.discount : HAGGLE.surcharge));
      return win ? eff.win : eff.lose;
    }
    case 'recruit': {
      const i = state.floor.entities.indexOf(ally);
      if (i >= 0) state.floor.entities.splice(i, 1);
      recruit(state, ally, ally.ally!.joinHp);
      return 'close';
    }
    case 'dismiss': {
      const i = state.floor.entities.indexOf(ally);
      if (i >= 0) state.floor.entities.splice(i, 1);
      state.events.push({ type: 'allyDismissed', allyId: ally.defId });
      return 'close';
    }
    case 'end':
      return 'close';
  }
}

function closeTalk(state: GameState): void {
  const back = state.talk?.returnTo ?? 'roaming';
  state.talk = null;
  if (back === 'roaming' && state.mode === 'menu' && !state.levelUp && !state.reveals.length) {
    state.mode = 'roaming';
    state.events.push({ type: 'modeChanged', from: 'menu', to: 'roaming' });
  }
  openLevelUp(state);
}
