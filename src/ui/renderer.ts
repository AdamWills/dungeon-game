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
import { hazardActive } from '../world/hazards';
import { chestAt, facingTile, isClosedDoor, propAt } from '../world/interact';
import { PROPS } from '../data/props';
import { fill } from '../data/battleText';
import { ALLIES } from '../data/allies';
import { captiveAt, priceOf } from '../game/party';
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
import { counted, REPORT } from '../data/report';
import { type AllySprites, buildAllySprites, buildChetPortrait } from './allySprites';
import type { PlayerSprites } from './playerSprite';
import { floorVariant, MAP_SPRITES, wallFaceVariant } from './tileset';
import { bar, FONT, wrapText } from './text';

export type Toast = { text: string; until: number };

/** UI-side screens and messages the renderer draws on top of the game. */
export type Overlays = { menu: BattleMenu; inventory: InventoryMenu; levelUp: LevelUpMenu; host: Host; toasts: Toast[] };

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
  readonly icons: ItemIcons;
  private propSprites: PropSprites;
  private allySprites: AllySprites;
  private chet: HTMLCanvasElement;
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
    this.drawHud(state);
    this.drawToasts(ui.toasts, now);
    if (state.mode === 'roaming') this.drawHost(ui.host, now);
    if (state.mode === 'menu') {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const [w, h] = [canvas.width / dpr, canvas.height / dpr];
      if (state.levelUp) ui.levelUp.draw(ctx, w, h, state, now, this.since(state.levelUp, now), this.pixel);
      else if (state.reveals.length) drawPrizeCard(ctx, w, h, state.reveals[0], state, state.reveals.length - 1, this.icons, now, this.since(state.reveals[0], now), this.pixel);
      else ui.inventory.draw(ctx, w, h, state, this.icons, ui.host.history);
    }
    if (state.mode === 'dead' || state.mode === 'won') this.drawRunEnd(state, now);
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
      atlas.draw(ctx, `floor_spikes_anim_f${Math.floor(state.tick / 15 + x + y) % 4}`, sx, sy);
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
    x += 110;
    const next = xpForNext(state.level);
    ctx.fillStyle = '#c8b8e0';
    ctx.fillText(next === null ? `LEVEL ${state.level} (max)` : `LEVEL ${state.level}  XP ${state.xp}/${next}`, x, 12);
    x += 190;
    ctx.fillStyle = '#ffd23a';
    ctx.fillText(`${state.tokens} TOKENS`, x, 12);
    x += 110;
    for (const a of state.party) {
      const name = ALLIES[a.defId].short;
      ctx.fillStyle = '#9fd68a';
      ctx.fillText(name, x, 12);
      x += ctx.measureText(name).width + 6;
      bar(ctx, x, 15, 40, 8, a.stats.hp / a.stats.maxHp, '#5fbf4a');
      x += 52;
    }
    ctx.fillStyle = '#6f7d70';
    const right = `SEED ${state.seed}`;
    ctx.fillText(right, w - 14 - ctx.measureText(right).width, 12);

    const notice = this.prompt(state);
    ctx.fillStyle = '#c8d0c4';
    wrapText(ctx, notice, 14, 36, w - 28, 18);
  }

  /** What the bottom bar says: a plain prompt for what is here, else a House Rule. */
  private prompt(state: GameState): string {
    const P = UI_TEXT.prompts;
    const { x, y } = playerTile(state);
    const tile = state.floor.tiles[y][x];
    if (tile.terrain === 'stairs') return NOTICES.onStairs;
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
    const cycle = [NOTICES.movement, NOTICES.sneak, NOTICES.inventory, NOTICES.dash, NOTICES.stairs, NOTICES.pause];
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
