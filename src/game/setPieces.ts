// Set pieces on the map (data/setPieces): finding them, and running their
// scenes. A scene is a short script of lines and choices; every choice's
// effects come from the fixed list in the data, applied here with the
// engine's own rules (prices, budgets, never below 1 HP). Time is paused
// while a scene is open.

import { HAGGLE } from '../data/dialogue';
import { ITEMS, type Rarity, type StatKey } from '../data/items';
import { BET, BOON_SIZE, LEVY, PIPES, type SceneChoice, type SceneEffect, type SceneRequire, SET_PIECES, SHOP, STAT_NAMES, VALVES } from '../data/setPieces';
import { startBattle } from '../battle/turns';
import { spawnEnemy } from '../gen/populate';
import { isWalkable } from '../gen/reach';
import { tileOf } from '../world/motion';
import { owned, takeFromPool } from './aiItems';
import { addItem, refreshPlayerStats } from './equipment';
import { rollItemOf } from './loot';
import { nextFloat, nextInt } from './rng';
import type { GameState, ItemInstance, Mode, Room, SetPiece, Vec } from './types';

export type Scene = {
  pieceId: string;
  node: string;
  returnTo: Mode;
  /** Filled in by effects for the lines that follow ({stat}, {amount}, {gained}, {short}). */
  vars: Record<string, string | number>;
  /** Creatures to fight once the scene closes. */
  fight?: string[];
};

const inRoom = (r: Room, p: Vec) => p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;

/** The set piece whose station stands on this tile. */
export function stationAt(state: GameState, x: number, y: number): SetPiece | undefined {
  return state.floor.setPieces?.find((p) => p.station && p.station.x === x && p.station.y === y);
}

export function roomOf(state: GameState, piece: SetPiece): Room {
  return state.floor.rooms.find((r) => r.id === piece.room)!;
}

/** Walking into a set piece's room for the first time: Chet introduces it and the map labels it. */
export function updateSetPieces(state: GameState): void {
  const here = tileOf(state.player);
  for (const piece of state.floor.setPieces ?? []) {
    if (piece.found || !inRoom(roomOf(state, piece), here)) continue;
    piece.found = true;
    state.events.push({ type: 'setPieceFound', kind: piece.kind });
  }
}

export function startScene(state: GameState, piece: SetPiece): void {
  const def = SET_PIECES[piece.kind];
  piece.found = true;
  state.scene = { pieceId: piece.id, node: piece.done ? def.done : def.start, returnTo: 'roaming', vars: {} };
  if (state.mode !== 'menu') {
    const from = state.mode;
    state.mode = 'menu';
    state.events.push({ type: 'modeChanged', from, to: 'menu' });
  }
}

function pieceOf(state: GameState): SetPiece | undefined {
  return state.floor.setPieces?.find((p) => p.id === state.scene?.pieceId);
}

export function priceOf(piece: SetPiece, slot: number): number {
  const def = ITEMS[piece.stock![slot].defId];
  return Math.max(1, Math.round(SHOP.prices[def.rarity] * (piece.priceMult ?? 1)));
}

/** Everything a line or choice can mention. */
function varsOf(state: GameState, piece: SetPiece): Record<string, string | number> {
  const v: Record<string, string | number> = { tokens: state.tokens, bet: BET, levy: LEVY, ...state.scene?.vars };
  if (piece.patience !== undefined) v.patience = piece.patience;
  piece.stock?.forEach((s, i) => {
    v[`item${i}`] = ITEMS[s.defId].name;
    v[`price${i}`] = priceOf(piece, i);
    v[`help${i}`] = ITEMS[s.defId].help;
  });
  if (piece.answer !== undefined) v.hint = VALVES.hints[piece.answer];
  if (piece.tries !== undefined) v.tries = piece.tries;
  if (piece.picked !== undefined) v.picked = piece.picked + 1;
  if (piece.revealed !== undefined && piece.pipes) {
    v.revealed = piece.revealed + 1;
    v.revealedWhat = PIPES.peek[piece.pipes[piece.revealed] as 'tokens' | 'monster'];
    v.other = otherPipe(piece) + 1;
  }
  return v;
}

const fillVars = (text: string, v: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));

function allowed(state: GameState, piece: SetPiece, req?: SceneRequire): boolean {
  if (!req) return true;
  switch (req.kind) {
    case 'canPay':
      return state.tokens >= (req.amount === 'bet' ? BET : req.amount);
    case 'inStock':
      return !!piece.stock?.[req.slot] && !piece.stock[req.slot].sold;
    case 'notHaggled':
      return !piece.flags.includes('haggled');
    case 'noFlag':
      return !piece.flags.includes(req.flag);
    case 'hasFlag':
      return piece.flags.includes(req.flag);
    case 'hasItem':
      return state.player.inventory.length > 0;
    case 'race':
      return state.race === req.race;
    case 'cls':
      return state.cls === req.cls;
  }
}

