import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/state';
import { type Dir, type GameState, type InputFrame, NO_INPUT } from '../src/game/types';
import { isWalkable } from '../src/gen/reach';
import { TUNING } from '../src/data/tuning';
import { createRng, nextInt, pick } from '../src/game/rng';
import { step } from '../src/world/roam';

const move = (dir: Dir): InputFrame => ({ ...NO_INPUT, move: dir });

function run(state: GameState, input: InputFrame, ticks: number) {
  for (let i = 0; i < ticks; i++) step(state, input);
}

/** A reproducible stream of held directions, interacts and pauses. */
function scriptedInputs(seed: number, ticks: number): InputFrame[] {
  const rng = createRng(seed);
  const dirs: Dir[] = ['up', 'down', 'left', 'right'];
  const frames: InputFrame[] = [];
  while (frames.length < ticks) {
    const held = nextInt(rng, 0, 4) === 0 ? null : pick(rng, dirs);
    for (let n = nextInt(rng, 5, 40); n > 0; n--) frames.push({ ...NO_INPUT, move: held });
    if (nextInt(rng, 0, 10) === 0) frames.push({ ...NO_INPUT, interact: true });
    if (nextInt(rng, 0, 30) === 0) frames.push({ ...NO_INPUT, pause: true }, NO_INPUT, { ...NO_INPUT, pause: true });
  }
  return frames.slice(0, ticks);
}

describe('roaming', () => {
  it('is deterministic for a seed and an input sequence', () => {
    const inputs = scriptedInputs(7, 3000);
    const a = createGameState(99);
    const b = createGameState(99);
    for (const f of inputs) step(a, f);
    for (const f of inputs) step(b, f);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('never leaves walkable tiles', () => {
    const state = createGameState(5);
    for (const f of scriptedInputs(3, 5000)) {
      step(state, f);
      const p = state.player.pos;
      expect(isWalkable(state.floor, Math.floor(p.x), Math.floor(p.y))).toBe(true);
      expect(isWalkable(state.floor, Math.ceil(p.x), Math.ceil(p.y))).toBe(true);
    }
  });

  it('moves one tile smoothly over the configured number of ticks', () => {
    const state = createGameState(11);
    state.floor.entities = [];
    const { x, y } = state.player.pos;
    const dir = (['right', 'left', 'down', 'up'] as Dir[]).find((d) => {
      const dx = d === 'right' ? 1 : d === 'left' ? -1 : 0;
      const dy = d === 'down' ? 1 : d === 'up' ? -1 : 0;
      return isWalkable(state.floor, x + dx, y + dy);
    })!;
    step(state, move(dir)); // starts the step
    step(state, NO_INPUT);
    const mid = state.player.pos;
    expect(mid.x === x && mid.y === y).toBe(false);
    expect(Number.isInteger(mid.x) && Number.isInteger(mid.y)).toBe(false);
    run(state, NO_INPUT, TUNING.playerTicksPerTile);
    const end = state.player.pos;
    expect(Math.abs(end.x - x) + Math.abs(end.y - y)).toBe(1);
    expect(state.player.motion).toBeUndefined();
  });

  it('stops at walls', () => {
    const state = createGameState(11);
    state.floor.entities = [];
    run(state, move('left'), 60 * 20);
    const { x, y } = state.player.pos;
    expect(Number.isInteger(x)).toBe(true);
    expect(isWalkable(state.floor, x - 1, y)).toBe(false);
  });

  it('reveals tiles around the player and keeps them explored', () => {
    const state = createGameState(21);
    const { start } = state.floor;
    expect(state.floor.visible[start.y * state.floor.width + start.x]).toBe(1);
    const explored = () => state.floor.tiles.flat().filter((t) => t.explored).length;
    const before = explored();
    expect(before).toBeGreaterThan(1);
    for (const f of scriptedInputs(4, 2000)) step(state, f);
    if (state.floor.index === 1) expect(explored()).toBeGreaterThanOrEqual(before);
  });

  it('ends the run as a win when taking the stairs', () => {
    const state = createGameState(31);
    state.floor.entities = [];
    state.player.pos = { ...state.floor.stairs };
    step(state, { ...NO_INPUT, interact: true });
    expect(state.events.map((e) => e.type)).toEqual(['floorEntered', 'stairsTaken', 'runEnded', 'modeChanged']);
    expect(state.mode).toBe('won');
    expect(state.runEnd).toEqual({ kind: 'escaped' });
  });

  it('does nothing on interact away from the stairs', () => {
    const state = createGameState(31);
    step(state, { ...NO_INPUT, interact: true });
    expect(state.mode).toBe('roaming');
  });

  it('freezes time while paused', () => {
    const state = createGameState(41);
    state.floor.entities = [];
    step(state, { ...NO_INPUT, pause: true });
    expect(state.mode).toBe('menu');
    const before = JSON.stringify(state.player);
    const tick = state.tick;
    run(state, move('right'), 120);
    expect(state.tick).toBe(tick);
    expect(JSON.stringify(state.player)).toBe(before);
    step(state, { ...NO_INPUT, pause: true });
    expect(state.mode).toBe('roaming');
  });
});
