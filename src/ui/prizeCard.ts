// The prize card: a new item, shown big and centred, with the game paused
// until the player presses ENTER.

import { ITEMS, RARITY_NAMES } from '../data/items';
import { UI_TEXT } from '../data/uiText';
import type { ItemInstance } from '../game/types';
import type { ItemIcons } from './itemIcons';
import { centered, FONT, FONT_BIG, wrapLines } from './text';

const RARITY_COLOR: Record<string, string> = { junk: '#a8a090', standard: '#c8d0c4', special: '#6ab0f0', cursed: '#c060e0', hosts_pick: '#f0c040' };

export function drawPrizeCard(ctx: CanvasRenderingContext2D, w: number, h: number, item: ItemInstance, queued: number, icons: ItemIcons, now: number): void {
  const def = ITEMS[item.defId];
  if (!def) return;
  const T = UI_TEXT.prize;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.fillRect(0, 0, w, h);

  const cw = Math.min(560, w - 32);
  const cx = w / 2;
  const top = Math.max(16, h / 2 - 210);
  ctx.font = FONT;
  const body: { text: string; color: string; font: string; gap?: number }[] = [
    { text: def.help, color: '#e8e4da', font: FONT },
    { text: `"${def.description}"`, color: '#9aa89a', font: FONT, gap: 10 },
    { text: def.slot ? T.equipHint : def.use ? (def.use.battleOnly || def.use.target !== 'self' ? T.fightHint : T.useHint) : T.carryHint, color: '#d9b310', font: FONT, gap: 14 },
  ];
  const lines = body.flatMap((b) => wrapLines(ctx, b.text, cw - 48).map((t, i) => ({ ...b, text: t, gap: i === 0 ? b.gap ?? 0 : 0 })));
  const ch = 230 + lines.reduce((sum, l) => sum + 20 + (l.gap ?? 0), 0);

  // The card, with a little marquee of lights around it.
  ctx.fillStyle = '#14100a';
  ctx.fillRect(cx - cw / 2, top, cw, ch);
  ctx.strokeStyle = RARITY_COLOR[def.rarity];
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - cw / 2 + 1, top + 1, cw - 2, ch - 2);
  ctx.lineWidth = 1;
  const bulbs = Math.floor(cw / 22);
  for (let i = 0; i < bulbs; i++) {
    const on = (i + Math.floor(now / 180)) % 2 === 0;
    ctx.fillStyle = on ? '#f0c040' : '#5a4a1a';
    ctx.fillRect(cx - cw / 2 + 12 + i * 22, top + 8, 5, 5);
    ctx.fillRect(cx - cw / 2 + 12 + i * 22, top + ch - 13, 5, 5);
  }

  ctx.textBaseline = 'top';
  ctx.font = FONT;
  ctx.fillStyle = '#9aa89a';
  centered(ctx, T.heading, cx, top + 26);
  icons(ctx, def.id, cx - 32, top + 50, 4);
  ctx.font = FONT_BIG;
  ctx.fillStyle = RARITY_COLOR[def.rarity];
  centered(ctx, def.name, cx, top + 122);
  ctx.font = FONT;
  ctx.fillStyle = '#6f7d70';
  centered(ctx, RARITY_NAMES[def.rarity] + (def.cursed ? ' (cursed: it will not come off once worn)' : ''), cx, top + 152);

  let y = top + 186;
  for (const l of lines) {
    y += l.gap ?? 0;
    ctx.font = l.font;
    ctx.fillStyle = l.color;
    centered(ctx, l.text, cx, y);
    y += 20;
  }
  ctx.fillStyle = '#f4ecd0';
  centered(ctx, queued > 0 ? `${T.prompt} (${queued} more)` : T.prompt, cx, top + ch - 40);
}
