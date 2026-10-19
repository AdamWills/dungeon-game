// The level-up screen (time is paused): spend points on stats, then pick a
// perk at level 3. Neon game-show styling; every row says plainly what it
// does. Turns key presses into InvCommands.

import { CLASSES } from '../data/classes';
import type { StatKey } from '../data/items';
import { PERKS } from '../data/perks';
import { TUNING } from '../data/tuning';
import { UI_TEXT } from '../data/uiText';
import { fill } from '../data/battleText';
import type { GameState, InvCommand } from '../game/types';
import type { MenuKey } from './input';
import { blink, confetti, lowRes, NEON, panel, popIn, sign, title, TITLE_STYLE } from './neon';
import { drawText, fitScale, textHeight, wrapPixel } from './pixelFont';

const STATS: { key: StatKey; name: string; stat: keyof GameState['player']['stats'] }[] = [
  { key: 'maxHp', name: 'HP', stat: 'maxHp' },
  { key: 'str', name: 'Strength', stat: 'str' },
  { key: 'speed', name: 'Speed', stat: 'speed' },
  { key: 'evasion', name: 'Evasion', stat: 'evasion' },
  { key: 'armor', name: 'Armor', stat: 'armor' },
  { key: 'charm', name: 'Charm', stat: 'charm' },
];

export class LevelUpMenu {
  cursor = 0;

  handle(key: MenuKey, state: GameState): InvCommand | null {
    const lu = state.levelUp;
    if (!lu) return null;
    const picking = lu.points === 0 && !!lu.perkChoices;
    const n = picking ? lu.perkChoices!.length : STATS.length;
    this.cursor = Math.min(this.cursor, n - 1);
    if (key === 'up') this.cursor = (this.cursor + n - 1) % n;
    else if (key === 'down') this.cursor = (this.cursor + 1) % n;
    else if (key === 'confirm') {
      if (picking) {
        const id = lu.perkChoices![this.cursor];
        this.cursor = 0;
        return { kind: 'perk', id };
      }
      return { kind: 'train', stat: STATS[this.cursor].key };
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState, now: number, since: number, pixel: number): void {
    const lu = state.levelUp!;
    const T = UI_TEXT.levelUp;
    const cls = CLASSES[state.cls];
    const picking = lu.points === 0 && !!lu.perkChoices;
    ctx.fillStyle = 'rgba(8, 2, 16, 0.78)';
    ctx.fillRect(0, 0, w, h);
    lowRes(ctx, w, h, pixel, (g, lw, lh) => {
      confetti(g, lw, lh, since, now, 40);
      const pw = Math.min(300, lw - 8);
      const ph = Math.min(lh - 4, 206);
      const x = Math.round((lw - pw) / 2);
      const y = Math.round((lh - ph) / 2);
      const cx = Math.round(lw / 2);
      panel(g, x, y, pw, ph, NEON.gold, NEON.pink, now);
      const scale = fitScale(T.title, pw - 28, 3, TITLE_STYLE);
      title(g, T.title, cx, y + 12, NEON.gold, scale);
      let yy = y + 12 + textHeight({ ...TITLE_STYLE, scale }) + 3;
      drawText(g, fill(T.sub, { level: state.level }), cx, yy, { color: NEON.pink.text, align: 'center' });
      sign(g, fill(T.badge, { level: state.level }), x + pw - 4, y - 10, NEON.pink, now, { align: 'right' });
      yy += 14;

      const maxW = pw - 30;
      const rowX = x + 20;
      if (!picking) {
        drawText(g, fill(T.points, { points: lu.points }), cx, yy, { color: '#ffffff', align: 'center' });
        yy += 13;
        STATS.forEach((s, i) => {
          const sel = i === this.cursor;
          const favored = cls.favored.includes(s.key);
          if (sel) {
            g.fillStyle = '#2a0a3a';
            g.fillRect(rowX - 4, yy - 2, maxW + 8, 11);
          }
          const value = state.player.stats[s.stat];
          drawText(g, `${sel ? '>' : ' '} ${s.name}`, rowX, yy, { color: sel ? NEON.gold.core : '#c8b8e0' });
          drawText(g, String(value), rowX + 90, yy, { color: '#ffffff' });
          const gain = TUNING.pointValue[s.key];
          drawText(g, `+${gain}${favored ? '  FAVORED' : ''}`, rowX + 120, yy, { color: favored ? NEON.green.text : '#8a7aa8' });
          yy += 12;
        });
        yy += 4;
        const help = cls.favored.includes(STATS[this.cursor].key) ? `${T.help} ${T.favored}` : T.help;
        for (const l of wrapPixel(help, maxW)) {
          drawText(g, l, cx, yy, { color: '#b090e0', align: 'center' });
          yy += 9;
        }
      } else {
        drawText(g, T.perkTitle, cx, yy, { color: '#ffffff', align: 'center' });
        yy += 14;
        lu.perkChoices!.forEach((id, i) => {
          const p = PERKS[id];
          const sel = i === this.cursor;
          const lines = wrapPixel(p.help, maxW - 8);
          if (sel) {
            g.fillStyle = '#2a0a3a';
            g.fillRect(rowX - 4, yy - 2, maxW + 8, 12 + lines.length * 9);
          }
          drawText(g, `${sel ? '>' : ' '} ${p.name}`, rowX, yy, { bold: true, color: sel ? NEON.gold.core : '#c8b8e0' });
          yy += 10;
          for (const l of lines) {
            drawText(g, l, rowX + 12, yy, { color: sel ? '#ffffff' : '#8a7aa8' });
            yy += 9;
          }
          yy += 6;
        });
      }
      if (blink(now)) drawText(g, picking ? T.perkKeys : T.keys, cx, y + ph - 20, { color: NEON.pink.core, outline: '#2a0a3a', align: 'center' });
    }, { pop: popIn((now - since) / 450), minH: 214 });
  }
}
