// Canvas renderer. Reads GameState, never writes it. The canvas fills the
// window; the map is drawn at a whole-number zoom so pixels stay crisp, and
// text is drawn at native resolution so it stays sharp.

import { CLASSES } from '../data/classes';
import { FLOOR_THEMES } from '../data/floors';
import { NOTICES } from '../data/notices';
import { TUNING } from '../data/tuning';
import { UI_TEXT } from '../data/uiText';
import { canSee } from '../game/ai';
import type { Entity, GameState } from '../game/types';
import { playerTile } from '../world/roam';
import { PlayerAnimator } from './animation';
import { type Atlas, SPRITE, TILE } from './atlas';
import type { BattleMenu } from './battleMenu';
import { BattleView } from './battleView';
import type { EnemySprites } from './enemySprites';
import type { PlayerSprites } from './playerSprite';
import { floorVariant, MAP_SPRITES, wallFaceVariant } from './tileset';
import { bar, centered, FONT, FONT_BIG, wrapText } from './text';

/** Zoom is the largest whole number that still shows at least this many tiles. */
const MIN_VIEW_TILES = { x: 22, y: 13 };
const HUD_CSS_H = 76;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private zoom = 1;
  private worldH = 0; // device pixels
  readonly animator = new PlayerAnimator();
  private battleView: BattleView;

  constructor(
    private canvas: HTMLCanvasElement,
    private atlas: Atlas,
    private playerSprites: PlayerSprites,
    private enemySprites: EnemySprites,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.battleView = new BattleView(playerSprites, enemySprites, (ctx, x, y) => atlas.draw(ctx, floorVariant(x, y), 0, 0));
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
      Math.min(Math.floor(canvas.width / (MIN_VIEW_TILES.x * TILE)), Math.floor(this.worldH / (MIN_VIEW_TILES.y * TILE))),
    );
  }

  render(state: GameState, menu: BattleMenu, now: number): void {
    const { ctx, canvas, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (state.battle) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.battleView.draw(ctx, canvas.width / dpr, canvas.height / dpr, state, menu, now);
      return;
    }
    this.drawWorld(state);
    this.drawHud(state);
    if (state.mode === 'menu') this.drawOverlay([NOTICES.paused], '#d9b310');
    if (state.mode === 'dead' || state.mode === 'won') this.drawRunEnd(state);
  }

  // --- map ------------------------------------------------------------------

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
    const visible = (x: number, y: number) => floor.visible[y * floor.width + x] === 1;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tile = floor.tiles[y][x];
        if (!tile.explored) continue;
        const sx = x * TILE - camX;
        const sy = y * TILE - camY;
        switch (tile.terrain) {
          case 'wall':
            this.drawWall(floor, x, y, sx, sy);
            break;
          case 'stairs':
            atlas.draw(ctx, MAP_SPRITES.stairs, sx, sy);
            break;
          default: // floor, and doors (open archways for now)
            atlas.draw(ctx, floorVariant(x, y), sx, sy);
            if (y > 0 && floor.tiles[y - 1][x].terrain === 'wall' && wallFaceVariant(x, y - 1) === 'goo' && isFace(floor, x, y - 1))
              atlas.draw(ctx, MAP_SPRITES.wallGooBase, sx, sy);
        }
        for (let i = 0; i < tile.gore.length; i++) drawGore(ctx, tile.gore[i].kind, sx, sy, x * 31 + y * 17 + i);
      }
    }

    // Vision cones of enemies you can see, so sneaking is readable.
    const seen = floor.entities.filter((e) => e.kind === 'enemy' && visible(Math.round(e.pos.x), Math.round(e.pos.y)));
    for (const e of seen) {
      if (e.mind!.asleep || e.patrol!.alert === 'chasing') continue;
      const r = Math.ceil(e.patrol!.visionRange);
      ctx.fillStyle = e.patrol!.alert === 'suspicious' ? 'rgba(255, 170, 40, 0.16)' : 'rgba(255, 70, 50, 0.11)';
      for (let ty = Math.round(e.pos.y) - r; ty <= Math.round(e.pos.y) + r; ty++)
        for (let tx = Math.round(e.pos.x) - r; tx <= Math.round(e.pos.x) + r; tx++) {
          if (ty < 0 || tx < 0 || ty >= floor.height || tx >= floor.width) continue;
          if (!visible(tx, ty) || floor.tiles[ty][tx].terrain === 'wall') continue;
          if (canSee(state, e, { x: tx, y: ty })) ctx.fillRect(tx * TILE - camX, ty * TILE - camY, TILE, TILE);
        }
    }

    // Fog over remembered-but-not-visible tiles.
    ctx.fillStyle = 'rgba(4, 6, 8, 0.62)';
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (floor.tiles[y][x].explored && !visible(x, y)) ctx.fillRect(x * TILE - camX, y * TILE - camY, TILE, TILE);

    // Entities, back to front.
    const actors: { y: number; draw: () => void }[] = seen.map((e) => ({
      y: e.pos.y,
      draw: () => this.drawEnemy(state, e, Math.round(e.pos.x * TILE) - camX, Math.round(e.pos.y * TILE) - camY),
    }));
    actors.push({ y: player.pos.y, draw: () => this.drawPlayer(state, px - camX, py - camY) });
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());
    ctx.restore();
  }

  /**
   * 0x72-style walls: a brick face where floor lies below, a stone rim on top
   * of each face, and thin rims along the sides and bottoms of rooms. Wall
   * tiles away from any floor stay dark.
   */
  private drawWall(floor: GameState['floor'], x: number, y: number, sx: number, sy: number): void {
    const { ctx, atlas } = this;
    const open = (dx: number, dy: number) => !isWallAt(floor, x + dx, y + dy);
    if (open(0, 1)) {
      const v = wallFaceVariant(x, y);
      atlas.draw(ctx, v === 'hole1' ? MAP_SPRITES.wallFaceVariants[0] : v === 'hole2' ? MAP_SPRITES.wallFaceVariants[1] : MAP_SPRITES.wallFace, sx, sy);
      if (v === 'goo') atlas.draw(ctx, MAP_SPRITES.wallGoo, sx, sy);
    } else if (isFace(floor, x, y + 1)) atlas.draw(ctx, MAP_SPRITES.wallTop, sx, sy);
    // Side rims run alongside the floor; at a room's top corners they carry on
    // up past the end of the face row (but faces themselves get none).
    const face = open(0, 1);
    if (open(-1, 0) || (!face && open(-1, 1))) atlas.draw(ctx, MAP_SPRITES.wallRimWest, sx, sy);
    if (open(1, 0) || (!face && open(1, 1))) atlas.draw(ctx, MAP_SPRITES.wallRimEast, sx, sy);
    // Bottom rim: the cap sprite's rim sits in its lowest rows, so lift it to this tile's top.
    if (open(0, -1)) atlas.draw(ctx, MAP_SPRITES.wallTop, sx, sy - 12);
  }

  private drawEnemy(state: GameState, e: Entity, sx: number, sy: number): void {
    const { ctx } = this;
    const mind = e.mind!;
    shadow(ctx, sx, sy, 6);
    const moving = !!e.motion;
    const bob = moving ? (Math.floor(e.motion!.tick / 4) % 2) : mind.asleep ? 0 : Math.floor(state.tick / 40) % 2;
    const flip = Math.cos(e.facing) < -0.01;
    ctx.save();
    ctx.translate(sx + TILE / 2, sy + TILE - bob);
    ctx.scale(flip ? -1 : 1, mind.asleep ? 0.85 : 1);
    ctx.drawImage(this.enemySprites(e.defId), -SPRITE / 2, -SPRITE);
    ctx.restore();

    const top = sy + TILE - SPRITE; // top of the sprite box
    if (mind.asleep) bubble(ctx, sx, top, 'z', '#a0b8d8', state.tick);
    else if (state.tick - mind.alertedAt < TUNING.ai.alertBubbleTicks) bubble(ctx, sx, top, '!', '#ff5a40', 0);
    else if (e.patrol!.alert === 'suspicious') bubble(ctx, sx, top, '?', '#ffb040', 0);
    if (e.stats.hp < e.stats.maxHp) {
      ctx.fillStyle = '#1a1414';
      ctx.fillRect(sx, top + 1, 16, 3);
      ctx.fillStyle = '#c9473a';
      ctx.fillRect(sx + 1, top + 2, Math.round(14 * (e.stats.hp / e.stats.maxHp)), 1);
    }
  }

  private drawPlayer(state: GameState, sx: number, sy: number): void {
    const { ctx } = this;
    const pose = this.animator.pose(state);
    shadow(ctx, sx, sy, 6 + pose.squash);

    const sprite = this.playerSprites(pose.dir, pose.frame, pose.blink);
    const sqX = 1 + 0.12 * pose.squash;
    const sqY = 1 - 0.12 * pose.squash;
    ctx.save();
    if (state.dash.active > 0) ctx.globalAlpha = 0.75;
    if (state.grace > 0 && Math.floor(state.tick / 6) % 2 === 0) ctx.globalAlpha = 0.45;
    // Anchor at the feet so squash and flip keep them planted.
    ctx.translate(sx + TILE / 2, sy + TILE - pose.bob);
    ctx.scale(pose.flip ? -sqX : sqX, sqY);
    ctx.drawImage(sprite, -SPRITE / 2, -SPRITE);
    ctx.restore();
  }

  // --- HUD and overlays -----------------------------------------------------

  private drawHud(state: GameState): void {
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

    const s = state.player.stats;
    ctx.fillStyle = '#d9b310';
    ctx.fillText(`${theme.name.toUpperCase()}`, 14, 12);
    let x = 14 + ctx.measureText(theme.name.toUpperCase()).width + 24;
    ctx.fillStyle = '#c8d0c4';
    ctx.fillText('HP', x, 12);
    x += 26;
    bar(ctx, x, 13, 120, 12, s.hp / s.maxHp, s.hp / s.maxHp < 0.25 ? '#e0402a' : '#5fbf4a');
    x += 128;
    ctx.fillText(`${s.hp}/${s.maxHp}`, x, 12);
    x += 70;
    const dashReady = state.dash.cooldown === 0;
    ctx.fillStyle = dashReady ? '#9fd68a' : '#5a5f58';
    ctx.fillText(dashReady ? 'DASH ready' : 'DASH ...', x, 12);
    ctx.fillStyle = '#6f7d70';
    const right = `SEED ${state.seed}`;
    ctx.fillText(right, w - 14 - ctx.measureText(right).width, 12);

    const { x: tx, y: ty } = playerTile(state);
    let notice: string;
    if (state.floor.tiles[ty][tx].terrain === 'stairs') notice = NOTICES.onStairs;
    else {
      const cycle = [NOTICES.movement, NOTICES.sneak, NOTICES.dash, NOTICES.stairs, NOTICES.pause];
      notice = cycle[Math.floor(state.tick / (60 * 6)) % cycle.length];
    }
    ctx.fillStyle = '#c8d0c4';
    wrapText(ctx, notice, 14, 36, w - 28, 18);
  }

  private drawOverlay(lines: string[], color: string, title?: string, subtitle?: string): void {
    const { ctx, dpr } = this;
    const w = this.canvas.width / dpr;
    const h = this.worldH / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);
    let y = h / 2 - (lines.length * 22 + (title ? 40 : 0) + (subtitle ? 30 : 0)) / 2;
    if (title) {
      ctx.font = FONT_BIG;
      ctx.fillStyle = color;
      centered(ctx, title, w / 2, y);
      y += 40;
    }
    if (subtitle) {
      ctx.font = FONT;
      ctx.fillStyle = '#9aa89a';
      centered(ctx, subtitle.toUpperCase(), w / 2, y);
      y += 34;
    }
    ctx.font = FONT;
    lines.forEach((l, i) => {
      ctx.fillStyle = i === lines.length - 1 && title ? '#d9b310' : title ? '#c8d0c4' : color;
      centered(ctx, l, w / 2, y + i * 22);
    });
  }

  private drawRunEnd(state: GameState): void {
    const end = state.runEnd!;
    if (end.kind === 'died') {
      const d = NOTICES.died;
      const cls = CLASSES[state.player.defId].name;
      const lines = d.lines.map((l) => l.replaceAll('{enemy}', end.enemy).replaceAll('{move}', end.move).replaceAll('{class}', cls));
      this.drawOverlay([...lines, '', d.prompt], '#f08a7a', d.title, d.subtitle);
    } else {
      const d = NOTICES.escaped;
      this.drawOverlay([...d.lines, '', d.prompt], '#9fd68a', d.title, d.subtitle);
    }
  }
}

