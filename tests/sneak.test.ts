import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { NO_INPUT } from '../src/game/types';
import { step } from '../src/world/roam';
import { emptyRun, nearPlayer, spawn } from './helpers';

const AWAY = 0; // facing right, away from a player approaching from the left

describe('sneaking', () => {
  // Turncoats see all around them on purpose: they know exactly who they are after.
  for (const defId of Object.keys(ENEMIES).filter((id) => ENEMIES[id].roam.visionArcDeg < 360)) {
    it(`lets you walk up behind an awake ${defId} and strike first`, () => {
      const state = emptyRun();
      spawn(state, defId, nearPlayer(state, 2, 0), { facing: AWAY });
      for (let i = 0; i < 60 && state.mode === 'roaming'; i++) step(state, { ...NO_INPUT, move: 'right' });
      expect(state.mode).toBe('battle');
      expect(state.battle!.encounter.start).toBe('player_ambush');
    });
  }
});

describe('hearing', () => {
  it('turns toward a sound after a moment if you dawdle', () => {
    const state = emptyRun();
    const e = spawn(state, 'feral_intern', nearPlayer(state, 2, 0), { facing: AWAY });
    step(state, { ...NO_INPUT, move: 'left' }); // a footstep within earshot
    expect(e.patrol!.alert).toBe('suspicious');
    expect(e.facing).toBe(AWAY); // not yet
    for (let i = 0; i < 60; i++) step(state, NO_INPUT);
    expect(Math.cos(e.facing)).toBeLessThan(0); // now facing the player's side
  });

  it('hears a dash from further away than a walk', () => {
    const walk = emptyRun();
    const a = spawn(walk, 'grudge_gator', nearPlayer(walk, 2, 0), { facing: AWAY });
    step(walk, { ...NO_INPUT, move: 'left' });
    step(walk, { ...NO_INPUT, move: 'left' });
    const dash = emptyRun();
    const b = spawn(dash, 'grudge_gator', nearPlayer(dash, 2, 0), { facing: AWAY });
    step(dash, { ...NO_INPUT, move: 'left', dash: true });
    step(dash, { ...NO_INPUT, move: 'left' });
    expect(a.patrol!.alert).toBe('suspicious'); // 2 tiles: within walking earshot
    expect(b.patrol!.alert).toBe('suspicious');
    // 3 tiles away: beyond a gator's walking earshot (2), inside its dash earshot (4).
    for (const [s, e, d] of [[walk, a, false], [dash, b, true]] as const) {
      e.patrol!.alert = 'idle';
      s.player.motion = undefined;
      s.player.pos = { x: e.pos.x - 3, y: e.pos.y };
      s.dash.cooldown = 0;
      s.dash.active = 0;
      step(s, { ...NO_INPUT, move: 'up', dash: d });
      step(s, { ...NO_INPUT, move: 'up' });
    }
    expect(a.patrol!.alert).toBe('idle');
    expect(b.patrol!.alert).toBe('suspicious');
  });
});