/** The scene's heading, what is said now, and the choices you have. */
export function sceneView(state: GameState): { title: string; station: string | null; creature: boolean; patience: number | null; line: string; choices: SceneChoice[] } | null {
  const piece = pieceOf(state);
  if (!piece || !state.scene) return null;
  const def = SET_PIECES[piece.kind];
  const node = def.nodes[state.scene.node];
  const v = varsOf(state, piece);
  return {
    title: def.name,
    station: def.station,
    creature: !!def.creature,
    patience: piece.patience ?? null,
    line: fillVars(node.line, v),
    choices: node.choices.filter((c) => allowed(state, piece, c.requires)).map((c) => ({ ...c, text: fillVars(c.text, v) })),
  };
}

/** Pick a choice by its index in sceneView's list. */
export function chooseScene(state: GameState, index: number): void {
  const piece = pieceOf(state);
  const choice = sceneView(state)?.choices[index];
  if (!piece || !choice || !state.scene) return;
  let next = choice.next;
  let close = false;
  for (const eff of choice.effects ?? []) {
    const r = apply(state, piece, eff);
    if (r === 'close') close = true;
    else if (r) next = r;
  }
  if (close) return closeScene(state);
  // A creature out of patience stops talking, whatever you just said.
  const snap = snapped(piece);
  if (snap && snap !== state.scene.node) next = snap;
  if (next) enter(state, piece, next);
}

function snapped(piece: SetPiece): string | undefined {
  const def = SET_PIECES[piece.kind];
  return def.snap && piece.patience !== undefined && piece.patience <= 0 && !piece.done ? def.snap : undefined;
}

/** Go to a node, running its arrival effects (which may send you on). */
function enter(state: GameState, piece: SetPiece, node: string, depth = 0): void {
  const scene = state.scene!;
  scene.node = node;
  for (const eff of SET_PIECES[piece.kind].nodes[node].effects ?? []) {
    const r = apply(state, piece, eff);
    if (r && r !== 'close' && depth < 4) return enter(state, piece, r, depth + 1);
  }
  const snap = snapped(piece);
  if (snap && snap !== node && depth < 4) enter(state, piece, snap, depth + 1);
}

/** Returns 'close' to end the scene, or a node to go to. */
function apply(state: GameState, piece: SetPiece, eff: SceneEffect): string | 'close' | void {
  const scene = state.scene!;
  const p = state.player;
  switch (eff.kind) {
    case 'pay':
      state.tokens = Math.max(0, state.tokens - (eff.amount === 'bet' ? BET : eff.amount));
      return;
    case 'tokens': {
      const n = eff.amount === 'betWin' ? BET * 2 : nextInt(state.rng, eff.amount[0], eff.amount[1]);
      state.tokens += n;
      scene.vars.gained = n;
      state.events.push({ type: 'tokensGained', amount: n, from: 'chest' });
      return;
    }
    case 'prize':
      give(state, rollItemOf(state.rng, eff.rarities, (r) => takeFromPool(state, r), owned(state)));
      return;
    case 'heal':
      p.stats.hp = eff.amount === 'full' ? p.stats.maxHp : Math.min(p.stats.maxHp, p.stats.hp + eff.amount);
      return;
    case 'hurt':
      p.stats.hp = Math.max(1, p.stats.hp - eff.amount);
      return;
    case 'boon': {
      const stat: StatKey = eff.stat === 'random' ? (Object.keys(BOON_SIZE) as StatKey[])[nextInt(state.rng, 0, Object.keys(BOON_SIZE).length - 1)] : eff.stat;
      const amount = eff.stat === 'random' ? eff.amount * BOON_SIZE[stat] : eff.amount;
      state.boons[stat] = (state.boons[stat] ?? 0) + amount;
      refreshPlayerStats(state);
      scene.vars.stat = STAT_NAMES[stat];
      scene.vars.amount = Math.abs(amount);
      state.events.push({ type: 'boon', stat, amount });
      return;
    }
    case 'fight':
      scene.fight = [...eff.enemies];
      return;
    case 'roll': {
      const charm = p.stats.charm;
      const outcomes = eff.outcomes.map((o) => ({ node: o.node, weight: Math.max(0, o.weight + (o.perCharm ?? 0) * charm) }));
      let r = nextFloat(state.rng) * outcomes.reduce((n, o) => n + o.weight, 0);
      for (const o of outcomes) if ((r -= o.weight) < 0) return o.node;
      return outcomes[outcomes.length - 1].node;
    }
    case 'reveal':
      if (state.floor.lair) state.floor.lair.found = true;
      return;
    case 'buy': {
      const price = priceOf(piece, eff.slot);
      if (state.tokens < price) {
        scene.vars.short = price - state.tokens;
        return 'broke';
      }
      state.tokens -= price;
      piece.stock![eff.slot].sold = true;
      give(state, { defId: piece.stock![eff.slot].defId, identified: true });
      return 'bought';
    }
    case 'haggle': {
      piece.flags.push('haggled');
      const chance = Math.min(HAGGLE.max, HAGGLE.base + HAGGLE.perCharm * p.stats.charm);
      const win = nextFloat(state.rng) < chance;
      piece.priceMult = 1 + (win ? SHOP.haggleWin : SHOP.haggleLose);
      return win ? eff.win : eff.lose;
    }
    case 'pipe': {
      piece.picked = eff.pipe;
      // Chet peeks into a pipe you did not pick, and never the one with the prize.
      const peekable = [0, 1, 2].filter((i) => i !== eff.pipe && piece.pipes![i] !== 'prize');
      piece.revealed = peekable[nextInt(state.rng, 0, peekable.length - 1)];
      return 'offer';
    }
    case 'pipeFinal': {
      const final = eff.switch ? otherPipe(piece) : piece.picked!;
      return `won_${piece.pipes![final]}`;
    }
    case 'valve': {
      if (eff.valve === piece.answer) return 'right';
      piece.tries = Math.max(0, (piece.tries ?? VALVES.tries) - 1);
      return piece.tries > 0 ? 'wrong' : 'flooded';
    }
    case 'flag':
      if (!piece.flags.includes(eff.flag)) piece.flags.push(eff.flag);
      return;
    case 'patience':
      piece.patience = Math.max(0, (piece.patience ?? 0) + eff.amount);
      return;
    case 'check':
      return (piece.patience ?? 0) >= eff.patience ? eff.pass : eff.fail;
    case 'give': {
      // The least valuable thing in your pockets.
      const inv = state.player.inventory;
      if (!inv.length) return;
      let at = 0;
      inv.forEach((it, i) => {
        if (VALUE[ITEMS[it.defId].rarity] < VALUE[ITEMS[inv[at].defId].rarity]) at = i;
      });
      scene.vars.item = ITEMS[inv[at].defId].name;
      inv.splice(at, 1);
      return;
    }
    case 'leave':
      piece.station = null;
      return;
    case 'done':
      if (!piece.done) {
        piece.done = true;
        state.events.push({ type: 'setPieceDone', kind: piece.kind });
      }
      return;
    case 'end':
      return 'close';
  }
}