function isWallAt(floor: GameState['floor'], x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= floor.width || y >= floor.height || floor.tiles[y][x].terrain === 'wall';
}

/** A wall tile with walkable ground directly below shows its brick face. */
function isFace(floor: GameState['floor'], x: number, y: number): boolean {
  return isWallAt(floor, x, y) && !isWallAt(floor, x, y + 1);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function shadow(ctx: CanvasRenderingContext2D, sx: number, sy: number, rx: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(sx + TILE / 2, sy + TILE - 2, rx, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function bubble(ctx: CanvasRenderingContext2D, sx: number, top: number, ch: string, color: string, tick: number): void {
  const lift = ch === 'z' ? Math.floor(tick / 20) % 3 : 0;
  const sy = top + 4; // a little above the head
  ctx.fillStyle = '#0c0c0c';
  ctx.fillRect(sx + 10, sy - 8 - lift, 9, 10);
  ctx.fillStyle = color;
  ctx.font = 'bold 9px ui-monospace, monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(ch, sx + 12, sy - 7 - lift);
  // Say what the symbol means, in plain words.
  const label = UI_TEXT.bubbles[ch];
  if (label) {
    ctx.font = '6px ui-monospace, monospace';
    const lw = ctx.measureText(label).width + 4;
    ctx.fillStyle = 'rgba(12, 12, 12, 0.85)';
    ctx.fillRect(sx + 20, sy - 6 - lift, lw, 8);
    ctx.fillStyle = color;
    ctx.fillText(label, sx + 22, sy - 5 - lift);
  }
}

/** Cartoon gore, placed by a stable hash so it never shifts between frames. */
function drawGore(ctx: CanvasRenderingContext2D, kind: 'blood' | 'gibs', sx: number, sy: number, salt: number): void {
  const r = (n: number) => {
    let h = Math.imul(salt ^ (n * 0x9e3779b1), 0x85ebca6b);
    h ^= h >>> 13;
    return ((h >>> 0) % 1000) / 1000;
  };
  ctx.fillStyle = '#7a1414';
  for (let i = 0; i < 5; i++) ctx.fillRect(sx + 2 + Math.floor(r(i) * 10), sy + 3 + Math.floor(r(i + 9) * 9), 2 + Math.floor(r(i + 3) * 3), 1 + Math.floor(r(i + 5) * 2));
  if (kind === 'gibs') {
    ctx.fillStyle = '#b02a2a';
    for (let i = 0; i < 3; i++) ctx.fillRect(sx + 3 + Math.floor(r(i + 20) * 9), sy + 4 + Math.floor(r(i + 30) * 8), 2, 2);
    ctx.fillStyle = '#e8e0d0';
    ctx.fillRect(sx + 4 + Math.floor(r(40) * 7), sy + 6 + Math.floor(r(41) * 6), 3, 1);
  }
}
