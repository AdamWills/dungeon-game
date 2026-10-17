// Keyboard sampling. The only place that reads key events; it turns them into
// one InputFrame per fixed step.

import type { Dir, InputFrame } from '../game/types';

const MOVE_KEYS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const INTERACT_KEYS = new Set(['KeyE', 'Space', 'Enter']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP']);

export class Keyboard {
  private held: Dir[] = []; // most recently pressed last
  private interactPressed = false;
  private pausePressed = false;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) {
        if (!this.held.includes(dir)) this.held.push(dir);
        e.preventDefault();
      } else if (INTERACT_KEYS.has(e.code)) {
        if (!e.repeat) this.interactPressed = true;
        e.preventDefault();
      } else if (PAUSE_KEYS.has(e.code)) {
        if (!e.repeat) this.pausePressed = true;
        e.preventDefault();
      }
    });
    target.addEventListener('keyup', (e) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) this.held = this.held.filter((d) => d !== dir);
    });
    target.addEventListener('blur', () => {
      this.held = [];
    });
  }

  /** One frame of input; edge-triggered keys are consumed. */
  sample(): InputFrame {
    const frame: InputFrame = {
      move: this.held.length ? this.held[this.held.length - 1] : null,
      interact: this.interactPressed,
      pause: this.pausePressed,
    };
    this.interactPressed = false;
    this.pausePressed = false;
    return frame;
  }
}
