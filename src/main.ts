// Browser shell: wires keyboard, fixed-step loop, event bus and renderer.
// Everything here is DOM-side; the game logic it drives is not.

import { HAZARDS } from './data/hazards';
import { INVENTORY_CAP, ITEMS } from './data/items';
import { UI_TEXT } from './data/uiText';
import { fill } from './data/battleText';
import { EventBus } from './game/events';
import { FixedStepLoop } from './game/loop';
import { createGameState } from './game/state';
import { equipComparison } from './game/equipment';
import type { BattleCommand, GameState, InvCommand } from './game/types';
import { type Atlas, loadAtlas } from './ui/atlas';
import { BattleMenu } from './ui/battleMenu';
import { buildEnemySprites } from './ui/enemySprites';
import { Keyboard } from './ui/input';
import { InventoryMenu } from './ui/inventory';
import { Picker } from './ui/picker';
import { LevelUpMenu } from './ui/levelUp';
import { TalkMenu } from './ui/talk';
import { SceneMenu } from './ui/scene';
import { SET_PIECES, STAT_NAMES } from './data/setPieces';
import { Host } from './host/host';
import { ALLIES } from './data/allies';
import { ENEMIES } from './data/enemies';
import { buildPlayerSprites } from './ui/playerSprite';
import { Renderer, type Toast } from './ui/renderer';
import { SettingsScreen } from './ui/settings';
import { Budget } from './ai/budget';
import { loadSettings } from './ai/settings';
import { askAction } from './ai/actions';
import { ItemSupplier } from './ai/items';
import { describeError } from './ai/openai';
import { drawTypeBox, type TypeBoxState } from './ui/typeBox';
import { step } from './world/roam';

// ?seed=123 replays a run; otherwise pick one per run (outside the core).
const params = new URLSearchParams(location.search);
const fixedSeed = Number(params.get('seed')) || 0;
const randomSeed = () => Math.floor(Math.random() * 1_000_000) + 1;

const keyboard = new Keyboard(window);
const bus = new EventBus();
const menu = new BattleMenu();
const inventory = new InventoryMenu();
const picker = new Picker();
const levelUp = new LevelUpMenu();
const talk = new TalkMenu();
const scene = new SceneMenu();
const toasts: Toast[] = [];
// AI (user decision: mandatory, the player's own OpenAI key, a spending limit per run).
const settings = new SettingsScreen(loadSettings());
const budget = new Budget(settings.settings.limitUsd);
if (!settings.settings.apiKey) settings.show();
// One-of-a-kind Rare and Legendary items, designed in the background.
const supplier = new ItemSupplier(() => ({ apiKey: settings.settings.apiKey, budget }));
/** The prize card's choices: wear it now, pocket it, or leave it (user request: equip right away). */
type PrizeOption = 'wear' | 'take' | 'leave';
const prize = { offer: null as object | null, cursor: 0 };
function prizeOptions(s: GameState): PrizeOption[] {
  const def = ITEMS[s.reveals[0]?.item.defId];
  if (!def?.slot) return ['take', 'leave'];
  return equipComparison(s, def.id)?.blockedBy ? ['take', 'leave'] : ['wear', 'take', 'leave'];
}
function prizeView(s: GameState): { options: string[]; cursor: number } {
  const offer = s.reveals[0];
  const opts = prizeOptions(s);
  if (offer && offer !== prize.offer) {
    // A new card: wearing it is the default, except for cursed items (they never come off).
    prize.offer = offer;
    prize.cursor = opts[0] === 'wear' && ITEMS[offer.item.defId]?.cursed ? 1 : 0;
  }
  const P = UI_TEXT.prize;
  const label: Record<PrizeOption, string> = { wear: P.wearNow, take: opts.includes('wear') ? P.pocket : P.take, leave: P.leave };
  return { options: opts.map((o) => label[o]), cursor: Math.min(prize.cursor, opts.length - 1) };
}

/** A typed action in progress: being typed, or waiting on the AI. */
let typeBox: TypeBoxState | null = null;

