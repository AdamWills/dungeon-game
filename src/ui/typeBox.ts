// The "Type anything" box over the battle screen: what you are typing, then a
// wait while the AI decides, or what went wrong. Plain text, not the host.

import { UI_TEXT } from '../data/uiText';
import { FONT, FONT_BIG, wrapLines } from './text';

export type TypeBoxState = { phase: 'typing' | 'thinking'; text: string; error?: string };

export function drawTypeBox(ctx: CanvasRenderingContext2D, w: number, h: number, box: TypeBoxState, now: number): void {
  const H = UI_TEXT.help;
  const bw = Math.min(760, w - 32);
  const x = Math.round((w - bw) / 2);
  ctx.font = FONT;
  const caret = box.phase === 'typing' && Math.floor(now / 500) % 2 ? '_' : '';
  const lines = wrapLines(ctx, `${box.text}${caret}` || ' ', bw - 32);
  const extra = box.error ? wrapLines(ctx, box.error, bw - 32) : [];
  const bh = 74 + lines.length * 20 + extra.length * 20 + 24;
  const y = Math.round(h - bh - 24);
  ctx.fillStyle = 'rgba(6, 2, 14, 0.94)';
  ctx.fillRect(x, y, bw, bh);
  ctx.strokeStyle = box.phase === 'thinking' ? '#ffd23a' : '#ff5ac8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
  ctx.textBaseline = 'top';
  ctx.font = FONT_BIG;
  ctx.fillStyle = '#ff5ac8';
  ctx.fillText(H.typing, x + 16, y + 12);
  ctx.font = FONT;
  ctx.fillStyle = '#ffffff';
  lines.forEach((l, i) => ctx.fillText(l, x + 16, y + 48 + i * 20));
  let yy = y + 48 + lines.length * 20 + 8;
  ctx.fillStyle = '#ff7a5a';
  for (const l of extra) {
    ctx.fillText(l, x + 16, yy);
    yy += 20;
  }
  ctx.fillStyle = box.phase === 'thinking' ? '#ffd23a' : '#c8b8e0';
  const dots = '.'.repeat(1 + (Math.floor(now / 300) % 3));
  ctx.fillText(box.phase === 'thinking' ? H.thinking.replace('...', dots) : H.typingKeys, x + 16, yy + 4);
}
