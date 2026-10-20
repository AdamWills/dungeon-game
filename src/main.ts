// Browser shell: wires keyboard, fixed-step loop, event bus and renderer.
// Everything here is DOM-side; the game logic it drives is not.

import { HAZARDS } from './data/hazards';
import { INVENTORY_CAP, ITEMS } from './data/items';
import { UI_TEXT } from './data/uiText';
import { fill } from './data/battleText';
import { EventBus } from './game/events';
import { FixedStepLoop } from './game/loop';
import { createGameState } from './game/state';
import type { BattleCommand, GameState, InvCommand } from './game/types';
import { type Atlas, loadAtlas } from './ui/atlas';
import { BattleMenu } from './ui/battleMenu';
import { buildEnemySprites } from './ui/enemySprites';
import { Keyboard } from './ui/input';
import { InventoryMenu } from './ui/inventory';
import { Picker } from './ui/picker';
import { LevelUpMenu } from './ui/levelUp';
import { TalkMenu } from './ui/talk';
import { Host } from './host/host';
import { ALLIES } from './data/allies';
import { ENEMIES } from './data/enemies';
import { buildPlayerSprites } from './ui/playerSprite';
import { Renderer, type Toast } from './ui/renderer';
import { SettingsScreen } from './ui/settings';
import { Budget } from './ai/budget';
import { loadSettings } from './ai/settings';
import { askAction } from './ai/actions';
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
const toasts: Toast[] = [];
// AI (user decision: mandatory, the player's own OpenAI key, a spending limit per run).
const settings = new SettingsScreen(loadSettings());
const budget = new Budget(settings.settings.limitUsd);
if (!settings.settings.apiKey) settings.show();
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
bus.on('levelUp', () => {
  levelUp.cursor = 0;
});
bus.onAny((e) => console.debug('[event]', e));

function startRun(race: string, cls: string): void {
  host.reset();
  budget.reset(settings.settings.limitUsd);
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
      else if (s.mode === 'menu' && s.reveals.length) {
        if (key === 'confirm') pendingCommand = { kind: 'dismiss' };
        else if (key === 'drop') pendingCommand = { kind: 'leave' };
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
  if (!renderer.bigMap && !settings.open) loop.advance(now);
  if (state) renderer.render(state, { menu, inventory, levelUp, talk, host, toasts, ai: budget }, now);
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