/** Send a typed action to the AI; the answer becomes a recorded battle command. */
function submitTyped(text: string): void {
  const s = state;
  if (!s?.battle || !text.trim()) {
    typeBox = null;
    return;
  }
  typeBox = { phase: 'thinking', text };
  askAction({ apiKey: settings.settings.apiKey, budget }, s, text).then((res) => {
    if (state !== s || !s.battle) return void (typeBox = null);
    if (res.ok) {
      pendingCommand = { kind: 'improvise', channel: 'typed', text, answer: res.value };
      typeBox = null;
    } else {
      // Nothing was spent in the game: let them edit and try again.
      typeBox = { phase: 'typing', text, error: describeError(res.error) };
      keyboard.startTyping(text, 200);
    }
  });
}
let renderer!: Renderer;
let state: GameState | null = null;
let pendingCommand: BattleCommand | InvCommand | null = null;
const host = new Host(bus, () => state, () => performance.now());

const toast = (text: string) => toasts.push({ text, until: performance.now() + 5000 });
const itemName = (id: string) => ITEMS[id]?.name ?? id;
const T = UI_TEXT.toasts;

bus.on('floorEntered', () => renderer?.animator.reset());
bus.on('inventoryFull', () => toast(fill(T.full, { cap: INVENTORY_CAP })));
bus.on('itemEquipped', (e) => toast(fill(T.equipped, { item: itemName(e.defId) })));
bus.on('itemUsed', (e) => state?.mode !== 'battle' && toast(fill(T.used, { item: itemName(e.defId) })));
bus.on('itemRefused', (e) => toast(fill(T[e.reason], { item: itemName(e.defId) })));
bus.on('hazardHurt', (e) => {
  renderer?.notifyHurt(e.id, e.dmg, performance.now());
  if (e.id === 'player') toast(fill(T.hurt, { hazard: HAZARDS[e.kind].name, dmg: e.dmg }));
});
bus.on('corpseEaten', (e) => toast(fill(e.hp > 0 ? T.ateGood : T.ateBad, { hp: e.hp })));
bus.on('bribeShort', (e) => toast(fill(T.bribeShort, { price: e.price, tokens: e.tokens })));
bus.on('allyRecruited', (e) => toast(fill(T.joined, { name: ALLIES[e.allyId].short })));
bus.on('allyLeft', (e) => toast(fill(T.left, { name: ALLIES[e.allyId].short })));
bus.on('bossRoared', () => toast(T.roared));
bus.on('stairsSealed', (e) => toast(fill(T.sealed, { boss: ENEMIES[e.defId]?.name ?? 'the boss' })));
bus.on('bossDefeated', (e) => e.tier === 'floor' && toast(fill(T.bossDown, { name: e.name })));
bus.on('allyDismissed', (e) => toast(fill(T.dismissed, { name: ALLIES[e.allyId].short })));
bus.on('setPieceFound', (e) => toast(fill(T.found, { name: SET_PIECES[e.kind].name, help: SET_PIECES[e.kind].help })));
bus.on('boon', (e) => toast(fill(e.amount > 0 ? T.boonUp : T.boonDown, { amount: Math.abs(e.amount), stat: STAT_NAMES[e.stat] })));
bus.on('levelUp', () => {
  levelUp.cursor = 0;
});
bus.onAny((e) => console.debug('[event]', e));

function startRun(race: string, cls: string): void {
  host.reset();
  budget.reset(settings.settings.limitUsd);
  supplier.reset();
  state = createGameState(fixedSeed || randomSeed(), race, cls);
  menu.level = 'main';
  inventory.cursor = 0;
  inventory.giving = null;
  (window as unknown as { game: GameState }).game = state;
  bus.drain(state.events);
}

const loop = new FixedStepLoop(() => {
  if (!state) return;
  const frame = keyboard.sample();
  frame.command = pendingCommand;
  frame.ai = supplier.take();
  pendingCommand = null;
  step(state, frame);
  bus.drain(state.events);
});

