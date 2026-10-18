// The prize card: a new item, shown big and corny on a game-show marquee,
// with the game paused until the player presses ENTER.

import { ITEMS } from '../data/items';
import { UI_TEXT } from '../data/uiText';
import type { ItemInstance } from '../game/types';
import type { ItemIcons } from './itemIcons';
import { bigTitle, confetti, marquee, PALETTE, popIn, spotlights, starburst, sunburst } from './showbiz';
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
): void {
  const def = ITEMS[item.defId];
  if (!def) return;
  const T = UI_TEXT.prize;
  const style = STYLE[def.rarity];
  const t = (now - since) / 450;

  ctx.fillStyle = 'rgba(8, 2, 16, 0.82)';
  ctx.fillRect(0, 0, w, h);
  spotlights(ctx, w, h, now);

  const cw = Math.min(660, w - 32);
  const ch = Math.min(500, h - 32);
  const cx = w / 2;
  const cy = h / 2;
  sunburst(ctx, cx, cy, Math.max(w, h) * 0.6, style.rays, now);
  if (style.confetti) confetti(ctx, w, h, since, now); // behind the card, so the text stays readable

  // Pop the whole card in.
  const s = popIn(t);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);

  const x = cx - cw / 2;
  const y = cy - ch / 2;
  marquee(ctx, x, y, cw, ch, now);

  bigTitle(ctx, T.heading, cx, y + 58, 52, { maxWidth: cw - 160 });
  starburst(ctx, x + cw - 50, y + 48, 54, style.badge, T.badges[def.rarity], now);

  // The prize on a glowing pedestal.
  const glow = ctx.createRadialGradient(cx, y + 150, 4, cx, y + 150, 70);
  glow.addColorStop(0, 'rgba(255, 240, 160, 0.55)');
  glow.addColorStop(1, 'rgba(255, 240, 160, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 80, y + 80, 160, 140);
  const bob = Math.sin(now / 300) * 4;
  ctx.imageSmoothingEnabled = false;
  icons(ctx, def.id, cx - 40, y + 108 + bob, 5);

  bigTitle(ctx, def.name.toUpperCase(), cx, y + 228, 38, { colors: style.title, maxWidth: cw - 60 });

  ctx.textBaseline = 'top';
  ctx.font = BODY_FONT;
  let yy = y + 262;
  const block = (text: string, color: string, gap: number) => {
    yy += gap;
    ctx.fillStyle = color;
    for (const l of wrapLines(ctx, text, cw - 70)) {
      centered(ctx, l, cx, yy);
      yy += 21;
    }
  };
  block(def.help, '#ffffff', 0);
  block(`"${def.description}"`, '#c8b8e0', 8);
  const hint = def.slot ? T.equipHint : def.use ? (def.use.battleOnly || def.use.target !== 'self' ? T.fightHint : T.useHint) : T.carryHint;
  block(def.cursed ? `${T.cursedHint} ${hint}` : hint, '#ffd23a', 8);

  // Blinking prompt.
  if (Math.floor(now / 450) % 2 === 0 || t < 2) {
    bigTitle(ctx, queued > 0 ? `${T.prompt} (${queued} MORE!)` : T.prompt, cx, y + ch - 44, 24, {
      colors: ['#ffffff', '#ffe8f4', '#ff9ad0'],
      outline: '#4a0a2a',
      maxWidth: cw - 60,
    });
  }
  ctx.restore();
}
