import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, nextU32 } from '../src/game/rng';
import { FixedStepLoop, TICK_MS } from '../src/game/loop';

describe('rng', () => {
  it('repeats for the same seed and survives a JSON round trip', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 100; i++) expect(nextU32(a)).toBe(nextU32(b));
    const c = JSON.parse(JSON.stringify(a));
    for (let i = 0; i < 100; i++) expect(nextU32(c)).toBe(nextU32(a));
  });

  it('stays in range', () => {
    const r = createRng(5);
    for (let i = 0; i < 10000; i++) {
      const f = nextFloat(r);
      expect(f >= 0 && f < 1).toBe(true);
      const n = nextInt(r, 3, 6);
      expect(n >= 3 && n <= 6).toBe(true);
    }
  });
});

describe('fixed-step loop', () => {
  it('runs 60 steps per simulated second regardless of frame times', () => {
    let steps = 0;
    const loop = new FixedStepLoop(() => steps++);
    let t = 0;
    loop.advance(t);
    const frames = [16, 17, 33, 7, 50, 16.7, 100];
    while (t < 10_000) t += frames[Math.floor(t) % frames.length], loop.advance(t);
    expect(Math.abs(steps - Math.floor(t / TICK_MS))).toBeLessThanOrEqual(1);
  });

  it('drops time after a long stall instead of catching up forever', () => {
    let steps = 0;
    const loop = new FixedStepLoop(() => steps++);
    loop.advance(0);
    loop.advance(60_000);
    expect(steps).toBeLessThanOrEqual(15);
  });
});
