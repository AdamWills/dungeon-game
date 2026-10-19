// The prize card: a new item, shown on a neon panel over the stage, with the
// game paused until the player presses ENTER. Drawn in pixel art, pixel font
// included, to match the game.

import { ITEMS } from '../data/items';
import { UI_TEXT } from '../data/uiText';
import type { ItemInstance } from '../game/types';
import type { ItemIcons } from './itemIcons';
import { blink, confetti, glowPad, lowRes, NEON, type Neon, panel, popIn, sign, stage, title, TITLE_STYLE } from './neon';
import { drawText, fitScale, wrapPixel } from './pixelFont';

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
  queued: number,
  icons: ItemIcons,
  now: number,
  since: number,
  pixel: number,
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
    const cw = Math.min(260, lw - 8);
    const maxW = cw - 24;
    const nameStyle = { bold: true, color: style.inner.text, outline: '#0a1a4a' };
    const hint = def.slot ? T.equipHint : def.use ? (def.use.battleOnly || def.use.target !== 'self' ? T.fightHint : T.useHint) : T.carryHint;
    // Lay the words out first so the card grows to fit them.
    const blocks: [string[], string, number][] = [
      [wrapPixel(def.help, maxW), '#ffffff', 3],
      [wrapPixel(`"${def.description}"`, maxW), '#b090e0', 3],
      [wrapPixel(def.cursed ? `${T.cursedHint} ${hint}` : hint, maxW), NEON.gold.text, 3],
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
    if (blink(now) || now - since < 900) {
      const prompt = queued > 0 ? `${T.prompt} (${queued} MORE)` : T.prompt;
      drawText(g, prompt, cx, y + ch - 21, { color: NEON.pink.core, outline: '#2a0a3a', align: 'center' });
    }
  }, { minH, pop: popIn((now - since) / 450), slot: 1 });
}