/** What a creature would rather be handed: junk first. */
const VALUE: Record<Rarity, number> = { junk: 0, standard: 1, cursed: 2, special: 3, hosts_pick: 4 };

function otherPipe(piece: SetPiece): number {
  return [0, 1, 2].find((i) => i !== piece.picked && i !== piece.revealed)!;
}

/** An item won or bought: onto a prize card, or at your feet if your pockets are full. */
function give(state: GameState, item: ItemInstance): void {
  const at = tileOf(state.player);
  if (!addItem(state, item, 'chest', at)) state.floor.items.push({ id: `sp-${state.tick}-${state.floor.items.length}`, pos: at, item, left: true });
}

function closeScene(state: GameState): void {
  const scene = state.scene;
  const piece = pieceOf(state);
  state.scene = null;
  if (scene?.fight?.length && piece) return popOut(state, piece, scene.fight);
  if (state.mode === 'menu' && !state.levelUp && !state.reveals.length && !state.talk) {
    state.mode = 'roaming';
    state.events.push({ type: 'modeChanged', from: 'menu', to: 'roaming' });
  }
}

/** Creatures burst out next to you, and the fight is on. */
function popOut(state: GameState, piece: SetPiece, enemies: string[]): void {
  const here = tileOf(state.player);
  const busy = new Set([
    ...state.floor.entities.map((e) => `${Math.round(e.pos.x)},${Math.round(e.pos.y)}`),
    ...state.floor.props.map((p) => `${p.pos.x},${p.pos.y}`),
    ...state.floor.chests.map((c) => `${c.pos.x},${c.pos.y}`),
    ...(state.floor.setPieces ?? []).flatMap((p) => (p.station ? [`${p.station.x},${p.station.y}`] : [])),
    `${here.x},${here.y}`,
  ]);
  const spots: Vec[] = [];
  for (let r = 1; r <= 4 && spots.length < enemies.length; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const p = { x: here.x + dx, y: here.y + dy };
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || busy.has(`${p.x},${p.y}`) || !isWalkable(state.floor, p.x, p.y) || state.floor.tiles[p.y][p.x].terrain === 'door') continue;
        if (spots.length < enemies.length) spots.push(p);
        busy.add(`${p.x},${p.y}`);
      }
  const ids = spots.map((pos, i) => {
    const e = spawnEnemy(state.floor, enemies[i], pos, state.rng, `${piece.id}-pop${i}`);
    state.floor.entities.push(e);
    return e.id;
  });
  if (!ids.length) return closeScene(state);
  startBattle(state, { enemyIds: ids, start: 'normal', tile: here });
}
