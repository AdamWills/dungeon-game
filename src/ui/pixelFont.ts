// A hand-made 5x7 pixel font for the game-show screens, so their words are
// built from the same chunky pixels as the map. Capitals only: text is
// upper-cased before drawing. Each glyph is 7 rows of 5 cells, '#' is ink.

export const GLYPHS: Record<string, string> = {
  A: '.###.#...##...#######...##...##...#',
  B: '####.#...##...#####.#...##...#####.',
  C: '.###.#...##....#....#....#...#.###.',
  D: '####.#...##...##...##...##...#####.',
  E: '######....#....####.#....#....#####',
  F: '######....#....####.#....#....#....',
  G: '.###.#...##....#.####...##...#.####',
  H: '#...##...##...#######...##...##...#',
  I: '.###...#....#....#....#....#...###.',
  J: '..###...#....#....#....#.#..#..##..',
  K: '#...##..#.#.#..##...#.#..#..#.#...#',
  L: '#....#....#....#....#....#....#####',
  M: '#...###.###.#.##.#.##...##...##...#',
  N: '#...##...###..##.#.##..###...##...#',
  O: '.###.#...##...##...##...##...#.###.',
  P: '####.#...##...#####.#....#....#....',
  Q: '.###.#...##...##...##.#.##..#..##.#',
  R: '####.#...##...#####.#.#..#..#.#...#',
  S: '.#####....#.....###.....#....#####.',
  T: '#####..#....#....#....#....#....#..',
  U: '#...##...##...##...##...##...#.###.',
  V: '#...##...##...##...##...#.#.#...#..',
  W: '#...##...##...##.#.##.#.###.###...#',
  X: '#...##...#.#.#...#...#.#.#...##...#',
  Y: '#...##...#.#.#...#....#....#....#..',
  Z: '#####....#...#...#...#...#....#####',
  '0': '.###.#...##..###.#.###..##...#.###.',
  '1': '..#...##....#....#....#....#...###.',
  '2': '.###.#...#....#...#...#...#...#####',
  '3': '####.....#....#.###.....#....#####.',
  '4': '...#...##..#.#.#..#.#####...#....#.',
  '5': '######....####.....#....##...#.###.',
  '6': '.###.#....#....####.#...##...#.###.',
  '7': '#####....#...#...#...#....#....#...',
  '8': '.###.#...##...#.###.#...##...#.###.',
  '9': '.###.#...##...#.####....#....#.###.',
  ' ': '...................................',
  '!': '..#....#....#....#....#.........#..',
  '?': '.###.#...#....#...#...#.........#..',
  '.': '................................#..',
  ',': '...........................#...#...',
  "'": '..#....#...#.......................',
  '"': '.#.#..#.#..........................',
  '-': '...............###.................',
  '+': '.......#....#..#####..#....#.......',
  '=': '..........#####.....#####..........',
  '*': '.....#.#.#.###.#####.###.#.#.#.....',
  '#': '.#.#..#.#.#####.#.#.#####.#.#..#.#.',
  '&': '.##..#..#.#.#...#...#.#.##..#..##.#',
  '(': '...#...#...#....#....#.....#.....#.',
  ')': '.#.....#.....#....#....#...#...#...',
  '[': '.###..#....#....#....#....#....###.',
  ']': '.###....#....#....#....#....#..###.',
  ':': '.......#..................#........',
  ';': '.......#..............#....#...#...',
  '/': '....#....#...#...#...#...#....#....',
  '%': '##..###..#...#...#...#...#..###..##',
  '<': '...#...#...#...#.....#.....#.....#.',
  '>': '.#.....#.....#.....#...#...#...#...',
  '_': '..............................#####',
};

export const GLYPH_H = 7;

export interface TextStyle {
  /** Whole-number size multiplier. */
  scale?: number;
  /** One colour, or bands from top to bottom of the letters. */
  color?: string | string[];
  /** A one-cell ring around the letters. */
  outline?: string;
  /** A solid drop shadow, down and right by one scaled cell. */
  shadow?: string;
  /** Thicker strokes, for titles. */
  bold?: boolean;
}

