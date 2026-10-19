// Contestant registration: pick a race and a class before each run. UI only;
// the choice goes into createGameState.

import { ABILITIES } from '../data/abilities';
import { CLASSES } from '../data/classes';
import { ITEMS } from '../data/items';
import { RACES } from '../data/races';
import { UI_TEXT } from '../data/uiText';
import { computeStats } from '../game/equipment';
import type { Equipment } from '../game/types';
import type { MenuKey } from './input';
import type { PlayerSprites } from './playerSprite';
import { lowRes, NEON, panel, stage, title, TITLE_STYLE, tube } from './neon';
import { drawText, fitScale, wrapPixel } from './pixelFont';

const STORE_KEY = 'subpar-dungeon:last-contestant';

export class Picker {
  races = Object.keys(RACES);
  classes = Object.keys(CLASSES);
  race = 0;
  cls = 0;
  row: 0 | 1 = 0;

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
      if (saved) {
        this.race = Math.max(0, this.races.indexOf(saved.race));
        this.cls = Math.max(0, this.classes.indexOf(saved.cls));
      }
    } catch {
      // Storage can be unavailable; the defaults are fine.
    }
  }

  /** Returns the choice when the player confirms. */
  handle(key: MenuKey): { race: string; cls: string } | null {
    if (key === 'up' || key === 'down') this.row = this.row === 0 ? 1 : 0;
    const step = key === 'left' ? -1 : key === 'right' ? 1 : 0;
    if (step && this.row === 0) this.race = (this.race + step + this.races.length) % this.races.length;
    if (step && this.row === 1) this.cls = (this.cls + step + this.classes.length) % this.classes.length;
    if (key !== 'confirm') return null;
    const choice = { race: this.races[this.race], cls: this.classes[this.cls] };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(choice));
    } catch {
      // Not remembering is fine.
    }
    return choice;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, sprites: PlayerSprites, now: number, pixel: number): void {
    // The studio at night: the show logo in neon over the grid floor.
    const T = UI_TEXT.picker;
    const race = RACES[this.races[this.race]];
    const cls = CLASSES[this.classes[this.cls]];
    const equipment: Equipment = {};
    for (const [slot, id] of Object.entries(cls.kit)) if (id) equipment[slot as keyof Equipment] = { defId: id, identified: true };
    const s = computeStats(race.id, cls.id, equipment);
    const ability = ABILITIES[cls.ability];
    const kit = [...Object.values(cls.kit), ...cls.startingItems].map((id) => ITEMS[id!]?.name).filter(Boolean);

    lowRes(ctx, w, h, pixel, (g, lw, lh) => {
      stage(g, lw, lh, now);
      const cx = Math.round(lw / 2);
      const oy = Math.max(4, Math.floor((lh - 250) / 2));

      // The logo sign.
      const lsw = Math.min(300, lw - 8);
      panel(g, cx - lsw / 2, oy, lsw, 46, NEON.pink, NEON.cyan, now);
      title(g, T.show, cx, oy + 12, NEON.pink, fitScale(T.show, lsw - 24, 3, TITLE_STYLE));
      drawText(g, T.tagline, cx, oy + 50, { color: NEON.cyan.text, align: 'center' });
      drawText(g, T.title, cx, oy + 63, { color: NEON.gold.text, outline: '#2a0a3a', align: 'center' });
      drawText(g, T.sub, cx, oy + 75, { color: '#b090e0', align: 'center' });

      // Race and class rows; the chosen row is lit.
      let y = oy + 90;
      const rows: [string, string, number][] = [
        ['RACE', race.name, 0],
        ['CLASS', cls.name, 1],
      ];
      for (const [label, value, i] of rows) {
        const sel = this.row === i;
        g.fillStyle = '#06020e';
        g.fillRect(cx - 90, y, 180, 16);
        tube(g, cx - 90, y, 180, 16, sel ? NEON.cyan : NEON.purple, sel);
        drawText(g, label, cx - 84, y + 5, { color: sel ? NEON.cyan.text : '#6a5a8a' });
        const v = `< ${value} >`;
        drawText(g, v, cx + 22, y + 5, { bold: true, color: sel ? '#ffffff' : '#a898c8', align: 'center' });
        y += 20;
      }

      // The contestant, on a lit pad to the left of the rows.
      const px = cx - 128;
      g.fillStyle = NEON.cyan.glow;
      for (let j = -3; j <= 3; j++) {
        const half = Math.round(18 * Math.sqrt(1 - (j / 3.5) ** 2));
        g.fillRect(px - half, oy + 128 + j, half * 2 + 1, 1);
      }
      const sprite = sprites('down', 'stand', Math.floor(now / 180) % 20 === 0);
      g.drawImage(sprite, px - 24, oy + 82 + Math.round(Math.sin(now / 400)), 48, 48);

      // What you get, in plain words.
      const maxW = Math.min(lw - 24, 420);
      const lines: [string, string][] = [
        ['#ffffff', `${race.name}: ${race.help}`],
        ['#b090e0', `"${race.blurb}"`],
        ['', ''],
        ['#ffffff', `${cls.name}: ${cls.help}`],
        ['#b090e0', `"${cls.blurb}"`],
        ['', ''],
        [NEON.cyan.text, `HP ${s.maxHp}  STRENGTH ${s.str}  SPEED ${s.speed}  EVASION ${s.evasion}  ARMOR ${s.armor}  CHARM ${s.charm}`],
        [NEON.cyan.text, `Ability: ${ability ? `${ability.name}. ${ability.help}` : 'none'}`],
        [NEON.cyan.text, `Starts with: ${kit.join(', ')}`],
      ];
      const wrapped = lines.map(([c, t]) => [c, t ? wrapPixel(t, maxW) : []] as const);
      const bodyH = wrapped.reduce((n, [, ls]) => n + (ls.length ? ls.length * 9 : 3), 0);
      y = oy + 136;
      g.fillStyle = 'rgba(6, 2, 14, 1)';
      g.fillRect(cx - maxW / 2 - 8, y, maxW + 16, bodyH + 12);
      tube(g, cx - maxW / 2 - 8, y, maxW + 16, bodyH + 12, NEON.purple);
      y += 6;
      for (const [color, ls] of wrapped) {
        if (!ls.length) y += 3;
        for (const l of ls) {
          drawText(g, l, cx, y, { color, align: 'center' });
          y += 9;
        }
      }
      const keysY = Math.min(lh - 10, y + 12);
      drawText(g, T.keys, cx, keysY, { color: NEON.gold.text, align: 'center' });
    }, { minH: 260 });
  }
}
