// Keyboard sampling. The only place that reads key events; it turns them into
// one InputFrame per fixed step, plus a queue of menu key presses.

import type { Dir, InputFrame } from '../game/types';

const MOVE_KEYS: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const INTERACT_KEYS = new Set(['KeyE', 'Space', 'Enter']);
const PAUSE_KEYS = new Set(['Escape', 'KeyP', 'KeyI']);
const DROP_KEYS = new Set(['KeyX', 'Delete']);
const GIVE_KEYS = new Set(['KeyG']);
const MAP_KEYS = new Set(['KeyM']);
const DASH_KEYS = new Set(['ShiftLeft', 'ShiftRight']);
const BACK_KEYS = new Set(['Escape', 'Backspace']);

export type MenuKey = Dir | 'confirm' | 'back' | 'drop' | 'give';

export class Keyboard {
  private held: Dir[] = []; // most recently pressed last
  private interactPressed = false;
  private pausePressed = false;
  private dashPressed = false;
  private menu: MenuKey[] = [];
  /** Presses of the map key since last asked (a UI toggle, not game input). */
  mapToggles = 0;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      const dir = MOVE_KEYS[e.code];
      if (dir) {
        if (!this.held.includes(dir)) this.held.push(dir);
        this.menu.push(dir);
      } else if (INTERACT_KEYS.has(e.code)) {
        if (!e.repeat) {
          this.interactPressed = true;
          this.menu.push('confirm');
        }
      } else if (DASH_KEYS.has(e.code)) {
        if (!e.repeat) this.dashPressed = true;
      } else if (DROP_KEYS.has(e.code)) {
        if (!e.repeat) this.menu.push('drop');
      } else if (MAP_KEYS.has(e.code)) {
        if (!e.repeat) this.mapToggles++;
      } else if (GIVE_KEYS.has(e.code)) {
        if (!e.repeat) this.menu.push('give');
      } else if (!PAUSE_KEYS.has(e.code) && !BACK_KEYS.has(e.code)) return;
      if (PAUSE_KEYS.has(e.code) && !e.repeat) this.pausePressed = true;
      if (BACK_KEYS.has(e.code) && !e.repeat) this.menu.push('back');
      e.preventDefault();
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
      dash: this.dashPressed,
      command: null,
    };
    this.interactPressed = false;
    this.pausePressed = false;
    this.dashPressed = false;
    return frame;
  }

  /** Drop pending interact and dash presses that a menu already used. */
  clearActionEdges(): void {
    this.interactPressed = false;
    this.dashPressed = false;
  }

  /** Menu presses since the last call (battle menus, end screens). */
  takeMenuKeys(): MenuKey[] {
    return this.menu.splice(0);
  }
}
