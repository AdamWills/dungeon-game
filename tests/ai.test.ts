import { TUNING } from '../src/data/tuning';
import { describe, expect, it } from 'vitest';
import { type Dir, NO_INPUT } from '../src/game/types';
import { bfsDistances, isWalkable } from '../src/gen/reach';
import { generateFloor } from '../src/gen/floor';
import { step } from '../src/world/roam';
import { emptyRun, nearPlayer, spawn } from './helpers';

const LEFT = Math.PI;
const RIGHT = 0;

describe('enemy senses', () => {
  it('spots a player inside its vision cone and gives chase', () => {
    const state = emptyRun();
    const e = spawn(state, 'feral_intern', nearPlayer(state, 3, 0), { facing: LEFT });
    step(state, NO_INPUT);
    expect(e.patrol!.alert).toBe('chasing');
    expect(state.events.some((ev) => ev.type === 'enemyAlerted')).toBe(true);
  });

  it('does not see a player behind it, but hears footsteps nearby', () => {
    const state = emptyRun();
    const e = spawn(state, 'feral_intern', nearPlayer(state, 2, 0), { facing: RIGHT });
    step(state, NO_INPUT);
    expect(e.patrol!.alert).toBe('idle');
    // Walk away from it: footsteps within hearing range make it suspicious.
    const dir: Dir = 'left';
    step(state, { ...NO_INPUT, move: dir });
    expect(e.patrol!.alert).toBe('suspicious');
  });

  it('does not see while asleep', () => {
    const state = emptyRun();
    const e = spawn(state, 'pipe_leech', nearPlayer(state, 2, 0), { facing: LEFT, asleep: true });
    step(state, NO_INPUT);
    expect(e.patrol!.alert).toBe('idle');
    expect(e.mind!.asleep).toBe(true);
  });

  it('patrols its route over walkable tiles', () => {
    const state = emptyRun(21);
    const start = nearPlayer(state, 1, 0);
    const route = [start, nearPlayer(state, 1, 1)];
    const e = spawn(state, 'sludge_hopper', start, { facing: RIGHT, route });
    state.player.pos = { ...state.floor.stairs }; // keep the player out of the way
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      step(state, NO_INPUT);
      expect(isWalkable(state.floor, Math.round(e.pos.x), Math.round(e.pos.y))).toBe(true);
      seen.add(`${Math.round(e.pos.x)},${Math.round(e.pos.y)}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('encounters (who moved decides)', () => {
  it('gives the enemy an ambush when a chaser catches you standing still', () => {
    const state = emptyRun();
    spawn(state, 'intake_rat', nearPlayer(state, 3, 0), { facing: LEFT, alert: 'chasing' });
    for (let i = 0; i < 200 && state.mode === 'roaming'; i++) step(state, NO_INPUT);
    expect(state.mode).toBe('battle');
    expect(state.battle!.encounter.start).toBe('enemy_ambush');
  });

  it('gives you an ambush when you walk into an unaware enemy', () => {
    const state = emptyRun();
    spawn(state, 'pipe_leech', nearPlayer(state, 1, 0), { facing: RIGHT });
    for (let i = 0; i < 30 && state.mode === 'roaming'; i++) step(state, { ...NO_INPUT, move: 'right' });
    expect(state.mode).toBe('battle');
    expect(state.battle!.encounter.start).toBe('player_ambush');
  });

  it('is a normal fight when you walk into an alert enemy facing you', () => {
    const state = emptyRun();
    spawn(state, 'pipe_leech', nearPlayer(state, 1, 0), { facing: LEFT, alert: 'chasing' });
    for (let i = 0; i < 30 && state.mode === 'roaming'; i++) step(state, { ...NO_INPUT, move: 'right' });
    expect(state.mode).toBe('battle');
    expect(state.battle!.encounter.start).toBe('normal');
  });

  it('pulls nearby enemies into the fight, up to the cap', () => {
    const state = emptyRun();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]])
      spawn(state, 'intake_rat', nearPlayer(state, dx, dy), { asleep: true });
    for (let i = 0; i < 30 && state.mode === 'roaming'; i++) step(state, { ...NO_INPUT, move: 'right' });
    expect(state.mode).toBe('battle');
    expect(state.battle!.encounter.enemyIds).toHaveLength(TUNING.maxEnemiesPerBattle);
  });

  it('lets a dash slip past an enemy without a fight', () => {
    const state = emptyRun();
    spawn(state, 'pipe_leech', nearPlayer(state, 1, 0), { asleep: true });
    step(state, { ...NO_INPUT, move: 'right', dash: true });
    for (let i = 0; i < 6; i++) step(state, { ...NO_INPUT, move: 'right' });
    expect(state.mode).toBe('roaming');
  });
});

describe('enemy placement', () => {
  it('keeps the start room empty and puts every enemy on its own walkable tile', () => {
    for (let seed = 1; seed < 60; seed++) {
      const floor = generateFloor(seed * 977, 1);
      const startRoom = floor.rooms.find(
        (r) => floor.start.x >= r.x1 && floor.start.x <= r.x2 && floor.start.y >= r.y1 && floor.start.y <= r.y2,
      )!;
      const seen = new Set<string>();
      expect(floor.entities.length).toBeGreaterThan(0);
      for (const e of floor.entities) {
        expect(isWalkable(floor, e.pos.x, e.pos.y)).toBe(true);
        if (e.kind !== 'enemy') continue; // captives are checked in the M4 tests
        const inStart = e.pos.x >= startRoom.x1 && e.pos.x <= startRoom.x2 && e.pos.y >= startRoom.y1 && e.pos.y <= startRoom.y2;
        expect(inStart).toBe(false);
        const k = `${e.pos.x},${e.pos.y}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
        for (const w of e.patrol!.route) expect(isWalkable(floor, w.x, w.y)).toBe(true);
      }
      expect(floor.entities.filter((e) => e.defId === 'grudge_gator').length).toBeLessThanOrEqual(2);
    }
  });
});

describe('the first floor teaches before it kills', () => {
  it('keeps tough residents deep and the rooms near the start quiet', () => {
    for (let seed = 1; seed < 40; seed++) {
      const floor = generateFloor(seed * 4243, 1);
      const dist = bfsDistances(floor, floor.start);
      const total = dist[floor.stairs.y * floor.width + floor.stairs.x];
      const depthAt = (x: number, y: number) => dist[y * floor.width + x] / total;
      const perRoom = new Map<number, number>();
      for (const e of floor.entities) {
        if (e.kind !== 'enemy' || e.defId === 'skitch') continue;
        const room = floor.rooms.find((r) => e.pos.x >= r.x1 && e.pos.x <= r.x2 && e.pos.y >= r.y1 && e.pos.y <= r.y2)!;
        const depth = depthAt(room.center.x, room.center.y);
        if (e.defId === 'grudge_gator') expect(depth).toBeGreaterThanOrEqual(0.6);
        if (e.defId === 'pipe_leech') expect(depth).toBeGreaterThanOrEqual(0.4);
        if (depth < 0.35) perRoom.set(room.id, (perRoom.get(room.id) ?? 0) + 1);
      }
      for (const n of perRoom.values()) expect(n).toBeLessThanOrEqual(1);
    }
  });
});
