// Canvas renderer. Reads GameState, never writes it. The canvas fills the
// window; the world is drawn at a whole-number zoom so pixels stay crisp, and
// the HUD is drawn at native resolution so text stays sharp.

import { FLOOR_THEMES } from '../data/floors';
import { NOTICES } from '../data/notices';
import type { GameState } from '../game/types';
import { playerTile } from '../world/roam';
import { PlayerAnimator } from './animation';
import { type Atlas, floorVariant, TILE } from './atlas';
import type { PlayerSprites } from './playerSprite';

/** Zoom is the largest whole number that still shows at least this many tiles. */
const MIN_VIEW_TILES = { x: 18, y: 12 };
const HUD_CSS_H = 76;
const FONT = '14px ui-monospace, Menlo, Consolas, monospace';

export type HudMessage = { text: string; until: number };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private zoom = 1;
  private worldH = 0; // device pixels
  readonly animator = new PlayerAnimator();

  constructor(
    private canvas: HTMLCanvasElement,
    private atlas: Atlas,
    private playerSprites: PlayerSprites,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const { canvas } = this;
    this.dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * this.dpr);
    canvas.height = Math.round(cssH * this.dpr);
    this.worldH = canvas.height - Math.round(HUD_CSS_H * this.dpr);
    this.zoom = Math.max(
      1,
      Math.min(
        Math.floor(canvas.width / (MIN_VIEW_TILES.x * TILE)),
        Math.floor(this.worldH / (MIN_VIEW_TILES.y * TILE)),
      ),
    );
  }

  render(state: GameState, message: HudMessage | null): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    this.drawWorld(state);
    this.drawHud(state, message);
    if (state.mode === 'menu') this.drawPaused();
  }

  private drawWorld(state: GameState): void {
    const { ctx, atlas, zoom } = this;
    const { floor, player } = state;
    // Everything below is in art pixels (one tile = TILE).
    const viewW = this.canvas.width / zoom;
    const viewH = this.worldH / zoom;
    const mapW = floor.width * TILE;
    const mapH = floor.height * TILE;

    const px = Math.round(player.pos.x * TILE);
    const py = Math.round(player.pos.y * TILE);
    const camX = Math.round(mapW <= viewW ? (mapW - viewW) / 2 : clamp(px + TILE / 2 - viewW / 2, 0, mapW - viewW));
    const camY = Math.round(mapH <= viewH ? (mapH - viewH) / 2 : clamp(py + TILE / 2 - viewH / 2, 0, mapH - viewH));

    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.beginPath();
    ctx.rect(0, 0, viewW, viewH);
    ctx.clip();

    const x0 = Math.max(0, Math.floor(camX / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE));
    const x1 = Math.min(floor.width - 1, Math.floor((camX + viewW) / TILE));
    const y1 = Math.min(floor.height - 1, Math.floor((camY + viewH) / TILE));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tile = floor.tiles[y][x];
        if (!tile.explored) continue;
        const sx = x * TILE - camX;
        const sy = y * TILE - camY;
        switch (tile.terrain) {
          case 'wall': {
            const below = y + 1 < floor.height ? floor.tiles[y + 1][x].terrain : 'wall';
            atlas.draw(ctx, below === 'wall' ? 'wallTop' : 'wall', sx, sy);
            break;
          }
          case 'door':
            atlas.draw(ctx, 'door', sx, sy);
            break;
          case 'stairs':
            atlas.draw(ctx, 'stairs', sx, sy);
            break;
          default:
            atlas.draw(ctx, floorVariant(x, y), sx, sy);
        }
        if (floor.visible[y * floor.width + x] !== 1) {
          ctx.fillStyle = 'rgba(4, 6, 8, 0.62)'; // remembered, not seen
          ctx.fillRect(sx, sy, TILE, TILE);
        }
      }
    }

    this.drawPlayer(state, px - camX, py - camY);
    ctx.restore();
  }

  private drawPlayer(state: GameState, sx: number, sy: number): void {
    const { ctx } = this;
    const pose = this.animator.pose(state);

    // The shadow stays on the floor while the body bobs above it.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(sx + TILE / 2, sy + TILE - 2, 7 + pose.squash, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprite = this.playerSprites(pose.dir, pose.frame, pose.blink);
    const sqX = 1 + 0.12 * pose.squash;
    const sqY = 1 - 0.12 * pose.squash;
    ctx.save();
    // Anchor at the feet so squash and flip keep them planted.
    ctx.translate(sx + TILE / 2, sy + TILE - pose.bob);
    ctx.scale(pose.flip ? -sqX : sqX, sqY);
    ctx.drawImage(sprite, -TILE / 2, -TILE);
    ctx.restore();
  }

  private drawHud(state: GameState, message: HudMessage | null): void {
    const { ctx, dpr } = this;
    const w = this.canvas.width / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, this.worldH);
    const theme = FLOOR_THEMES[state.floor.theme];
    ctx.fillStyle = '#101412';
    ctx.fillRect(0, 0, w, HUD_CSS_H);
    ctx.fillStyle = '#3a4a3a';
    ctx.fillRect(0, 0, w, 1);
    ctx.font = FONT;
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#d9b310';
    ctx.fillText(`${theme.name.toUpperCase()}  ·  FLOOR ${state.floor.index}`, 14, 12);
    ctx.fillStyle = '#6f7d70';
    const right = `SEED ${state.seed}  ·  TICK ${state.tick}`;
    ctx.fillText(right, w - 14 - ctx.measureText(right).width, 12);

    const { x, y } = playerTile(state);
    let notice: string;
    if (message) notice = message.text;
    else if (state.floor.tiles[y][x].terrain === 'stairs') notice = NOTICES.onStairs;
    else {
      const cycle = [NOTICES.movement, NOTICES.stairs, NOTICES.pause];
      notice = cycle[Math.floor(state.tick / (60 * 6)) % cycle.length];
    }
    ctx.fillStyle = '#c8d0c4';
    wrapText(ctx, notice, 14, 36, w - 28, 18);
  }

  private drawPaused(): void {
    const { ctx, dpr } = this;
    const w = this.canvas.width / dpr;
    const h = this.worldH / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.font = FONT;
    ctx.fillStyle = '#d9b310';
    wrapCentered(ctx, NOTICES.paused, w / 2, h / 2 - 8, Math.min(w - 40, 720), 18);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  wrapLines(ctx, text, maxW).forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
}

function wrapCentered(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxW: number, lineH: number) {
  wrapLines(ctx, text, maxW).forEach((l, i) => ctx.fillText(l, cx - ctx.measureText(l).width / 2, y + i * lineH));
}
