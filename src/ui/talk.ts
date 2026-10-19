// The conversation screen (time is paused): the ally on a glow pad, what they
// say, and your replies. Neon styling to match the prize card. Turns key
// presses into InvCommands.

import { ALLIES } from '../data/allies';
import { fill } from '../data/battleText';
import { UI_TEXT } from '../data/uiText';
import { talkView } from '../game/talk';
import type { GameState, InvCommand } from '../game/types';
import type { AllySprites } from './allySprites';
import type { MenuKey } from './input';
import { glowPad, lowRes, NEON, panel, popIn, sign } from './neon';
import { drawText, textWidth, wrapPixel } from './pixelFont';

export class TalkMenu {
  cursor = 0;
  /** The node the cursor belongs to; a new line puts the cursor back on top. */
  private node = '';
  /** When the current line started, for typing it out. */
  private typed = { node: '', at: 0 };

  private sync(state: GameState): void {
    const key = `${state.talk?.entityId}/${state.talk?.node}`;
    if (key !== this.node) {
      this.node = key;
      this.cursor = 0;
    }
  }

  handle(key: MenuKey, state: GameState): InvCommand | null {
    const view = talkView(state);
    if (!view) return null;
    this.sync(state);
    const n = view.choices.length;
    this.cursor = Math.min(this.cursor, n - 1);
    if (key === 'up') this.cursor = (this.cursor + n - 1) % n;
    else if (key === 'down') this.cursor = (this.cursor + 1) % n;
    else if (key === 'confirm') return { kind: 'say', choice: this.cursor };
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState, sprites: AllySprites, now: number, since: number, pixel: number): void {
    const t = state.talk!;
    const view = talkView(state);
    if (!view) return;
    this.sync(state);
    const T = UI_TEXT.talk;
    const def = ALLIES[t.allyId];
    const entity = state.party.find((e) => e.id === t.entityId) ?? state.floor.entities.find((e) => e.id === t.entityId);
    ctx.fillStyle = 'rgba(8, 2, 16, 0.78)';
    ctx.fillRect(0, 0, w, h);
    lowRes(ctx, w, h, pixel, (g, lw, lh) => {
      const pw = Math.min(330, lw - 8);
      const textX = 84;
      const maxW = pw - textX - 12;
      const line = wrapPixel(`"${view.line}"`, maxW);
      const choices = view.choices.map((c) => wrapPixel(c.text, pw - 44));
      const ph = Math.min(lh - 4, Math.max(118, 46 + Math.max(line.length * 9 + 10, 62) + choices.reduce((n, c) => n + c.length * 9 + 4, 0) + 20));
      const x = Math.round((lw - pw) / 2);
      const y = Math.round((lh - ph) / 2);
      panel(g, x, y, pw, ph, NEON.cyan, NEON.pink, now);
      sign(g, t.kind === 'meet' ? T.meet : T.chat, x + 8, y - 10, NEON.cyan, now);

      // The speaker, bobbing on a pad, with name and (for allies) loyalty.
      glowPad(g, x + 44, y + 66, NEON.pink);
      const bob = Math.round(Math.sin(now / 320));
      g.drawImage(sprites(t.allyId), x + 20, y + 18 + bob, 48, 48);
      drawText(g, def.short, x + textX, y + 14, { bold: true, color: NEON.gold.core });
      if (t.kind === 'chat' && entity?.ally) {
        const loyal = fill(T.loyalty, { loyalty: entity.ally.loyalty });
        drawText(g, loyal, x + pw - 12 - textWidth(loyal), y + 14, { color: NEON.pink.text });
      }

      // What they say, typed out.
      const key = `${t.entityId}/${t.node}`;
      if (this.typed.node !== key) this.typed = { node: key, at: now };
      let left = Math.floor((now - this.typed.at) / 18);
      let yy = y + 28;
      for (const l of line) {
        if (left > 0) drawText(g, l.slice(0, left), x + textX, yy, { color: '#ffffff' });
        left -= l.length + 1;
        yy += 9;
      }
      yy = Math.max(yy + 10, y + 82);

      // Your replies.
      choices.forEach((lines, i) => {
        const sel = i === this.cursor;
        if (sel) {
          g.fillStyle = '#2a0a3a';
          g.fillRect(x + 12, yy - 2, pw - 24, lines.length * 9 + 3);
        }
        lines.forEach((l, j) => {
          if (j === 0) drawText(g, sel ? '>' : ' ', x + 18, yy, { color: NEON.gold.core });
          drawText(g, l, x + 30, yy, { color: sel ? NEON.gold.core : '#c8b8e0' });
          yy += 9;
        });
        yy += 4;
      });
      drawText(g, T.keys, Math.round(lw / 2), y + ph - 16, { color: NEON.pink.core, outline: '#2a0a3a', align: 'center' });
    }, { pop: popIn((now - since) / 350), minH: 200 });
  }
}