function advance(style: TextStyle): number {
  return 6 + (style.bold ? 1 : 0);
}

/** Width in pixels of a line drawn in this style. */
export function textWidth(text: string, style: TextStyle = {}): number {
  const s = style.scale ?? 1;
  const pad = style.outline ? 2 : 0;
  return (Math.max(1, text.length * advance(style) - 1) + pad) * s + (style.shadow ? s : 0);
}

/** Height in pixels of one line, without spacing. */
export function textHeight(style: TextStyle = {}): number {
  const s = style.scale ?? 1;
  return (GLYPH_H + (style.outline ? 2 : 0)) * s + (style.shadow ? s : 0);
}

/** Largest scale, up to `max`, at which the text fits in `maxW`. */
export function fitScale(text: string, maxW: number, max: number, style: TextStyle = {}): number {
  for (let s = max; s > 1; s--) if (textWidth(text, { ...style, scale: s }) <= maxW) return s;
  return 1;
}

/** Break text into lines no wider than `maxW` pixels. */
export function wrapPixel(text: string, maxW: number, style: TextStyle = {}): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, style) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Draw text with its top-left at (x, y); `align: 'center'` centres it on x. */
export function drawText(g: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle & { align?: 'left' | 'center' } = {}): number {
  const img = rendered(text.toUpperCase(), style);
  const left = style.align === 'center' ? Math.round(x - img.width / 2) : Math.round(x);
  g.drawImage(img, left, Math.round(y));
  return img.width;
}

function rendered(text: string, style: TextStyle): HTMLCanvasElement {
  const key = `${text}|${style.scale ?? 1}|${String(style.color)}|${style.outline}|${style.shadow}|${style.bold}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > 400) cache.clear();

  const adv = advance(style);
  const w = Math.max(1, text.length * adv - 1);
  const ink = new Uint8Array(w * GLYPH_H);
  [...text].forEach((ch, i) => {
    const glyph = GLYPHS[ch] ?? GLYPHS['?'];
    for (let r = 0; r < GLYPH_H; r++)
      for (let c = 0; c < 5; c++)
        if (glyph[r * 5 + c] === '#') {
          ink[r * w + i * adv + c] = 1;
          if (style.bold) ink[r * w + i * adv + c + 1] = 1;
        }
  });
  const on = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < w && cy < GLYPH_H && ink[cy * w + cx] === 1;
  const ring = (cx: number, cy: number) => {
    if (on(cx, cy)) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (on(cx + dx, cy + dy)) return true;
    return false;
  };

  const s = style.scale ?? 1;
  const pad = style.outline ? 1 : 0;
  const c = document.createElement('canvas');
  c.width = textWidth(text, style);
  c.height = textHeight(style);
  const g = c.getContext('2d')!;
  const paint = (dx: number, color: string, test: (cx: number, cy: number) => boolean, row?: number) => {
    g.fillStyle = color;
    for (let cy = -pad; cy < GLYPH_H + pad; cy++) {
      if (row !== undefined && cy !== row) continue;
      for (let cx = -pad; cx < w + pad; cx++) if (test(cx, cy)) g.fillRect((cx + pad) * s + dx, (cy + pad) * s + dx, s, s);
    }
  };
  if (style.shadow) paint(s, style.shadow, (cx, cy) => on(cx, cy) || (!!style.outline && ring(cx, cy)));
  if (style.outline) paint(0, style.outline, ring);
  const color = style.color ?? '#ffffff';
  if (typeof color === 'string') paint(0, color, on);
  else for (let r = 0; r < GLYPH_H; r++) paint(0, color[Math.min(color.length - 1, Math.floor((r * color.length) / GLYPH_H))], on, r);
  cache.set(key, c);
  return c;
}
