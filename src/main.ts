// Browser shell: wires keyboard, fixed-step loop, event bus and renderer.
// Everything here is DOM-side; the game logic it drives is not.

import { EventBus } from './game/events';
import { FixedStepLoop } from './game/loop';
import { createGameState } from './game/state';
import type { BattleCommand, GameState } from './game/types';
import { type Atlas, loadAtlas } from './ui/atlas';
import { BattleMenu } from './ui/battleMenu';
import { buildEnemySprites } from './ui/enemySprites';
import { Keyboard } from './ui/input';
import { buildPlayerSprites } from './ui/playerSprite';
import { Renderer } from './ui/renderer';
import { step } from './world/roam';

// ?seed=123 replays a run; otherwise pick one at launch (outside the core).
const params = new URLSearchParams(location.search);
const randomSeed = () => Math.floor(Math.random() * 1_000_000) + 1;

let state: GameState = createGameState(Number(params.get('seed')) || randomSeed());
const keyboard = new Keyboard(window);
const bus = new EventBus();
const menu = new BattleMenu();
let renderer!: Renderer;

bus.on('floorEntered', () => renderer?.animator.reset());
bus.onAny((e) => console.debug('[event]', e));
bus.drain(state.events);

let pendingCommand: BattleCommand | null = null;

function newRun(): void {
  state = createGameState(randomSeed());
  (window as unknown as { game: GameState }).game = state;
  bus.drain(state.events);
}

const loop = new FixedStepLoop(() => {
  const frame = keyboard.sample();
  frame.command = pendingCommand;
  pendingCommand = null;
  step(state, frame);
  bus.drain(state.events);
});

function frame(now: number) {
  const keys = keyboard.takeMenuKeys();
  if (state.mode !== 'roaming' && state.mode !== 'menu') {
    // Menu keys belong to the menu: Enter here must not also take the stairs.
    if (keys.length) keyboard.clearActionEdges();
    for (const key of keys) {
      if (state.mode === 'battle') pendingCommand = menu.handle(key, state) ?? pendingCommand;
      else if (key === 'confirm') newRun();
    }
  }
  loop.advance(now);
  renderer.render(state, menu, now);
  requestAnimationFrame(frame);
}
function start(atlas: Atlas): void {
  renderer = new Renderer(document.getElementById('game') as HTMLCanvasElement, atlas, buildPlayerSprites(), buildEnemySprites());
  requestAnimationFrame(frame);
}
loadAtlas().then(start);

// Handy for poking at state from the console during development.
(window as unknown as { game: GameState }).game = state;