function frame(now: number) {
  const keys = keyboard.takeMenuKeys();
  if (settings.open) {
    // The AI settings take every key; time stands still behind them.
    settings.update(keyboard);
    for (const key of keys) if (settings.handle(key, keyboard)) break;
    budget.limit = settings.settings.limitUsd;
    keyboard.clearAll();
    loop.reset();
  } else if (typeBox) {
    // Typing an action (the keyboard's text field has every key), or waiting on the AI.
    const t = keyboard.typing;
    if (typeBox.phase === 'typing' && t) {
      typeBox.text = t.value;
      if (t.done === 'submit') {
        keyboard.stopTyping();
        submitTyped(t.value);
      } else if (t.done === 'cancel') {
        keyboard.stopTyping();
        typeBox = null;
      }
    }
    if (!state?.battle) {
      keyboard.stopTyping();
      typeBox = null;
    }
  } else if (!state) {
    for (const key of keys) {
      if (key === 'settings') {
        settings.show();
        break;
      }
      const choice = picker.handle(key);
      if (choice) {
        keyboard.clearActionEdges();
        startRun(choice.race, choice.cls);
        break;
      }
    }
  } else if (renderer.bigMap) {
    // The full-screen map: its own keys, and time stands still.
    for (const key of keys) renderer.bigMapKey(key, state);
    if (keyboard.mapZoom) renderer.zoomBigMap(keyboard.mapZoom);
    keyboard.mapZoom = 0;
    keyboard.mapToggles = 0;
    if (keyboard.bigMapToggles % 2 || state.mode !== 'roaming') renderer.bigMap = null;
    keyboard.bigMapToggles = 0;
    keyboard.clearAll();
    loop.reset();
  } else if (state.mode !== 'roaming') {
    // Menu keys belong to the menu: Enter here must not also take the stairs.
    if (keys.length) keyboard.clearActionEdges();
    const s = state;
    for (const key of keys) {
      if (s.mode === 'battle') {
        pendingCommand = menu.handle(key, s) ?? pendingCommand;
        if (menu.wantsTyping) {
          menu.wantsTyping = false;
          typeBox = { phase: 'typing', text: '' };
          keyboard.startTyping('', 200);
          break;
        }
      }
      else if (s.mode === 'menu' && s.levelUp) pendingCommand = levelUp.handle(key, s) ?? pendingCommand;
      else if (s.mode === 'menu' && s.talk) pendingCommand = talk.handle(key, s) ?? pendingCommand;
      else if (s.mode === 'menu' && s.scene) pendingCommand = scene.handle(key, s) ?? pendingCommand;
      else if (s.mode === 'menu' && s.reveals.length) {
        const opts = prizeOptions(s);
        prizeView(s);
        if (key === 'up') prize.cursor = (prize.cursor + opts.length - 1) % opts.length;
        else if (key === 'down') prize.cursor = (prize.cursor + 1) % opts.length;
        else if (key === 'drop') pendingCommand = { kind: 'leave' };
        else if (key === 'confirm') {
          const o = opts[Math.min(prize.cursor, opts.length - 1)];
          pendingCommand = o === 'wear' ? { kind: 'wear' } : o === 'take' ? { kind: 'dismiss' } : { kind: 'leave' };
        }
      } else if (s.mode === 'menu' && key === 'settings') settings.show();
      else if (s.mode === 'menu') pendingCommand = inventory.handle(key, s) ?? pendingCommand;
      else if (key === 'confirm') {
        state = null; // back to the picker for a new run
        break;
      }
    }
  }
  if (keyboard.bigMapToggles) {
    if (keyboard.bigMapToggles % 2 && state?.mode === 'roaming') {
      renderer.toggleBigMap(state);
      keyboard.clearAll();
    }
    keyboard.bigMapToggles = 0;
  }
  if (keyboard.mapToggles) {
    if (keyboard.mapToggles % 2) renderer.showMap = !renderer.showMap;
    keyboard.mapToggles = 0;
  }
  if (keyboard.mapZoom) {
    renderer.zoomMap(keyboard.mapZoom);
    keyboard.mapZoom = 0;
  }
  if (state && state.mode !== 'dead' && state.mode !== 'won') supplier.tick(state, now);
  if (!renderer.bigMap && !settings.open) loop.advance(now);
  if (state) renderer.render(state, { menu, inventory, levelUp, talk, scene, host, toasts, ai: budget, prize: state.reveals.length ? prizeView(state) : { options: [], cursor: 0 } }, now);
  else renderer.renderPicker(picker, now);
  if (typeBox && state?.battle) {
    const box = typeBox;
    renderer.overlay((ctx, w, h) => drawTypeBox(ctx, w, h, box, now));
  }
  if (settings.open) renderer.overlay((ctx, w, h) => settings.draw(ctx, w, h, keyboard, now));
  if (toasts.length > 20) toasts.splice(0, toasts.length - 20);
  requestAnimationFrame(frame);
}

function start(atlas: Atlas): void {
  renderer = new Renderer(document.getElementById('game') as HTMLCanvasElement, atlas, buildPlayerSprites(), buildEnemySprites());
  requestAnimationFrame(frame);
}
loadAtlas().then(start);
