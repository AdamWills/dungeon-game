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
import { bigTitle, marquee, pixelLayer, sunburst } from './showbiz';
import { centered, FONT, FONT_BIG, wrapLines } from './text';

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
    // The studio: dark stage, sweeping spotlights, the show logo on a marquee.
    const cx = w / 2;
    const lw = Math.min(560, w - 32);
    let y = 172;
    pixelLayer(ctx, w, h, pixel, (l) => {
      l.fillStyle = '#330033'; // sits exactly on the reduced palette
      l.fillRect(0, 0, w, h);
      sunburst(l, cx, 90, Math.min(w, 900) * 0.55, ['#ff3ea5', '#5a1a8a'], now);
      marquee(l, cx - lw / 2, 18, lw, 128, now, { fill: '#3a0e5a' });
      bigTitle(l, UI_TEXT.picker.show, cx, 66, 60, { tilt: -0.03, maxWidth: lw - 60 });
      bigTitle(l, UI_TEXT.picker.title, cx, y, 30, { colors: ['#ffffff', '#ff9ad0'], outline: '#4a0a2a' });
    });
    ctx.font = 'bold 15px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffd8f0';
    centered(ctx, UI_TEXT.picker.tagline, cx, 108);
    ctx.font = FONT;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c8b8e0';
    centered(ctx, UI_TEXT.picker.sub, cx, y + 22);
    y += 64;

    const race = RACES[this.races[this.race]];
    const cls = CLASSES[this.classes[this.cls]];
    const rows: [string, string, number][] = [
      ['RACE', race.name, 0],
      ['CLASS', cls.name, 1],
    ];
    for (const [label, value, i] of rows) {
      const sel = this.row === i;
      ctx.fillStyle = sel ? '#5a1a6a' : '#1e0a30';
      ctx.fillRect(cx - 220, y - 6, 440, 34);
      ctx.fillStyle = '#6f7d70';
      ctx.fillText(label, cx - 204, y + 4);
      ctx.font = FONT_BIG;
      ctx.fillStyle = sel ? '#f4ecd0' : '#c8d0c4';
      centered(ctx, `<  ${value}  >`, cx + 30, y);
      ctx.font = FONT;
      y += 44;
    }

    // Preview sprite, gently bobbing.
    const sprite = sprites('down', 'stand', Math.floor(now / 180) % 20 === 0);
    const size = 24 * 5;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, cx - 330 - size / 2, 226 + Math.round(Math.sin(now / 400) * 3), size, size);
    ctx.restore();

    // What you get, in plain words.
    const equipment: Equipment = {};
    for (const [slot, id] of Object.entries(cls.kit)) if (id) equipment[slot as keyof Equipment] = { defId: id, identified: true };
    const s = computeStats(race.id, cls.id, equipment);
    const ability = ABILITIES[cls.ability];
    const kit = [...Object.values(cls.kit), ...cls.startingItems].map((id) => ITEMS[id!]?.name).filter(Boolean);
    const lines: [string, string][] = [
      ['#c8d0c4', `${race.name}: ${race.help}`],
      ['#9aa89a', `"${race.blurb}"`],
      ['', ''],
      ['#c8d0c4', `${cls.name}: ${cls.help}`],
      ['#9aa89a', `"${cls.blurb}"`],
      ['', ''],
      ['#e8e4da', `HP ${s.maxHp}   Strength ${s.str}   Speed ${s.speed}   Evasion ${s.evasion}   Armor ${s.armor}   Charm ${s.charm}`],
      ['#e8e4da', `Ability: ${ability ? `${ability.name}. ${ability.help}` : 'none'}`],
      ['#e8e4da', `Starts with: ${kit.join(', ')}`],
    ];
    y += 12;
    const maxW = Math.min(760, w - 40);
    for (const [color, text] of lines) {
      if (!text) {
        y += 10;
        continue;
      }
      ctx.fillStyle = color;
      for (const l of wrapLines(ctx, text, maxW)) {
        centered(ctx, l, cx, y);
        y += 20;
      }
    }
    ctx.fillStyle = '#d9b310';
    centered(ctx, UI_TEXT.picker.keys, cx, Math.min(h - 40, y + 24));
  }
}
