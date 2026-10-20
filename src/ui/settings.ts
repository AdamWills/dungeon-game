// AI settings: the player's own OpenAI key and the spending limit per run
// (user decisions: AI is mandatory, bring your own key, default limit $5).
// Shown before the first run, and from the title or pause screen with K.

import { checkKey } from '../ai/openai';
import { type AiSettings, maskKey, saveSettings, validLimit } from '../ai/settings';
import { UI_TEXT } from '../data/uiText';
import { fill } from '../data/battleText';
import { formatUsd } from '../ai/budget';
import { lifetime, shortCount } from '../ai/log';
import type { Keyboard, MenuKey } from './input';
import { FONT, FONT_BIG, wrapText } from './text';

type Row = 'key' | 'limit' | 'done';
const ROWS: Row[] = ['key', 'limit', 'done'];

export class SettingsScreen {
  open = false;
  row = 0;
  editing: Row | null = null;
  status: { text: string; tone: 'info' | 'good' | 'bad' } | null = null;
  private checking = false;

  constructor(public settings: AiSettings) {}

  show(): void {
    this.open = true;
    this.row = this.settings.apiKey ? 2 : 0;
    this.status = null;
  }

  /** While a box is being typed into, the keyboard's text field drives it. */
  update(keyboard: Keyboard): void {
    const t = keyboard.typing;
    if (!this.editing || !t?.done) return;
    const value = t.value.trim();
    const field = this.editing;
    this.editing = null;
    keyboard.stopTyping();
    if (t.done === 'cancel') return;
    if (field === 'key') this.setKey(value);
    else {
      const n = Number(value.replace(/^\$/, ''));
      if (validLimit(n)) {
        this.settings.limitUsd = Math.round(n * 100) / 100;
        saveSettings(this.settings);
        this.status = { text: UI_TEXT.settings.limitSaved, tone: 'good' };
      } else this.status = { text: UI_TEXT.settings.limitBad, tone: 'bad' };
    }
  }

  private setKey(key: string): void {
    if (!key) return;
    this.settings.apiKey = key;
    saveSettings(this.settings);
    this.checking = true;
    this.status = { text: UI_TEXT.settings.checking, tone: 'info' };
    checkKey(key).then((res) => {
      this.checking = false;
      this.status = res.ok
        ? { text: UI_TEXT.settings.keyWorks, tone: 'good' }
        : { text: res.error.kind === 'http' && res.error.status === 401 ? UI_TEXT.settings.keyRejected : UI_TEXT.settings.keyUnchecked, tone: 'bad' };
    });
  }

  /** Returns true when the player leaves the screen. */
  handle(key: MenuKey, keyboard: Keyboard): boolean {
    if (this.editing) return false;
    if (key === 'up') this.row = (this.row + ROWS.length - 1) % ROWS.length;
    else if (key === 'down') this.row = (this.row + 1) % ROWS.length;
    else if (key === 'back' || key === 'settings') {
      if (!this.settings.apiKey) return false; // the game needs a key
      this.open = false;
      return true;
    } else if (key === 'confirm') {
      const row = ROWS[this.row];
      if (row === 'done') {
        if (!this.settings.apiKey) {
          this.status = { text: UI_TEXT.settings.needKey, tone: 'bad' };
          return false;
        }
        this.open = false;
        return true;
      }
      this.editing = row;
      keyboard.startTyping(row === 'limit' ? String(this.settings.limitUsd) : '', row === 'key' ? 300 : 8);
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, keyboard: Keyboard, now: number): void {
    const T = UI_TEXT.settings;
    ctx.fillStyle = '#06020e';
    ctx.fillRect(0, 0, w, h);
    const pw = Math.min(720, w - 32);
    const x = Math.round((w - pw) / 2);
    let y = Math.max(24, Math.round(h / 2 - 230));
    ctx.textBaseline = 'top';
    ctx.font = FONT_BIG;
    ctx.fillStyle = '#ff5ac8';
    ctx.fillText(T.title, x, y);
    y += 40;
    ctx.font = FONT;
    ctx.fillStyle = '#c8b8e0';
    y += wrapText(ctx, T.intro, x, y, pw, 20) * 20 + 14;

    const typing = this.editing ? keyboard.typing : null;
    const caret = Math.floor(now / 500) % 2 ? '_' : ' ';
    const rows: [Row, string, string][] = [
      ['key', T.keyLabel, this.editing === 'key' && typing ? '*'.repeat(Math.max(0, typing.value.length - 4)) + typing.value.slice(-4) + caret : this.settings.apiKey ? maskKey(this.settings.apiKey) : T.noKey],
      ['limit', T.limitLabel, this.editing === 'limit' && typing ? `$${typing.value}${caret}` : `$${this.settings.limitUsd.toFixed(2)}`],
      ['done', T.done, ''],
    ];
    rows.forEach(([, label, value], i) => {
      const sel = i === this.row;
      ctx.fillStyle = sel ? '#2a0a3a' : '#120a1e';
      ctx.fillRect(x, y, pw, 34);
      ctx.strokeStyle = sel ? '#38c8ff' : '#3a2a5a';
      ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, 33);
      ctx.fillStyle = sel ? '#ffd23a' : '#c8b8e0';
      ctx.fillText(`${sel ? '>' : ' '} ${label}`, x + 12, y + 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, x + 260, y + 8);
      y += 42;
    });
    y += 6;
    if (this.status) {
      ctx.fillStyle = this.status.tone === 'good' ? '#9fd68a' : this.status.tone === 'bad' ? '#ff7a5a' : '#c8b8e0';
      y += wrapText(ctx, this.checking ? T.checking : this.status.text, x, y, pw, 20) * 20 + 8;
    }
    ctx.fillStyle = '#8a7aa8';
    y += wrapText(ctx, T.privacy, x, y + 6, pw, 20) * 20 + 14;
    const all = lifetime();
    ctx.fillStyle = '#38c8ff';
    y += wrapText(ctx, fill(T.lifetime, { tokens: shortCount(all.inputTokens + all.outputTokens), usd: formatUsd(all.usd), calls: all.calls }), x, y, pw, 20) * 20 + 14;
    ctx.fillStyle = '#ff5ac8';
    wrapText(ctx, this.editing ? T.typingKeys : T.keys, x, y, pw, 20);
  }
}
