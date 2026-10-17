// Canvas renderer. Reads GameState, never writes it.

import { FLOOR_THEMES } from '../data/floors';
import { NOTICES } from '../data/notices';
import type { GameState } from '../game/types';
import { playerTile } from '../world/roam';
import { type Atlas, floorVariant, TILE } from './atlas';

export const VIEW_TILES_X = 40;
export const VIEW_TILES_Y = 24;
const HUD_H = 72;
const FONT = '13px ui-monospace, Menlo, Consolas, monospace';

export type HudMessage = { text: string; until: number };

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement, private atlas: Atlas) {
    canvas.width = VIEW_TILES_X * TILE;
    canvas.height = VIEW_TILES_Y * TILE + HUD_H;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
  }

  render(state: GameState, message: HudMessage | null): void {
    const { ctx, atlas } = this;
    const { floor, player } = state;
    const viewW = VIEW_TILES_X * TILE;
    const viewH = VIEW_TILES_Y * TILE;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Camera follows the player's fractional position, clamped to the map.
    const camX = clamp(player.pos.x * TILE + TILE / 2 - viewW / 2, 0, floor.width * TILE - viewW);
    const camY = clamp(player.pos.y * TILE + TILE / 2 - viewH / 2, 0, floor.height * TILE - viewH);
    const x0 = Math.floor(camX / TILE);
    const y0 = Math.floor(camY / TILE);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, viewW, viewH);
    ctx.clip();
    for (let y = y0; y <= y0 + VIEW_TILES_Y && y < floor.height; y++) {
      for (let x = x0; x <= x0 + VIEW_TILES_X && x < floor.width; x++) {
        const tile = floor.tiles[y][x];
        if (!tile.explored) continue;
        const sx = Math.round(x * TILE - camX);
        const sy = Math.round(y * TILE - camY);
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
    atlas.draw(ctx, 'player', Math.round(player.pos.x * TILE - camX), Math.round(player.pos.y * TILE - camY));
    ctx.restore();

    this.drawHud(state, message, viewW, viewH);
    if (state.mode === 'menu') this.drawPaused(viewW, viewH);
  }

  private drawHud(state: GameState, message: HudMessage | null, viewW: number, viewH: number): void {
    const { ctx } = this;
    const theme = FLOOR_THEMES[state.floor.theme];
    ctx.fillStyle = '#101412';
    ctx.fillRect(0, viewH, viewW, HUD_H);
    ctx.fillStyle = '#3a4a3a';
    ctx.fillRect(0, viewH, viewW, 1);
    ctx.font = FONT;
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#d9b310';
    ctx.fillText(`${theme.name.toUpperCase()}  ·  FLOOR ${state.floor.index}`, 12, viewH + 10);
    ctx.fillStyle = '#6f7d70';
    const right = `SEED ${state.seed}  ·  TICK ${state.tick}`;
    ctx.fillText(right, viewW - 12 - ctx.measureText(right).width, viewH + 10);

    const { x, y } = playerTile(state);
    let notice: string;
    if (message) notice = message.text;
    else if (state.floor.tiles[y][x].terrain === 'stairs') notice = NOTICES.onStairs;
    else {
      const cycle = [NOTICES.movement, NOTICES.stairs, NOTICES.pause];
      notice = cycle[Math.floor(state.tick / (60 * 6)) % cycle.length];
    }
    ctx.fillStyle = '#c8d0c4';
    wrapText(ctx, notice, 12, viewH + 32, viewW - 24, 17);
  }

  private drawPaused(viewW: number, viewH: number): void {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.font = FONT;
    ctx.fillStyle = '#d9b310';
    const w = ctx.measureText(NOTICES.paused).width;
    ctx.fillText(NOTICES.paused, (viewW - w) / 2, viewH / 2 - 8);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineH;
      line = word;
    } else line = next;
  }
  if (line) ctx.fillText(line, x, y);
}
