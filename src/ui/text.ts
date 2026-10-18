// Canvas text helpers shared by the HUD and the battle screen.

export const FONT = '14px ui-monospace, Menlo, Consolas, monospace';
export const FONT_BIG = 'bold 22px ui-monospace, Menlo, Consolas, monospace';

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const lines = wrapLines(ctx, text, maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
  return lines.length;
}

export function centered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number): void {
  ctx.fillText(text, cx - ctx.measureText(text).width / 2, y);
}

export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frac: number, color: string): void {
  ctx.fillStyle = '#1a1414';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * Math.max(0, Math.min(1, frac)))), h - 2);
}

export const TONE_COLOR = { info: '#c8d0c4', good: '#9fd68a', bad: '#f08a7a', auditor: '#d9b310' } as const;
