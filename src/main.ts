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
import { buildPlayerSprites } from './ui/playerSprite';
import { Renderer, type Toast } from './ui/renderer';
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
const toasts: Toast[] = [];
let renderer!: Renderer;
let state: GameState | null = null;
let pendingCommand: BattleCommand | InvCommand | null = null;

const toast = (text: string) => toasts.push({ text, until: performance.now() + 5000 });
const itemName = (id: string) => ITEMS[id]?.name ?? id;
const T = UI_TEXT.toasts;

bus.on('floorEntered', () => renderer?.animator.reset());
bus.on('inventoryFull', () => toast(fill(T.full, { cap: INVENTORY_CAP })));
bus.on('itemEquipped', (e) => toast(fill(T.equipped, { item: itemName(e.defId) })));
bus.on('itemUsed', (e) => state?.mode !== 'battle' && toast(fill(T.used, { item: itemName(e.defId) })));
bus.on('itemRefused', (e) => toast(fill(T[e.reason], { item: itemName(e.defId) })));
bus.on('hazardHurt', (e) => e.id === 'player' && toast(fill(T.hurt, { hazard: HAZARDS[e.kind].name, dmg: e.dmg })));
bus.on('corpseEaten', (e) => toast(fill(e.hp > 0 ? T.ateGood : T.ateBad, { hp: e.hp })));
bus.onAny((e) => console.debug('[event]', e));

function startRun(race: string, cls: string): void {
  state = createGameState(fixedSeed || randomSeed(), race, cls);
  menu.level = 'main';
  inventory.cursor = 0;
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
  if (!state) {
    for (const key of keys) {
      const choice = picker.handle(key);
      if (choice) {
        keyboard.clearActionEdges();
        startRun(choice.race, choice.cls);
        break;
      }
    }
  } else if (state.mode !== 'roaming') {
    // Menu keys belong to the menu: Enter here must not also take the stairs.
    if (keys.length) keyboard.clearActionEdges();
    const s = state;
    for (const key of keys) {
      if (s.mode === 'battle') pendingCommand = menu.handle(key, s) ?? pendingCommand;
      else if (s.mode === 'menu' && s.reveals.length) {
        if (key === 'confirm') pendingCommand = { kind: 'dismiss' };
      } else if (s.mode === 'menu') pendingCommand = inventory.handle(key, s) ?? pendingCommand;
      else if (key === 'confirm') {
        state = null; // back to the picker for a new run
        break;
      }
    }
  }
  loop.advance(now);
  if (state) renderer.render(state, { menu, inventory, toasts }, now);
  else renderer.renderPicker(picker, now);
  if (toasts.length > 20) toasts.splice(0, toasts.length - 20);
  requestAnimationFrame(frame);
}

function start(atlas: Atlas): void {
  renderer = new Renderer(document.getElementById('game') as HTMLCanvasElement, atlas, buildPlayerSprites(), buildEnemySprites());
  requestAnimationFrame(frame);
}
loadAtlas().then(start);
