// Browser shell: wires keyboard, fixed-step loop, event bus and renderer.
// Everything here is DOM-side; the game logic it drives is not.

import { NOTICES } from './data/notices';
import { EventBus } from './game/events';
import { FixedStepLoop } from './game/loop';
import { createGameState } from './game/state';
import { buildAtlas } from './ui/atlas';
import { Keyboard } from './ui/input';
import { buildPlayerSprites } from './ui/playerSprite';
import { type HudMessage, Renderer } from './ui/renderer';
import { step } from './world/roam';

// ?seed=123 replays a floor; otherwise pick one at launch (outside the core).
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1_000_000) + 1;

const state = createGameState(seed);
const keyboard = new Keyboard(window);
const bus = new EventBus();
const renderer = new Renderer(
  document.getElementById('game') as HTMLCanvasElement,
  buildAtlas(),
  buildPlayerSprites(),
);

let message: HudMessage | null = null;
bus.on('stairsTaken', () => {
  message = { text: NOTICES.descended, until: state.tick + 60 * 5 };
});
bus.on('floorEntered', () => renderer.animator.reset());
bus.onAny((e) => console.debug('[event]', e));
bus.drain(state.events);

const loop = new FixedStepLoop(() => {
  step(state, keyboard.sample());
  bus.drain(state.events);
});

function frame(now: number) {
  loop.advance(now);
  if (message && state.tick > message.until) message = null;
  renderer.render(state, message);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at state from the console during development.
(window as unknown as { game: unknown }).game = state;
