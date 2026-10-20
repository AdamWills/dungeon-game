// The prize card: a new item, shown on a neon panel over the stage, with the
// game paused until the player presses ENTER. Drawn in pixel art, pixel font
// included, to match the game.

import { ITEMS } from '../data/items';
import { UI_TEXT } from '../data/uiText';
import { equipComparison } from '../game/equipment';
import type { GameState, ItemInstance } from '../game/types';
import type { ItemIcons } from './itemIcons';
import { confetti, glowPad, lowRes, NEON, type Neon, panel, popIn, sign, stage, title, TITLE_STYLE } from './neon';
import { drawText, fitScale, wrapPixel } from './pixelFont';
import { fill } from '../data/battleText';

/** Per rarity: the tubes, the badge sign and whether it rains confetti. A dud tube flickers. */
const STYLE: Record<string, { outer: Neon; inner: Neon; badge: Neon; confetti: boolean; flicker: boolean }> = {
  junk: { outer: NEON.dud, inner: NEON.dud, badge: NEON.dud, confetti: false, flicker: true },
  standard: { outer: NEON.pink, inner: NEON.cyan, badge: NEON.gold, confetti: false, flicker: false },
  special: { outer: NEON.cyan, inner: NEON.pink, badge: NEON.cyan, confetti: true, flicker: false },
  cursed: { outer: NEON.purple, inner: NEON.green, badge: NEON.green, confetti: false, flicker: true },
  hosts_pick: { outer: NEON.gold, inner: NEON.pink, badge: NEON.gold, confetti: true, flicker: false },
};

export function drawPrizeCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  item: ItemInstance,
  state: GameState,
  queued: number,
  icons: ItemIcons,
  now: number,
  since: number,
  pixel: number,
  choice: { options: string[]; cursor: number },
): void {
  const def = ITEMS[item.defId];
  if (!def) return;
  const T = UI_TEXT.prize;
  const style = STYLE[def.rarity];
  const minH = 210;
  lowRes(ctx, w, h, pixel, (g, lw, lh) => {
    stage(g, lw, lh, now, style.outer);
    if (style.confetti) confetti(g, lw, lh, since, now);
  }, { minH });
  lowRes(ctx, w, h, pixel, (g, lw, lh) => {
    const cw = Math.min(310, lw - 8);
    const maxW = cw - 24;
    const nameStyle = { bold: true, color: style.inner.text, outline: '#0a1a4a' };
    const hint = def.slot ? T.equipHint : def.use ? (def.use.battleOnly || def.use.target !== 'self' ? T.fightHint : T.useHint) : T.carryHint;
    // Lay the words out first so the card grows to fit them.
    // Against what you have on now, if you wore it.
    // What it replaces, and every change (or that nothing changes): user request.
    const cmp = equipComparison(state, def.id);
    const changes: [string[], string, number][] = [];
    if (cmp) {
      const where = cmp.blockedBy ? fill(T.blocked, { item: cmp.blockedBy }) : cmp.replaces ? fill(T.replaces, { item: cmp.replaces, slot: cmp.slotName }) : fill(T.emptySlot, { slot: cmp.slotName });
      changes.push([wrapPixel(where, maxW), cmp.blockedBy ? NEON.red.text : '#c8b8e0', 3]);
      for (const c of cmp.changes) {
        const better = typeof c.after === 'number' && typeof c.before === 'number' ? c.after > c.before : null;
        changes.push([[`${c.name} ${c.before} -> ${c.after}`], better === null ? NEON.cyan.text : better ? NEON.green.text : NEON.red.text, 0]);
      }
      if (!cmp.changes.length) changes.push([[T.noChanges], '#8a7aa8', 0]);
    }
    const blocks: [string[], string, number][] = [
      [wrapPixel(def.help, maxW), '#ffffff', 3],
      ...changes,
      [wrapPixel(`"${def.description}"`, maxW), '#b090e0', 3],
      // Wearable items: the choices below say it all; cursed ones keep their warning.
      ...(def.slot && !def.cursed ? [] : [[wrapPixel(def.cursed ? `${T.cursedHint} ${hint}` : hint, maxW), NEON.gold.text, 3] as [string[], string, number]]),
      [[''], '#000', 2 + choice.options.length * 11],
    ];
    const names = wrapPixel(def.name, maxW, nameStyle);
    const body = names.length * 10 + blocks.reduce((n, [lines, , gap]) => n + gap + lines.length * 9, 0);
    const ch = Math.min(lh - 4, 98 + body + 24);
    const x = Math.round((lw - cw) / 2);
    const y = Math.round((lh - ch) / 2);
    const cx = Math.round(lw / 2);
    panel(g, x, y, cw, ch, style.outer, style.inner, now, style.flicker);
    title(g, T.heading, cx, y + 12, style.outer === NEON.dud ? NEON.dud : NEON.pink, fitScale(T.heading, cw - 24, 3, TITLE_STYLE));
    glowPad(g, cx, y + 86, style.inner);
    const bob = Math.round(Math.sin(now / 300));
    icons(g, def.id, cx - 24, y + 38 + bob, 3);
    sign(g, T.badges[def.rarity], x + cw - 8, y + 44, style.badge, now, { flicker: style.flicker, align: 'right' });

    let yy = y + 96;
    for (const line of names) {
      drawText(g, line, cx, yy, { ...nameStyle, align: 'center' });
      yy += 10;
    }
    for (const [lines, color, gap] of blocks) {
      yy += gap;
      for (const line of lines) {
        drawText(g, line, cx, yy, { color, align: 'center' });
        yy += 9;
      }
    }
    {
      // The choices, then the keys. Stays on screen (no blinking).
      const top = y + ch - 24 - choice.options.length * 11;
      choice.options.forEach((o, i) => {
        const sel = i === choice.cursor;
        if (sel) {
          g.fillStyle = '#2a0a3a';
          g.fillRect(x + 30, top + i * 11 - 2, cw - 60, 10);
        }
        drawText(g, `${sel ? '> ' : '  '}${o}`, cx, top + i * 11, { color: sel ? NEON.gold.core : '#c8b8e0', align: 'center' });
      });
      const prompt = queued > 0 ? `${T.prompt} (${queued} MORE)` : T.prompt;
      drawText(g, prompt, cx, y + ch - 14, { color: NEON.pink.core, outline: '#2a0a3a', align: 'center' });
    }
  }, { minH, pop: popIn((now - since) / 450), slot: 1 });
}
