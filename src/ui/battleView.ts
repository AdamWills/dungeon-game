// The battle screen: turn order bar, enemies with HP bars, the player, the
// command menu and the battle log. Drawn in CSS pixels; sprites are scaled
// by whole numbers. Hit flashes and damage numbers are UI-only animation,
// keyed off the battle's fx list and wall-clock time.

import { currentActor } from '../battle/turns';
import type { BattleState, Combatant, GameState } from '../game/types';
import { TILE } from './atlas';
import type { BattleMenu } from './battleMenu';
import type { EnemySprites } from './enemySprites';
import type { PlayerSprites } from './playerSprite';
import { UI_TEXT } from '../data/uiText';
import { bar, centered, FONT, FONT_BIG, TONE_COLOR, wrapLines } from './text';

const FX_MS = 700;

export class BattleView {
  private fxStart = new Map<number, number>();

  constructor(
    private playerSprites: PlayerSprites,
    private enemySprites: EnemySprites,
    private floorTile: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
  ) {}

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState, menu: BattleMenu, now: number): void {
    const battle = state.battle!;
    for (const f of battle.fx) if (!this.fxStart.has(f.seq)) this.fxStart.set(f.seq, now);
    const scale = Math.max(2, Math.min(5, Math.floor(Math.min(w, h) / 170)));
    const panelTop = Math.round(h - Math.min(300, Math.max(190, h * 0.32)));

    this.drawBackdrop(ctx, w, panelTop, scale);
    this.drawTurnBar(ctx, w, battle);

    const enemies = battle.combatants.filter((c) => c.side === 'enemy');
    const actor = currentActor(battle);
    const targetId = menu.level === 'target' ? menu.targets(state)[menu.target] : null;
    const size = TILE * scale;
    const gap = Math.min(size * 1.6, (w - 80) / Math.max(1, enemies.length));
    const rowY = Math.round(h * 0.18);
    enemies.forEach((c, i) => {
      const cx = Math.round(w / 2 + (i - (enemies.length - 1) / 2) * gap);
      this.drawCombatant(ctx, c, cx, rowY, size, battle, now, {
        flip: true,
        highlight: c.id === targetId,
        acting: actor?.id === c.id,
      });
    });

    const me = battle.combatants.find((c) => c.side === 'player')!;
    const meSize = TILE * (scale + 1);
    this.drawCombatant(ctx, me, Math.round(w * 0.2), panelTop - meSize - 64, meSize, battle, now, {
      flip: false,
      highlight: false,
      acting: actor?.id === me.id,
      sprite: this.playerSprites('up', 'stand', false),
    });

    const menuW = Math.min(300, Math.round(w * 0.32));
    this.drawLog(ctx, 16, panelTop, w - menuW - 48, h - panelTop - 16, battle);
    this.drawMenu(ctx, w - menuW - 16, panelTop, menuW, h - panelTop - 16, state, menu);

    if (battle.round === 1 && battle.ambushSide) {
      ctx.font = FONT;
      ctx.fillStyle = battle.ambushSide === 'player' ? '#d9b310' : '#f08a7a';
      centered(ctx, battle.ambushSide === 'player' ? 'AMBUSH: YOU STRIKE FIRST, +50% DAMAGE THIS ROUND' : 'AMBUSHED: THEY STRIKE FIRST, +50% DAMAGE THIS ROUND', w / 2, 52);
    }
    if (battle.result) this.drawResult(ctx, w, h, battle);
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, w: number, floorBottom: number, scale: number): void {
    ctx.fillStyle = '#0b0e0d';
    ctx.fillRect(0, 0, w, ctx.canvas.height);
    const s = TILE * scale;
    const floorTop = 64;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floorTop, w, floorBottom - floorTop);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    for (let y = floorTop; y < floorBottom; y += s)
      for (let x = 0; x < w; x += s) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        this.floorTile(ctx, Math.floor(x / s), Math.floor(y / s));
        ctx.restore();
      }
    ctx.fillStyle = 'rgba(5, 8, 7, 0.55)';
    ctx.fillRect(0, floorTop, w, floorBottom - floorTop);
    ctx.restore();
  }

  private drawTurnBar(ctx: CanvasRenderingContext2D, w: number, battle: BattleState): void {
    ctx.fillStyle = '#101412';
    ctx.fillRect(0, 0, w, 40);
    ctx.font = FONT;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6f7d70';
    ctx.fillText(`ROUND ${battle.round}`, 14, 20);
    let x = 110;
    battle.order.forEach((id, i) => {
      const c = battle.combatants.find((k) => k.id === id)!;
      if (!c.alive) return;
      const label = c.name;
      const tw = ctx.measureText(label).width + 16;
      const now = i === battle.turn && !battle.result;
      ctx.fillStyle = now ? '#3a3410' : '#1a201c';
      ctx.fillRect(x, 8, tw, 24);
      ctx.strokeStyle = now ? '#d9b310' : c.side === 'player' ? '#4a6a4a' : '#6a3a34';
      ctx.strokeRect(x + 0.5, 8.5, tw - 1, 23);
      ctx.fillStyle = c.side === 'player' ? '#9fd68a' : '#e0b0a8';
      ctx.fillText(label, x + 8, 20);
      x += tw + 6;
    });
    ctx.textBaseline = 'top';
  }

  private drawCombatant(
    ctx: CanvasRenderingContext2D,
    c: Combatant,
    cx: number,
    top: number,
    size: number,
    battle: BattleState,
    now: number,
    opts: { flip: boolean; highlight: boolean; acting: boolean; sprite?: HTMLCanvasElement },
  ): void {
    const fx = battle.fx.filter((f) => f.targetId === c.id).map((f) => ({ f, t: (now - (this.fxStart.get(f.seq) ?? 0)) / FX_MS }));
    const hit = fx.find(({ f, t }) => f.kind === 'hit' && t < 0.4);
    const shake = hit ? Math.round(Math.sin(now / 25) * 3) : 0;
    const bob = opts.acting && c.alive ? Math.round(Math.sin(now / 160) * 2) : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, top + size - size / 12, size * 0.32, size / 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprite = opts.sprite ?? this.enemySprites(c.defId);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(cx + shake, top + bob);
    if (opts.flip) ctx.scale(-1, 1);
    if (!c.alive) {
      ctx.globalAlpha = 0.25;
      ctx.filter = 'grayscale(1)';
    }
    ctx.drawImage(sprite, -size / 2, 0, size, size);
    ctx.restore();
    if (hit) {
      // White flash: redraw the sprite as a silhouette.
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - hit.t / 0.4);
      ctx.filter = 'brightness(5)';
      ctx.translate(cx + shake, top + bob);
      if (opts.flip) ctx.scale(-1, 1);
      ctx.drawImage(sprite, -size / 2, 0, size, size);
      ctx.restore();
    }
    if (!c.alive) {
      ctx.fillStyle = 'rgba(140, 20, 20, 0.7)';
      ctx.beginPath();
      ctx.ellipse(cx, top + size - size / 10, size * 0.38, size / 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (opts.highlight) {
      ctx.fillStyle = '#d9b310';
      ctx.beginPath();
      ctx.moveTo(cx - 8, top - 18);
      ctx.lineTo(cx + 8, top - 18);
      ctx.lineTo(cx, top - 6);
      ctx.fill();
    }

    ctx.font = FONT;
    ctx.fillStyle = c.alive ? (opts.highlight ? '#d9b310' : '#e8e4da') : '#6a6460';
    centered(ctx, c.name + (c.defending ? ' [braced]' : ''), cx, top + size + 6);
    const bw = Math.max(80, size * 0.8);
    bar(ctx, cx - bw / 2, top + size + 26, bw, 8, c.stats.hp / c.stats.maxHp, c.side === 'player' ? '#5fbf4a' : '#c9473a');
    ctx.fillStyle = '#9a9a90';
    centered(ctx, `${c.stats.hp}/${c.stats.maxHp}`, cx, top + size + 38);

    for (const { f, t } of fx) {
      if (t >= 1 || (f.kind !== 'hit' && f.kind !== 'miss' && f.kind !== 'heal')) continue;
      ctx.globalAlpha = 1 - t;
      ctx.font = FONT_BIG;
      ctx.fillStyle = f.kind === 'hit' ? '#ff6a50' : f.kind === 'heal' ? '#7aea6a' : '#c8c8c0';
      const text = f.kind === 'miss' ? 'MISS' : f.kind === 'heal' ? `+${f.amount}` : `-${f.amount}`;
      centered(ctx, text, cx, top + size * 0.2 - t * 40);
      ctx.globalAlpha = 1;
    }
  }

  private drawLog(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, battle: BattleState): void {
    panel(ctx, x, y, w, h);
    ctx.font = FONT;
    const lineH = 19;
    const lines: { text: string; color: string }[] = [];
    for (const l of battle.log) for (const t of wrapLines(ctx, l.text, w - 24)) lines.push({ text: t, color: TONE_COLOR[l.tone] });
    const fit = Math.max(1, Math.floor((h - 20) / lineH));
    lines.slice(-fit).forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, x + 12, y + 10 + i * lineH);
    });
  }

  private drawMenu(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, state: GameState, menu: BattleMenu): void {
    panel(ctx, x, y, w, h);
    const battle = state.battle!;
    ctx.font = FONT;
    const yourTurn = currentActor(battle)?.side === 'player';
    if (!yourTurn || battle.result) return;

    let rows: { label: string; enabled: boolean }[];
    let cursor: number;
    let title: string;
    if (menu.level === 'item') {
      rows = menu.itemLabels(state).map((label) => ({ label, enabled: true }));
      cursor = menu.itemCursor;
      title = 'ITEM  (ESC back)';
    } else if (menu.level === 'target') {
      rows = [];
      cursor = -1;
      title = 'ATTACK: CHOOSE A TARGET';
    } else {
      rows = menu.options(state);
      cursor = menu.cursor;
      title = 'YOUR TURN';
    }
    ctx.fillStyle = '#d9b310';
    ctx.fillText(title, x + 14, y + 12);
    rows.forEach((r, i) => {
      const ry = y + 40 + i * 24;
      if (i === cursor) {
        ctx.fillStyle = '#2a2a12';
        ctx.fillRect(x + 8, ry - 4, w - 16, 22);
        ctx.fillStyle = '#d9b310';
        ctx.fillText('>', x + 14, ry);
      }
      ctx.fillStyle = r.enabled ? (i === cursor ? '#f4ecd0' : '#c8d0c4') : '#5a5f58';
      ctx.fillText(r.label, x + 30, ry);
    });

    // Plain help for the highlighted choice, under the options.
    const helpY = y + 40 + rows.length * 24 + 10;
    ctx.fillStyle = '#3a4a3a';
    ctx.fillRect(x + 12, helpY - 6, w - 24, 1);
    ctx.fillStyle = '#9aa89a';
    const lines = wrapLines(ctx, menu.help(state), w - 28);
    const fit = Math.max(1, Math.floor((y + h - helpY - 8) / 18));
    lines.slice(0, fit).forEach((l, i) => ctx.fillText(l, x + 14, helpY + i * 18));
  }

  private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number, battle: BattleState): void {
    const text = UI_TEXT.result[battle.result!];
    const color = battle.result === 'lost' ? '#f08a7a' : battle.result === 'won' ? '#9fd68a' : '#d9b310';
    const bw = Math.min(560, w - 40);
    const bx = (w - bw) / 2;
    const by = Math.round(h * 0.3);
    panel(ctx, bx, by, bw, 112);
    ctx.font = FONT_BIG;
    ctx.fillStyle = color;
    centered(ctx, text.title, w / 2, by + 18);
    ctx.font = FONT;
    ctx.fillStyle = '#9aa89a';
    centered(ctx, text.sub, w / 2, by + 52);
    ctx.fillStyle = '#d9b310';
    centered(ctx, UI_TEXT.result.prompt, w / 2, by + 80);
  }
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(14, 18, 16, 0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3a4a3a';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
