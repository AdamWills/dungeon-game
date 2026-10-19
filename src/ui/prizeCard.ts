// The prize card: a new item, shown big and corny on a game-show marquee,
// with the game paused until the player presses ENTER. The art is drawn at
// pixel-art resolution to match the game; small body text stays sharp.

import { ITEMS } from '../data/items';
import { UI_TEXT } from '../data/uiText';
import type { ItemInstance } from '../game/types';
import type { ItemIcons } from './itemIcons';
import { bigTitle, confetti, marquee, PALETTE, pixelLayer, popIn, starburst, sunburst } from './showbiz';
import { centered, wrapLines } from './text';

/** Per rarity: title colours, sunburst colours and the badge. */
const STYLE: Record<string, { title: string[]; rays: [string, string]; badge: string; confetti: boolean }> = {
  junk: { title: ['#f4f0e0', '#c8c0a8', '#8a8070'], rays: ['#6a5a3a', '#3a2e1e'], badge: '#8a7a5a', confetti: false },
  standard: { title: PALETTE.gold, rays: ['#ff9a2a', '#c8501a'], badge: '#e8601a', confetti: false },
  special: { title: ['#e8faff', '#38c8ff', '#1a6ae8'], rays: ['#38c8ff', '#1a3a8a'], badge: '#1a8ae8', confetti: true },
  cursed: { title: ['#f4d8ff', '#c060e0', '#6a1a8a'], rays: ['#7a2aa0', '#2a0a3a'], badge: '#7a1aa0', confetti: false },
  hosts_pick: { title: ['#fffbe0', '#ffd23a', '#ff3ea5'], rays: ['#ffd23a', '#ff3ea5'], badge: '#ff3ea5', confetti: true },
};

const BODY_FONT = 'bold 16px ui-monospace, Menlo, Consolas, monospace';

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
  const pop = popIn((now - since) / 450);
  const cw = Math.min(660, w - 32);
  const ch = Math.min(500, h - 32);
  const cx = w / 2;
  const cy = h / 2;
  const x = cx - cw / 2;
  const y = cy - ch / 2;
  const popped = (c: CanvasRenderingContext2D) => {
    c.translate(cx, cy);
    c.scale(pop, pop);
    c.translate(-cx, -cy);
  };

  ctx.fillStyle = 'rgba(8, 2, 16, 0.82)';
  ctx.fillRect(0, 0, w, h);
  pixelLayer(ctx, w, h, pixel, (l) => {
    sunburst(l, cx, cy, Math.max(w, h) * 0.6, style.rays, now);
    if (style.confetti) confetti(l, w, h, since, now);
    l.save();
    popped(l);
    marquee(l, x, y, cw, ch, now);
    bigTitle(l, T.heading, cx, y + 58, 52, { maxWidth: cw - 190 });
    starburst(l, x + cw - 56, y + 52, 70, style.badge, T.badges[def.rarity], now);
    // A stepped glow behind the prize.
    l.fillStyle = 'rgba(255, 240, 160, 0.18)';
    for (const r of [64, 48, 32]) {
      l.beginPath();
      l.arc(cx, y + 150, r, 0, Math.PI * 2);
      l.fill();
    }
    bigTitle(l, def.name.toUpperCase(), cx, y + 228, 38, { colors: style.title, maxWidth: cw - 60 });
    if (Math.floor(now / 450) % 2 === 0 || now - since < 900) {
      bigTitle(l, queued > 0 ? `${T.prompt} (${queued} MORE!)` : T.prompt, cx, y + ch - 44, 24, {
        colors: ['#ffffff', '#ff9ad0'],
        outline: '#4a0a2a',
        maxWidth: cw - 60,
      });
    }
    l.restore();
  });

  // The prize itself, at a whole-number scale so its pixels stay square.
  ctx.save();
  popped(ctx);
  const scale = Math.max(4, pixel);
  const bob = Math.round(Math.sin(now / 300) * 2) * pixel;
  ctx.imageSmoothingEnabled = false;
  icons(ctx, def.id, Math.round(cx - 8 * scale), Math.round(y + 150 - 8 * scale) + bob, scale);

  // Body text, sharp for reading.
  ctx.textBaseline = 'top';
  ctx.font = BODY_FONT;
  let yy = y + 262;
  const block = (text: string, color: string, gap: number) => {
    yy += gap;
    ctx.fillStyle = color;
    for (const line of wrapLines(ctx, text, cw - 70)) {
      centered(ctx, line, cx, yy);
      yy += 21;
    }
  };
  block(def.help, '#ffffff', 0);
  block(`"${def.description}"`, '#c8b8e0', 8);
  const hint = def.slot ? T.equipHint : def.use ? (def.use.battleOnly || def.use.target !== 'self' ? T.fightHint : T.useHint) : T.carryHint;
  block(def.cursed ? `${T.cursedHint} ${hint}` : hint, '#ffd23a', 8);
  ctx.restore();
}
