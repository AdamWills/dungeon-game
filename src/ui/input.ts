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
const TALK_KEYS = new Set(['KeyT']);
const SETTINGS_KEYS = new Set(['KeyK']);
const MAP_KEYS = new Set(['KeyM']);
const BIG_MAP_KEYS = new Set(['Tab']);
const ZOOM_IN_KEYS = new Set(['Equal', 'NumpadAdd']);
const ZOOM_OUT_KEYS = new Set(['Minus', 'NumpadSubtract']);
const DASH_KEYS = new Set(['ShiftLeft', 'ShiftRight']);
const BACK_KEYS = new Set(['Escape', 'Backspace']);

export type MenuKey = Dir | 'confirm' | 'back' | 'drop' | 'give' | 'talk' | 'center' | 'settings';

export class Keyboard {
  private held: Dir[] = []; // most recently pressed last
  private interactPressed = false;
  private pausePressed = false;
  private dashPressed = false;
  private menu: MenuKey[] = [];
  /** Presses of the map key since last asked (a UI toggle, not game input). */
  mapToggles = 0;
  /** A text box being typed into (typed actions, the API key); while set, it takes every key. */
  typing: { value: string; max: number; done: 'submit' | 'cancel' | null } | null = null;
  /** Presses of the full-screen map key since last asked. */
  bigMapToggles = 0;
  /** Net zoom steps for the map since last asked (+ in, - out). */
  mapZoom = 0;

  constructor(target: Window) {
    target.addEventListener('keydown', (e) => {
      const t = this.typing;
      if (t) {
        if (t.done) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') return; // let the paste event through
        if (e.key === 'Enter') t.done = 'submit';
        else if (e.key === 'Escape') t.done = 'cancel';
        else if (e.key === 'Backspace') t.value = t.value.slice(0, -1);
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) t.value = (t.value + e.key).slice(0, t.max);
        e.preventDefault();
        return;
      }
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
      } else if (BIG_MAP_KEYS.has(e.code)) {
        if (!e.repeat) this.bigMapToggles++;
      } else if (e.code === 'KeyC') {
        if (!e.repeat) this.menu.push('center');
      } else if (MAP_KEYS.has(e.code)) {
        if (!e.repeat) this.mapToggles++;
      } else if (ZOOM_IN_KEYS.has(e.code) || ZOOM_OUT_KEYS.has(e.code)) {
        if (!e.repeat) this.mapZoom += ZOOM_IN_KEYS.has(e.code) ? 1 : -1;
      } else if (SETTINGS_KEYS.has(e.code)) {
        if (!e.repeat) this.menu.push('settings');
      } else if (TALK_KEYS.has(e.code)) {
        if (!e.repeat) this.menu.push('talk');
      } else if (GIVE_KEYS.has(e.code)) {
        if (!e.repeat) this.menu.push('give');
      } else if (!PAUSE_KEYS.has(e.code) && !BACK_KEYS.has(e.code)) return;
      if (PAUSE_KEYS.has(e.code) && !e.repeat) this.pausePressed = true;
      if (BACK_KEYS.has(e.code) && !e.repeat) this.menu.push('back');
      e.preventDefault();
    });
    target.addEventListener('paste', (e) => {
      const t = this.typing;
      if (!t || t.done) return;
      const text = (e as ClipboardEvent).clipboardData?.getData('text') ?? '';
      t.value = (t.value + text.replace(/\s+/g, ' ')).slice(0, t.max);
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

  /** Start typing into a text box; read `typing.done` to see when it ends. */
  startTyping(value = '', max = 200): void {
    this.typing = { value, max, done: null };
    this.held = [];
  }

  stopTyping(): void {
    this.typing = null;
    this.clearAll();
  }

  /** Forget every pending press and held key (after a screen that ate them). */
  clearAll(): void {
    this.interactPressed = false;
    this.pausePressed = false;
    this.dashPressed = false;
    this.menu = [];
  }

  /** Menu presses since the last call (battle menus, end screens). */
  takeMenuKeys(): MenuKey[] {
    return this.menu.splice(0);
  }
}
