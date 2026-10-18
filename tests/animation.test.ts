import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/state';
import { type Dir, NO_INPUT } from '../src/game/types';
import { isWalkable } from '../src/gen/reach';
import { ANIM, facingToDir, PlayerAnimator } from '../src/ui/animation';
import { step } from '../src/world/roam';

describe('player animation', () => {
  it('maps facing to sprite direction and flip', () => {
    expect(facingToDir(0)).toEqual({ dir: 'side', flip: false });
    expect(facingToDir(Math.PI)).toEqual({ dir: 'side', flip: true });
    expect(facingToDir(Math.PI / 2)).toEqual({ dir: 'down', flip: false });
    expect(facingToDir(-Math.PI / 2)).toEqual({ dir: 'up', flip: false });
  });

  it('cycles step and pass frames while walking, then squashes on stopping', () => {
    const state = createGameState(11);
    const anim = new PlayerAnimator();
    const { x, y } = state.player.pos;
    const dir = (['right', 'left', 'down', 'up'] as Dir[]).find((d) => {
      const dx = d === 'right' ? 1 : d === 'left' ? -1 : 0;
      const dy = d === 'down' ? 1 : d === 'up' ? -1 : 0;
      return isWalkable(state.floor, x + dx, y + dy);
    })!;
    const frames = new Set<string>();
    step(state, { ...NO_INPUT, move: dir });
    while (state.player.motion) {
      frames.add(anim.pose(state).frame);
      step(state, NO_INPUT);
    }
    expect(frames.has('stand')).toBe(true);
    expect(frames.has('stepA') || frames.has('stepB')).toBe(true);
    expect(anim.pose(state).squash).toBeGreaterThan(0);
    for (let i = 0; i < ANIM.squashTicks; i++) step(state, NO_INPUT);
    expect(anim.pose(state).squash).toBe(0);
  });

  it('blinks, breathes and glances around when left idle', () => {
    const state = createGameState(11);
    const anim = new PlayerAnimator();
    const seen = { blink: false, bobs: new Set<number>(), dirs: new Set<string>() };
    for (let i = 0; i < ANIM.glanceAfter + ANIM.glancePeriod; i++) {
      step(state, NO_INPUT);
      const pose = anim.pose(state);
      seen.blink ||= pose.blink;
      seen.bobs.add(pose.bob);
      seen.dirs.add(`${pose.dir}:${pose.flip}`);
    }
    expect(seen.blink).toBe(true);
    expect([...seen.bobs].sort()).toEqual([0, 1]);
    expect(seen.dirs).toEqual(new Set(['down:false', 'side:false', 'side:true']));
  });
});

describe('player animation at spawn', () => {
  it('does not squash before the player has walked', () => {
    const state = createGameState(11);
    expect(new PlayerAnimator().pose(state).squash).toBe(0);
  });
});
