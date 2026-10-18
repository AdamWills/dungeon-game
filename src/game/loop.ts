// Fixed-timestep driver: 60 updates per second regardless of frame rate.
// It is handed the time; it never reads a clock or touches the DOM.

export const TICKS_PER_SECOND = 60;
export const TICK_MS = 1000 / TICKS_PER_SECOND;
const MAX_STEPS_PER_ADVANCE = 15; // after a long stall, drop time instead of spiralling

export class FixedStepLoop {
  private accumulator = 0;
  private last: number | null = null;

  constructor(private readonly step: () => void) {}

  /** Advance to wall-clock time `now` (ms). Returns how many steps ran. */
  advance(now: number): number {
    if (this.last === null) {
      this.last = now;
      return 0;
    }
    this.accumulator += now - this.last;
    this.last = now;
    let steps = 0;
    while (this.accumulator >= TICK_MS && steps < MAX_STEPS_PER_ADVANCE) {
      this.step();
      this.accumulator -= TICK_MS;
      steps++;
    }
    if (steps === MAX_STEPS_PER_ADVANCE) this.accumulator = 0;
    return steps;
  }

  reset(): void {
    this.accumulator = 0;
    this.last = null;
  }
}
