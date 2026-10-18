// Picks the player's pose from game state: facing, walk frames, idle
// breathing, blinks and glances. Presentation only; it keeps a little memory
// of its own (when the player last moved) and never writes GameState.

import type { GameState } from '../game/types';

export type PlayerDir = 'down' | 'up' | 'side';
export type Frame = 'stand' | 'stepA' | 'stepB';

export type Pose = {
  dir: PlayerDir;
  /** Mirror the side sprite to face left. */
  flip: boolean;
  frame: Frame;
  blink: boolean;
  /** Art pixels to lift the body (walk bounce, breathing). */
  bob: number;
  /** 0..1, the little squash when a walk comes to a stop. */
  squash: number;
};

export const ANIM = {
  squashTicks: 8,
  breathPeriod: 90,
  blinkPeriod: 200,
  blinkTicks: 7,
  glanceAfter: 240, // idle ticks before the character starts looking around
  glancePeriod: 360,
  glanceTicks: 50,
};

export function facingToDir(facing: number): { dir: PlayerDir; flip: boolean } {
  const x = Math.cos(facing);
  const y = Math.sin(facing);
  if (Math.abs(x) >= Math.abs(y)) return { dir: 'side', flip: x < 0 };
  return { dir: y > 0 ? 'down' : 'up', flip: false };
}

export class PlayerAnimator {
  /** Tick the current idle spell began; null until the first pose. */
  private idleSince: number | null = null;
  /** Whether that idle spell followed a walk, so it starts with a squash. */
  private stoppedWalking = false;

  pose(state: GameState): Pose {
    const { player, tick } = state;
    let { dir, flip } = facingToDir(player.facing);
    const blink = dir !== 'up' && tick % ANIM.blinkPeriod < ANIM.blinkTicks;
    const m = player.motion;

    if (m) {
      this.idleSince = null;
      this.stoppedWalking = true;
      // Four beats per two tiles: step, pass, other step, pass.
      const firstHalf = m.tick < m.ticks / 2;
      const odd = (m.to.x + m.to.y) % 2 !== 0;
      const frame: Frame = firstHalf ? (odd ? 'stepA' : 'stepB') : 'stand';
      return { dir, flip, frame, blink, bob: frame === 'stand' ? 1 : 0, squash: 0 };
    }

    if (this.idleSince === null) this.idleSince = tick;
    const idle = tick - this.idleSince;
    const squash = this.stoppedWalking && idle < ANIM.squashTicks ? 1 - idle / ANIM.squashTicks : 0;
    const bob = Math.floor(tick / (ANIM.breathPeriod / 2)) % 2 === 0 ? 0 : 1;

    if (dir === 'down' && idle > ANIM.glanceAfter) {
      const t = (idle - ANIM.glanceAfter) % ANIM.glancePeriod;
      if (t < ANIM.glanceTicks) ({ dir, flip } = { dir: 'side', flip: false });
      else if (t >= ANIM.glancePeriod / 2 && t < ANIM.glancePeriod / 2 + ANIM.glanceTicks)
        ({ dir, flip } = { dir: 'side', flip: true });
    }
    return { dir, flip, frame: 'stand', blink, bob, squash };
  }

  /** Forget motion history, e.g. after a new floor. */
  reset(): void {
    this.idleSince = null;
    this.stoppedWalking = false;
  }
}
