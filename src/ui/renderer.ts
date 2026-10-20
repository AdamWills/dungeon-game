// Canvas renderer. Reads GameState, never writes it. The canvas fills the
// window; the map is drawn at a whole-number zoom so pixels stay crisp, and
// text is drawn at native resolution so it stays sharp.

import { CLASSES } from '../data/classes';
import { FLOOR_THEMES } from '../data/floors';
import { HAZARDS } from '../data/hazards';
import { RACES } from '../data/races';
import { NOTICES } from '../data/notices';
import { TUNING } from '../data/tuning';
import { UI_TEXT } from '../data/uiText';
import { canSee } from '../game/ai';
import { hazardActive, hazardPhase } from '../world/hazards';
import { chestAt, facingTile, isClosedDoor, leftItemHere, propAt } from '../world/interact';
import { DAMAGE_TYPES } from '../data/damage';
import { formatUsd } from '../ai/budget';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { PROPS } from '../data/props';
import { fill } from '../data/battleText';
import { ALLIES } from '../data/allies';
import { captiveAt, priceOf } from '../game/party';
import { weaponOf } from '../game/equipment';
import { xpForNext } from '../game/progress';
import type { EliminationReport, Entity, GameState } from '../game/types';
import { playerTile } from '../world/roam';
import { PlayerAnimator } from './animation';
import { type Atlas, SPRITE, TILE } from './atlas';
import type { BattleMenu } from './battleMenu';
import { BattleView } from './battleView';
import type { EnemySprites } from './enemySprites';
import type { InventoryMenu } from './inventory';
import { buildItemIcons, type ItemIcons } from './itemIcons';
import type { Picker } from './picker';
import { drawPrizeCard } from './prizeCard';
import { blink, confetti, lowRes, NEON, panel, popIn, sign, stage, title, TITLE_STYLE } from './neon';
import { drawText, fitScale, textHeight, wrapPixel } from './pixelFont';
import { buildPropSprites, type PropSprites } from './propSprites';
import type { Host } from '../host/host';
import type { LevelUpMenu } from './levelUp';
import type { TalkMenu } from './talk';
import { counted, REPORT } from '../data/report';
import { type AllySprites, buildAllySprites, buildChetPortrait } from './allySprites';
import type { PlayerSprites } from './playerSprite';
import { floorVariant, MAP_SPRITES, wallFaceVariant } from './tileset';
import { bar, FONT, FONT_BIG, wrapText } from './text';

export type Toast = { text: string; until: number };

/** UI-side screens and messages the renderer draws on top of the game. */
export type Overlays = { menu: BattleMenu; inventory: InventoryMenu; levelUp: LevelUpMenu; talk: TalkMenu; host: Host; toasts: Toast[]; ai: { spent: number; limit: number } };

