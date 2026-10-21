// A set piece's scene (time is paused): its station on a glow pad, its name
// as a plain heading, what is said, and your choices. Same neon styling as
// the conversation screen. Turns key presses into InvCommands.

import { fill } from '../data/battleText';
import { UI_TEXT } from '../data/uiText';
import { sceneView } from '../game/setPieces';
import type { GameState, InvCommand } from '../game/types';
import type { MenuKey } from './input';
import { glowPad, lowRes, NEON, panel, popIn, sign } from './neon';
import { drawText, textWidth, wrapPixel } from './pixelFont';
import type { PropSprites } from './propSprites';
import type { EnemySprites } from './enemySprites';

export class SceneMenu {
  cursor = 0;
  private node = '';
  private typed = { node: '', at: 0 };

  private sync(state: GameState): void {
    const key = `${state.scene?.pieceId}/${state.scene?.node}`;
    if (key !== this.node) {
      this.node = key;
      this.cursor = 0;
    }
  }

  handle(key: MenuKey, state: GameState): InvCommand | null {
    const view = sceneView(state);
    if (!view) return null;
    this.sync(state);
    const n = view.choices.length;
    this.cursor = Math.min(this.cursor, n - 1);
    if (key === 'up') this.cursor = (this.cursor + n - 1) % n;
    else if (key === 'down') this.cursor = (this.cursor + 1) % n;
    else if (key === 'confirm') return { kind: 'say', choice: this.cursor };
    else if (key === 'back') {
      // ESC walks away, when walking away is on offer (it is always the last choice).
      const last = view.choices[n - 1];
      if (last?.effects?.length === 1 && last.effects[0].kind === 'end' && !last.next) return { kind: 'say', choice: n - 1 };
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState, props: PropSprites, creatures: EnemySprites, now: number, since: number, pixel: number): void {
    const view = sceneView(state);
    if (!view) return;
    this.sync(state);
    const T = UI_TEXT.scene;
    ctx.fillStyle = 'rgba(8, 2, 16, 0.78)';
    ctx.fillRect(0, 0, w, h);
    lowRes(ctx, w, h, pixel, (g, lw, lh) => {
      const pw = Math.min(360, lw - 8);
      const textX = 84;
      const maxW = pw - textX - 12;
      const line = wrapPixel(view.line, maxW);
      const choices = view.choices.map((c) => wrapPixel(c.text, pw - 44));
      const ph = Math.min(lh - 4, Math.max(118, 46 + Math.max(line.length * 9 + 10, 62) + choices.reduce((n, c) => n + c.length * 9 + 4, 0) + 20));
      const x = Math.round((lw - pw) / 2);
      const y = Math.round((lh - ph) / 2);
      panel(g, x, y, pw, ph, NEON.gold, NEON.pink, now);
      sign(g, view.creature ? T.creatureBadge : T.badge, x + 8, y - 10, NEON.gold, now);

      if (view.station) {
        glowPad(g, x + 44, y + 66, NEON.gold);
        const bob = Math.round(Math.sin(now / 420));
        g.drawImage(view.creature ? creatures(view.station) : props(view.station), x + 20, y + 18 + bob, 48, 48);
      }
      drawText(g, view.title, x + textX, y + 14, { bold: true, color: NEON.gold.core });
      // A creature's patience: how much more it will put up with before it fights.
      if (view.patience !== null) {
        const label = fill(T.patience, { patience: view.patience });
        const col = view.patience <= 1 ? NEON.red.text : view.patience <= 2 ? NEON.gold.core : NEON.cyan.core;
        drawText(g, label, x + pw - 12 - textWidth(label), y + 14, { color: col });
      }
      sign(g, fill(T.tokens, { tokens: state.tokens }), x + pw - 4, y - 10, NEON.pink, now, { align: 'right' });

      const key = `${state.scene?.pieceId}/${state.scene?.node}`;
      if (this.typed.node !== key) this.typed = { node: key, at: now };
      let left = Math.floor((now - this.typed.at) / 14);
      let yy = y + 28;
      for (const l of line) {
        if (left > 0) drawText(g, l.slice(0, left), x + textX, yy, { color: '#ffffff' });
        left -= l.length + 1;
        yy += 9;
      }
      yy = Math.max(yy + 10, y + 82);

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