/** Zoom is the largest whole number that still shows at least this many tiles. */
const MIN_VIEW_TILES = { x: 22, y: 13 };
const HUD_CSS_H = 96;
/** Close-up zoom steps for the full-screen map, in screen pixels per tile. */
const BIG_MAP_ZOOMS = [8, 12, 18];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private zoom = 1;
  private worldH = 0; // device pixels
  readonly animator = new PlayerAnimator();
  private battleView: BattleView;
  readonly icons: ItemIcons;
  private propSprites: PropSprites;
  private allySprites: AllySprites;
  private chet: HTMLCanvasElement;
  private floaters: { id: string; text: string; at: number }[] = [];
  /** The corner map of explored tiles (M toggles it). */
  showMap = true;
  /** Screen pixels per map tile: 1 shows the whole floor, 6 is a close-up. */
  private mapScale = 3;
  private mapCanvas: HTMLCanvasElement | null = null;
  /** The full-screen map (Tab), when open: view centre in tiles and zoom step. */
  bigMap: { cx: number; cy: number; scale: number } | null = null;
  /** When the current prize card (and other big moments) first appeared, for animations. */
  private shownAt = new WeakMap<object, number>();

  constructor(
    private canvas: HTMLCanvasElement,
    private atlas: Atlas,
    private playerSprites: PlayerSprites,
    private enemySprites: EnemySprites,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.propSprites = buildPropSprites();
    this.allySprites = buildAllySprites();
    this.chet = buildChetPortrait();
    this.battleView = new BattleView(playerSprites, enemySprites, this.allySprites, this.propSprites, (ctx, x, y) => atlas.draw(ctx, floorVariant(x, y), 0, 0));
    this.icons = buildItemIcons(atlas);
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

  private clear(): void {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /** Draw a full-screen UI layer on top of whatever is showing, in CSS pixels. */
  overlay(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): void {
    const { ctx, canvas, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    draw(ctx, canvas.width / dpr, canvas.height / dpr);
  }

  renderPicker(picker: Picker, now: number): void {
    const { ctx, canvas, dpr } = this;
    this.clear();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    picker.draw(ctx, canvas.width / dpr, canvas.height / dpr, this.playerSprites, now, this.pixel);
  }

  render(state: GameState, ui: Overlays, now: number): void {
    const { ctx, canvas, dpr } = this;
    this.clear();
    if (state.battle) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.battleView.draw(ctx, canvas.width / dpr, canvas.height / dpr, state, ui.menu, now, this.pixel);
      return;
    }
    this.drawWorld(state);
    this.drawHud(state, ui.ai);
    if (this.showMap && state.mode === 'roaming') this.drawMinimap(state);
    this.drawToasts(ui.toasts, now);
    if (state.mode === 'roaming') this.drawHost(ui.host, now);
    if (state.mode === 'menu') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [w, h] = [canvas.width / dpr, canvas.height / dpr];
      if (state.levelUp) ui.levelUp.draw(ctx, w, h, state, now, this.since(state.levelUp, now), this.pixel);
      else if (state.talk) ui.talk.draw(ctx, w, h, state, this.allySprites, now, this.since(state.talk, now), this.pixel);
      else if (state.reveals.length) drawPrizeCard(ctx, w, h, state.reveals[0].item, state, state.reveals.length - 1, this.icons, now, this.since(state.reveals[0], now), this.pixel);
      else ui.inventory.draw(ctx, w, h, state, this.icons, this.playerSprites, ui.host.history);
    }
    if (state.mode === 'dead' || state.mode === 'won') this.drawRunEnd(state, now);
    if (this.bigMap && state.mode === 'roaming') this.drawBigMap(state, now);
  }

  /** Size of one art pixel in CSS pixels: the map's zoom, so overlays match it. */
  get pixel(): number {
    return Math.max(2, Math.round(this.zoom / this.dpr));
  }

  /** First time we drew this object, for pop-in animations. */
  since(obj: object, now: number): number {
    if (!this.shownAt.has(obj)) this.shownAt.set(obj, now);
    return this.shownAt.get(obj)!;
  }

  /** Chet's current line in a neon strip along the bottom of the map, typed out. */
  private drawHost(host: Host, now: number): void {
    const line = host.line(now);
    if (!line) return;
    const { ctx, canvas, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = canvas.width / dpr;
    const h = this.worldH / dpr;
    const chet = this.chet;
    // A notch finer than the map's pixels, so it covers less of the view.
    lowRes(ctx, w, h, Math.max(2, this.pixel - 1), (g, lw, lh) => {
      const sw = Math.min(lw - 8, 320);
      const lines = wrapPixel(line.text, sw - 50);
      const sh = Math.max(40, 18 + lines.length * 9);
      const x = Math.round((lw - sw) / 2);
      const y = lh - sh - 4;
      panel(g, x, y, sw, sh, NEON.pink, NEON.cyan, now);
      // The hologram: a little flicker, and scanlines over the portrait.
      const jitter = Math.floor(now / 70) % 23 === 0 ? 1 : 0;
      const py = y + Math.round((sh - 24) / 2);
      g.drawImage(chet, x + 10 + jitter, py);
      g.fillStyle = 'rgba(56, 200, 255, 0.28)';
      for (let r = 0; r < 24; r += 2) g.fillRect(x + 10, py + r, 24, 1);
      let left = Math.floor((now - line.at) / 22);
      lines.forEach((l, i) => {
        if (left <= 0) return;
        drawText(g, l.slice(0, left), x + 40, y + 9 + i * 9, { color: '#ffffff' });
        left -= l.length + 1;
      });
    }, { slot: 2 });
  }

  private drawToasts(toasts: Toast[], now: number): void {
    const { ctx, dpr } = this;
    const live = toasts.filter((t) => t.until > now).slice(-4);
    if (!live.length) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    // Top left, clear of Chet's strip along the bottom.
    live.forEach((t, i) => {
      const y = 12 + i * 24;
      const w = ctx.measureText(t.text).width + 16;
      ctx.globalAlpha = Math.min(1, (t.until - now) / 400);
      ctx.fillStyle = 'rgba(10, 14, 12, 0.85)';
      ctx.fillRect(12, y, w, 22);
      ctx.fillStyle = '#e8e4da';
      ctx.fillText(t.text, 20, y + 4);
      ctx.globalAlpha = 1;
    });
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
          case 'door':
            atlas.draw(ctx, floorVariant(x, y), sx, sy);
            drawDoor(ctx, sx, sy, !!tile.door?.open);
            break;
          case 'hazard':
            atlas.draw(ctx, floorVariant(x, y), sx, sy);
            this.drawHazard(state, tile.hazard!, x, y, sx, sy);
            break;
          default:
            atlas.draw(ctx, floorVariant(x, y), sx, sy);
            if (y > 0 && floor.tiles[y - 1][x].terrain === 'wall' && wallFaceVariant(x, y - 1) === 'goo' && isFace(floor, x, y - 1))
              atlas.draw(ctx, MAP_SPRITES.wallGooBase, sx, sy);
        }
        for (let i = 0; i < tile.gore.length; i++) drawGore(ctx, tile.gore[i].kind, sx, sy, x * 31 + y * 17 + i);
      }
    }

    // The stairs glow and wear a bobbing arrow, so they cannot be missed (user
    // feedback). Gold when open, red while the floor boss still seals them.
    {
      const s = floor.stairs;
      if (floor.tiles[s.y][s.x].explored && s.x >= x0 - 1 && s.x <= x1 + 1 && s.y >= y0 - 2 && s.y <= y1 + 1) {
        const open = !floor.lair || floor.lair.beaten;
        const sx = s.x * TILE - camX;
        const sy = s.y * TILE - camY;
        const pulse = 0.5 + 0.5 * Math.sin(state.tick / 12);
        const [r, g, b] = open ? [255, 210, 58] : [255, 70, 60];
        const glow = ctx.createRadialGradient(sx + TILE / 2, sy + TILE / 2, 2, sx + TILE / 2, sy + TILE / 2, TILE * 1.6);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.35 + 0.25 * pulse})`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(sx - TILE * 1.5, sy - TILE * 1.5, TILE * 4, TILE * 4);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.6 + 0.4 * pulse})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, TILE - 1, TILE - 1);
        // A down arrow over the stairs.
        const ay = sy - 12 - Math.round(2 * Math.sin(state.tick / 10));
        ctx.fillStyle = '#120d0a';
        ctx.fillRect(sx + 5, ay - 1, 6, 6);
        ctx.fillRect(sx + 2, ay + 4, 12, 2);
        ctx.fillRect(sx + 3, ay + 6, 10, 2);
        ctx.fillRect(sx + 5, ay + 8, 6, 2);
        ctx.fillRect(sx + 7, ay + 10, 2, 1);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(sx + 6, ay, 4, 5);
        ctx.fillRect(sx + 3, ay + 5, 10, 1);
        ctx.fillRect(sx + 4, ay + 6, 8, 2);
        ctx.fillRect(sx + 6, ay + 8, 4, 2);
      }
    }

    // Chests and loot lying around, wherever you have explored.
    for (const c of floor.chests) {
      if (!floor.tiles[c.pos.y][c.pos.x].explored) continue;
      atlas.draw(ctx, c.opened ? 'chest_empty_open_anim_f2' : 'chest_full_open_anim_f0', c.pos.x * TILE - camX, c.pos.y * TILE - camY);
    }
    for (const it of floor.items) {
      if (!floor.tiles[it.pos.y][it.pos.x].explored) continue;
      const bob = Math.floor(state.tick / 30) % 2;
      this.icons(ctx, it.item.defId, it.pos.x * TILE - camX, it.pos.y * TILE - camY - bob);
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
    // Captives waiting to be recruited, and your party trailing behind you.
    for (const a of floor.entities) {
      if (a.kind !== 'ally' || !visible(Math.round(a.pos.x), Math.round(a.pos.y))) continue;
      actors.push({ y: a.pos.y, draw: () => this.drawAlly(state, a, a.pos.x * TILE - camX, a.pos.y * TILE - camY, true) });
    }
    for (const a of state.party)
      actors.push({ y: a.pos.y - 0.01, draw: () => this.drawAlly(state, a, Math.round(a.pos.x * TILE) - camX, Math.round(a.pos.y * TILE) - camY, false) });
    for (const p of floor.props) {
      if (!floor.tiles[p.pos.y][p.pos.x].explored) continue;
      actors.push({ y: p.pos.y, draw: () => ctx.drawImage(this.propSprites(p.defId), p.pos.x * TILE - camX + TILE / 2 - SPRITE / 2, p.pos.y * TILE - camY + TILE - SPRITE) });
    }
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.draw());

    // Damage taken on the map, floating up from whoever took it.
    const now = performance.now();
    this.floaters = this.floaters.filter((f) => now - f.at < FLOAT_MS);
    for (const f of this.floaters) {
      const e = f.id === 'player' ? player : (floor.entities.find((x) => x.id === f.id) ?? state.party.find((x) => x.id === f.id));
      if (!e) continue;
      const t = (now - f.at) / FLOAT_MS;
      drawText(ctx, f.text, Math.round(e.pos.x * TILE - camX + TILE / 2), Math.round(e.pos.y * TILE - camY - 14 - t * 10), { color: '#ff5a40', outline: '#1a0000', align: 'center' });
    }
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

  private drawHazard(state: GameState, kind: keyof typeof HAZARDS, x: number, y: number, sx: number, sy: number): void {
    const { ctx, atlas } = this;
    if (kind === 'spikes') {
      // Down, then a warning twitch, then up: the art matches when they hurt.
      const { on, off } = HAZARDS.spikes.cycle!;
      const phase = hazardPhase('spikes', x, y, state.tick);
      const frame = phase < on ? 3 : phase >= on + off - 12 ? 2 : phase >= on + off - 24 ? 1 : 0;
      atlas.draw(ctx, `floor_spikes_anim_f${frame}`, sx, sy);
    } else if (kind === 'sludge') {
      ctx.fillStyle = 'rgba(90, 140, 40, 0.75)';
      ctx.fillRect(sx + 1, sy + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = 'rgba(150, 200, 60, 0.9)';
      const t = Math.floor(state.tick / 20);
      ctx.fillRect(sx + 3 + ((x * 5 + t) % 9), sy + 4 + ((y * 7 + t) % 7), 2, 2);
      ctx.fillRect(sx + 9 - ((x * 3 + t) % 5), sy + 10 - ((y + t) % 4), 2, 2);
    } else {
      atlas.draw(ctx, 'hole', sx, sy);
      if (hazardActive(kind, x, y, state.tick)) {
        ctx.fillStyle = 'rgba(120, 200, 80, 0.45)';
        const r = 5 + (state.tick % 20) / 4;
        ctx.beginPath();
        ctx.arc(sx + TILE / 2, sy + TILE / 2 - 3, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawEnemy(state: GameState, e: Entity, sx: number, sy: number): void {
    const { ctx } = this;
    const mind = e.mind!;
    shadow(ctx, sx, sy, 6);
    const moving = !!e.motion;
    const bob = moving ? (Math.floor(e.motion!.tick / 4) % 2) : mind.asleep ? 0 : Math.floor(state.tick / 40) % 2;
    const flip = Math.cos(e.facing) < -0.01;
    const sprite = this.enemySprites(e.defId);
    if (e.elite || ENEMIES[e.defId]?.tier) {
      // Elites glow gold underfoot; bosses red.
      ctx.fillStyle = e.elite ? 'rgba(255, 210, 58, 0.55)' : 'rgba(255, 60, 60, 0.45)';
      ctx.beginPath();
      ctx.ellipse(sx + TILE / 2, sy + TILE - 2, sprite.width * 0.32, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(sx + TILE / 2, sy + TILE - bob);
    ctx.scale(flip ? -1 : 1, mind.asleep ? 0.85 : 1);
    ctx.drawImage(sprite, -sprite.width / 2, -sprite.height);
    ctx.restore();

    const top = sy + TILE - sprite.height; // top of the sprite box
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

  private drawAlly(state: GameState, a: Entity, sx: number, sy: number, captive: boolean): void {
    const { ctx } = this;
    shadow(ctx, sx, sy, 6);
    const bob = a.motion ? Math.floor(a.motion.tick / 4) % 2 : Math.floor((state.tick + a.id.length * 13) / 40) % 2;
    const flip = captive ? Math.cos(a.facing) < -0.01 || a.pos.x > state.player.pos.x : Math.cos(a.facing) < -0.01;
    ctx.save();
    ctx.translate(sx + TILE / 2, sy + TILE - bob);
    ctx.scale(flip ? -1 : 1, 1);
    ctx.drawImage(this.allySprites(a.defId), -SPRITE / 2, -SPRITE);
    ctx.restore();
    const top = sy + TILE - SPRITE;
    if (!captive) {
      if (a.stats.hp < a.stats.maxHp) {
        ctx.fillStyle = '#1a1414';
        ctx.fillRect(sx, top + 1, 16, 3);
        ctx.fillStyle = '#5fbf4a';
        ctx.fillRect(sx + 1, top + 2, Math.round(14 * (a.stats.hp / a.stats.maxHp)), 1);
      }
      return;
    }
    const recruit = ALLIES[a.defId].recruit;
    if (recruit.kind === 'cell') {
      // Cell bars in front of her.
      ctx.fillStyle = '#5a5f68';
      for (let x = 1; x < TILE; x += 4) ctx.fillRect(sx + x, top + 2, 2, SPRITE - 4);
      ctx.fillStyle = '#8a909a';
      ctx.fillRect(sx - 1, top + 2, TILE + 2, 2);
      ctx.fillRect(sx - 1, top + SPRITE - 6, TILE + 2, 2);
    } else bubble(ctx, sx, top, '$', '#ffd23a', 0);
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
    // Just got hurt: flash red.
    if (this.floaters.some((f) => f.id === 'player' && performance.now() - f.at < 250)) ctx.drawImage(redOf(sprite), -SPRITE / 2, -SPRITE);
    ctx.restore();
  }

  zoomMap(steps: number): void {
    const levels = [1, 2, 3, 4, 6];
    const i = Math.max(0, Math.min(levels.length - 1, levels.indexOf(this.mapScale) + steps));
    this.mapScale = levels[i];
    this.showMap = true;
  }

  /** Paint explored tiles, one pixel per tile, onto the map canvas. */
  private paintMap(state: GameState): HTMLCanvasElement {
    const f = state.floor;
    if (!this.mapCanvas || this.mapCanvas.width !== f.width || this.mapCanvas.height !== f.height) {
      this.mapCanvas = document.createElement('canvas');
      this.mapCanvas.width = f.width;
      this.mapCanvas.height = f.height;
    }
    const g = this.mapCanvas.getContext('2d')!;
    const img = g.createImageData(f.width, f.height);
    const px = (x: number, y: number, r: number, gg: number, b: number) => {
      const i = (y * f.width + x) * 4;
      img.data.set([r, gg, b, 255], i);
    };
    for (let y = 0; y < f.height; y++)
      for (let x = 0; x < f.width; x++) {
        const t = f.tiles[y][x];
        if (!t.explored || t.terrain === 'wall') continue;
        const lit = f.visible[y * f.width + x] === 1;
        if (t.terrain === 'stairs') px(x, y, 255, 210, 58);
        else if (t.hazard) px(x, y, lit ? 120 : 80, lit ? 170 : 110, 60);
        else if (t.terrain === 'door') px(x, y, 150, 100, 60);
        else px(x, y, lit ? 120 : 70, lit ? 110 : 64, lit ? 100 : 60);
      }
    for (const c of f.chests) if (!c.opened && f.tiles[c.pos.y][c.pos.x].explored) px(c.pos.x, c.pos.y, 200, 120, 40);
    for (const e of f.entities) {
      const x = Math.round(e.pos.x);
      const y = Math.round(e.pos.y);
      if (f.visible[y * f.width + x] !== 1) continue;
      if (e.kind === 'enemy') px(x, y, 255, 70, 50);
      else px(x, y, 60, 200, 255);
    }
    for (const a of state.party) px(Math.round(a.pos.x), Math.round(a.pos.y), 120, 230, 90);
    px(Math.round(state.player.pos.x), Math.round(state.player.pos.y), 255, 255, 255);
    g.putImageData(img, 0, 0);
    return this.mapCanvas;
  }

  /** Explored tiles in the top right, in a window around you; + and - zoom. */
  private drawMinimap(state: GameState): void {
    const { ctx, dpr } = this;
    const f = state.floor;
    this.paintMap(state);
    const w = this.canvas.width / dpr;
    const scale = this.mapScale;
    const vw = Math.min(f.width, Math.floor(Math.min(w * 0.3, 260) / scale));
    const vh = Math.min(f.height, Math.floor(Math.min((this.worldH / dpr) * 0.35, 170) / scale));
    const vx = Math.max(0, Math.min(f.width - vw, Math.round(state.player.pos.x) - vw / 2));
    const vy = Math.max(0, Math.min(f.height - vh, Math.round(state.player.pos.y) - vh / 2));
    const mw = vw * scale;
    const mh = vh * scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(8, 6, 12, 0.72)';
    ctx.fillRect(w - mw - 18, 10, mw + 8, mh + 24);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapCanvas!, vx, vy, vw, vh, w - mw - 14, 14, mw, mh);
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#9aa89a';
    ctx.fillText(UI_TEXT.mapHint, w - mw - 14, mh + 18);
  }

  /** Open or close the full-screen map, centred on you. */
  toggleBigMap(state: GameState): void {
    if (this.bigMap) this.bigMap = null;
    else this.bigMap = { cx: state.player.pos.x, cy: state.player.pos.y, scale: 0 };
  }

  /** Keys while the full-screen map is open: arrows pan, C recentres. */
  bigMapKey(key: string, state: GameState): void {
    const m = this.bigMap;
    if (!m) return;
    const step = Math.max(2, Math.round(48 / this.bigMapScale(state)));
    if (key === 'left') m.cx -= step;
    else if (key === 'right') m.cx += step;
    else if (key === 'up') m.cy -= step;
    else if (key === 'down') m.cy += step;
    else if (key === 'center') [m.cx, m.cy] = [state.player.pos.x, state.player.pos.y];
    else if (key === 'back') this.bigMap = null;
    if (!this.bigMap) return;
    m.cx = Math.max(0, Math.min(state.floor.width, m.cx));
    m.cy = Math.max(0, Math.min(state.floor.height, m.cy));
  }

  /** Zoom steps on the full-screen map: 0 fits the whole floor, then closer. */
  zoomBigMap(steps: number): void {
    if (this.bigMap) this.bigMap.scale = Math.max(0, Math.min(BIG_MAP_ZOOMS.length, this.bigMap.scale + steps));
  }

  private bigMapArea(): { x: number; y: number; w: number; h: number } {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    return { x: 16, y: 44, w: w - 32, h: h - 44 - 56 };
  }

  /** Screen pixels per tile on the full-screen map. */
  private bigMapScale(state: GameState): number {
    const a = this.bigMapArea();
    const fit = Math.max(1, Math.floor(Math.min(a.w / state.floor.width, a.h / state.floor.height)));
    const z = this.bigMap?.scale ?? 0;
    return z === 0 ? fit : Math.max(fit + 1, BIG_MAP_ZOOMS[z - 1]);
  }

  /** The whole explored floor, filling the screen (Tab). Time is paused. */
  private drawBigMap(state: GameState, now: number): void {
    const { ctx, dpr } = this;
    const m = this.bigMap!;
    const f = state.floor;
    const map = this.paintMap(state);
    const W = this.canvas.width / dpr;
    const H = this.canvas.height / dpr;
    const T = UI_TEXT.bigMap;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#06040a';
    ctx.fillRect(0, 0, W, H);
    const a = this.bigMapArea();
    const scale = this.bigMapScale(state);
    // Keep the view on the floor; a floor smaller than the area sits centred.
    const vw = a.w / scale;
    const vh = a.h / scale;
    const cx = f.width <= vw ? f.width / 2 : Math.max(vw / 2, Math.min(f.width - vw / 2, m.cx));
    const cy = f.height <= vh ? f.height / 2 : Math.max(vh / 2, Math.min(f.height - vh / 2, m.cy));
    m.cx = cx;
    m.cy = cy;
    const ox = Math.round(a.x + a.w / 2 - cx * scale);
    const oy = Math.round(a.y + a.h / 2 - cy * scale);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map, ox, oy, f.width * scale, f.height * scale);
    // Pulsing rings so you and the stairs stand out.
    const pulse = (x: number, y: number, color: string) => {
      const r = scale * 1.5 + 4 + 3 * Math.sin(now / 200);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ox + (x + 0.5) * scale, oy + (y + 0.5) * scale, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    pulse(state.player.pos.x, state.player.pos.y, '#ffffff');
    for (let y = 0; y < f.height; y++)
      for (let x = 0; x < f.width; x++) if (f.tiles[y][x].terrain === 'stairs' && f.tiles[y][x].explored) pulse(x, y, '#ffd23a');
    ctx.restore();
    ctx.strokeStyle = '#3a2a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(a.x - 0.5, a.y - 0.5, a.w + 1, a.h + 1);

    ctx.font = FONT_BIG;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#d9b310';
    ctx.fillText(T.title, a.x, 12);
    let x = a.x + ctx.measureText(T.title).width + 32;
    ctx.font = FONT;
    for (const [color, label] of T.legend) {
      ctx.fillStyle = color;
      ctx.fillRect(x, 18, 10, 10);
      ctx.fillStyle = '#c8d0c4';
      ctx.fillText(label, x + 14, 16);
      x += 14 + ctx.measureText(label).width + 18;
    }
    ctx.fillStyle = '#9aa89a';
    ctx.fillText(T.keys, a.x, H - 40);
  }

  /** Something on the map took damage (hazards): float the number and flash them. */
  notifyHurt(id: string, dmg: number, now: number): void {
    this.floaters.push({ id, text: `-${dmg}`, at: now });
  }

  // --- HUD and overlays -----------------------------------------------------

  private drawHud(state: GameState, ai: Overlays['ai']): void {
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
    x += 110;
    const next = xpForNext(state.level);
    ctx.fillStyle = '#c8b8e0';
    ctx.fillText(next === null ? `LEVEL ${state.level} (max)` : `LEVEL ${state.level}  XP ${state.xp}/${next}`, x, 12);
    x += 190;
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(`${state.tokens} TOKENS`, x, 12);
    ctx.fillStyle = '#6f7d70';
    const right = `SEED ${state.seed}`;
    ctx.fillText(right, w - 14 - ctx.measureText(right).width, 12);
    // What this run has spent on AI, against the player's limit.
    const spend = `AI ${formatUsd(ai.spent)} / ${formatUsd(ai.limit)}`;
    ctx.fillStyle = ai.spent >= ai.limit * 0.8 ? '#ff7a5a' : '#38c8ff';
    ctx.fillText(spend, w - 14 - ctx.measureText(right).width - 24 - ctx.measureText(spend).width, 12);

    // Second row: your stats, always in view, then the party.
    const wpn = weaponOf(state.player);
    const stats = `Strength ${s.str}   Speed ${s.speed}   Evasion ${s.evasion}   Armor ${s.armor}   Charm ${s.charm}   Weapon ${wpn.name} (${wpn.damage}, ${DAMAGE_TYPES[wpn.type].name})`;
    ctx.fillStyle = '#c8d0c4';
    ctx.fillText(stats, 14, 34);
    x = 14 + ctx.measureText(stats).width + 30;
    for (const a of state.party) {
      const name = ALLIES[a.defId].short;
      ctx.fillStyle = '#9fd68a';
      ctx.fillText(name, x, 34);
      x += ctx.measureText(name).width + 6;
      bar(ctx, x, 37, 40, 8, a.stats.hp / a.stats.maxHp, '#5fbf4a');
      x += 52;
    }

    const lair = state.floor.lair;
    if (lair) {
      const B = NOTICES.bossHud;
      const boss = state.floor.entities.find((e) => e.id === lair.bossId);
      const text = lair.beaten ? B.beaten : lair.found ? fill(B.found, { boss: boss ? ENEMIES[boss.defId].name : '' }) : B.hidden;
      ctx.fillStyle = lair.beaten ? '#9fd68a' : lair.found ? '#ff7a5a' : '#8a7aa8';
      ctx.fillText(text, w - 14 - ctx.measureText(text).width, 34);
    }

    const notice = this.prompt(state);
    ctx.fillStyle = '#9aa89a';
    wrapText(ctx, notice, 14, 58, w - 28, 18);
  }

  /** What the bottom bar says: a plain prompt for what is here, else a House Rule. */
  private prompt(state: GameState): string {
    const P = UI_TEXT.prompts;
    const { x, y } = playerTile(state);
    const tile = state.floor.tiles[y][x];
    if (tile.terrain === 'stairs') return state.floor.lair && !state.floor.lair.beaten ? NOTICES.onSealedStairs : NOTICES.onStairs;
    const left = leftItemHere(state);
    if (left) return fill(P.leftItem, { item: ITEMS[left.item.defId]?.name ?? left.item.defId });
    if (tile.hazard) return HAZARDS[tile.hazard].help;
    if (tile.gore.some((g) => g.kind === 'gibs')) return P.eat.replace('{effect}', RACES[state.race].eatsCorpses ? P.eatGood : P.eatBad);
    const f = facingTile(state);
    const chest = chestAt(state, f.x, f.y);
    if (chest && !chest.opened) return P.chest;
    if (isClosedDoor(state, f.x, f.y)) return P.door;
    const prop = propAt(state, f.x, f.y);
    if (prop) return fill(P.prop, { prop: PROPS[prop.defId].name });
    const captive = captiveAt(state, f.x, f.y);
    if (captive) {
      const def = ALLIES[captive.defId];
      if (def.recruit.kind === 'cell') return fill(P.cell, { name: def.short });
      return fill(P.bribe, { name: def.short, price: priceOf(state, def.id), tokens: state.tokens });
    }
    const cycle = [NOTICES.movement, NOTICES.sneak, NOTICES.inventory, NOTICES.dash, NOTICES.stairs, NOTICES.weakSpots, NOTICES.pause];
    return cycle[Math.floor(state.tick / (60 * 6)) % cycle.length];
  }

  /** The end of a run, as a full game-show moment: sunburst, marquee, the works. */
  private drawRunEnd(state: GameState, now: number): void {
    const { ctx, canvas, dpr } = this;
    const end = state.runEnd!;
    const since = this.since(end, now);
    const died = end.kind === 'died';
    const d = died ? { ...REPORT, lines: reportLines(end.report) } : NOTICES.escaped;
    const lines = d.lines;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const look = died
      ? { outer: NEON.red, inner: NEON.purple, title: NEON.red, floor: NEON.red }
      : { outer: NEON.pink, inner: NEON.cyan, title: NEON.gold, floor: NEON.pink };
    const minH = 220;
    lowRes(ctx, w, h, this.pixel, (g, lw, lh) => {
      stage(g, lw, lh, now, look.floor);
      if (!died) confetti(g, lw, lh, since, now);
    }, { minH });
    lowRes(ctx, w, h, this.pixel, (g, lw, lh) => {
      const pw = Math.min(330, lw - 8);
      const maxW = pw - 28;
      const wrapped = lines.map((l) => wrapPixel(l, maxW));
      const scale = fitScale(d.title, pw - 28, 4, TITLE_STYLE);
      const th = textHeight({ ...TITLE_STYLE, scale });
      const ph = Math.min(lh - 4, 13 + th + 22 + wrapped.reduce((n, ls) => n + ls.length * 9 + 4, 0) + 30);
      const x = Math.round((lw - pw) / 2);
      const y = Math.round((lh - ph) / 2);
      const cx = Math.round(lw / 2);
      panel(g, x, y, pw, ph, look.outer, look.inner, now);
      title(g, d.title, cx, y + 13, look.title, scale);
      sign(g, d.badge, x + pw - 4, y - 10, look.outer, now, { align: 'right' });
      drawText(g, d.subtitle, cx, y + 13 + th + 4, { color: look.inner.text, align: 'center' });
      let yy = y + 13 + th + 20;
      wrapped.forEach((ls, i) => {
        for (const l of ls) {
          drawText(g, l, cx, yy, { color: i === lines.length - 1 ? NEON.gold.text : '#ffffff', align: 'center' });
          yy += 9;
        }
        yy += 4;
      });
      if (blink(now)) drawText(g, d.prompt, cx, y + ph - 21, { color: NEON.pink.core, outline: '#2a0a3a', align: 'center' });
    }, { minH, pop: popIn((now - since) / 450), slot: 1 });
  }
}

function isWallAt(floor: GameState['floor'], x: number, y: number): boolean {
  return x < 0 || y < 0 || x >= floor.width || y >= floor.height || floor.tiles[y][x].terrain === 'wall';
}

/** A wall tile with walkable ground directly below shows its brick face. */
function isFace(floor: GameState['floor'], x: number, y: number): boolean {
  return isWallAt(floor, x, y) && !isWallAt(floor, x, y + 1);
}

/** Doors in code: wooden planks when shut, an empty frame when open. */
function drawDoor(ctx: CanvasRenderingContext2D, sx: number, sy: number, open: boolean): void {
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(sx, sy, 2, TILE);
  ctx.fillRect(sx + TILE - 2, sy, 2, TILE);
  if (open) return;
  ctx.fillStyle = '#7a4a24';
  ctx.fillRect(sx + 2, sy, TILE - 4, TILE);
  ctx.fillStyle = '#5a3418';
  for (let i = 0; i < 3; i++) ctx.fillRect(sx + 4 + i * 4, sy, 1, TILE);
  ctx.fillStyle = '#d9b310';
  ctx.fillRect(sx + TILE - 5, sy + 8, 2, 2);
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

/** The elimination report, line by line, in plain words with Chet's sign-off last. */
function reportLines(r: EliminationReport): string[] {
  const L = REPORT.lines;
  const allies = counted(REPORT.allies, r.alliesRecruited) + (r.alliesLost ? REPORT.alliesLost.replace('{n}', String(r.alliesLost)) : '');
  const vars = {
    race: RACES[r.race].name,
    class: CLASSES[r.cls].name,
    level: r.level,
    enemy: r.enemy,
    move: r.move,
    fights: counted(REPORT.fights, r.fights),
    badIdeas: counted(REPORT.badIdeas, r.badIdeas),
    allies,
    lastWords: r.lastWords,
    gift: r.partingGift,
    signOff: r.hostLine,
  };
  return [L.who, L.cause, L.record, L.lastWords, L.gift, L.chet].map((l) => fill(l, vars));
}

const FLOAT_MS = 900;

/** A red silhouette of a sprite, for hit flashes. */
function redOf(sprite: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sprite.width;
  c.height = sprite.height;
  const g = c.getContext('2d')!;
  g.drawImage(sprite, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = 'rgba(255, 60, 40, 0.7)';
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
