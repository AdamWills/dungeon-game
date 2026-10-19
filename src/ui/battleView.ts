// The battle screen: turn order bar, enemies with HP bars, the player, the
// command menu and the battle log. Drawn in CSS pixels; sprites are scaled
// by whole numbers. Hit flashes and damage numbers are UI-only animation,
// keyed off the battle's fx list and wall-clock time.

import { currentActor, youIn } from '../battle/turns';
import { skillLevel } from '../game/skills';
import { intentText } from './intent';
import type { BattleState, Combatant, GameState } from '../game/types';
import { SPRITE, TILE } from './atlas';
import type { BattleMenu } from './battleMenu';
import type { AllySprites } from './allySprites';
import type { EnemySprites } from './enemySprites';
import type { PlayerSprites } from './playerSprite';
import type { PropSprites } from './propSprites';
import { PROPS } from '../data/props';
import { STATUSES } from '../data/statuses';
import { UI_TEXT } from '../data/uiText';
import { blink, confetti, lowRes, NEON, panel as neonPanel, popIn, sign, title, TITLE_STYLE } from './neon';
import { drawText, fitScale, textHeight, wrapPixel } from './pixelFont';
import { bar, centered, FONT, FONT_BIG, TONE_COLOR, wrapLines } from './text';

const FX_MS = 700;

export class BattleView {
  private fxStart = new Map<number, number>();

  constructor(
    private playerSprites: PlayerSprites,
    private enemySprites: EnemySprites,
    private allySprites: AllySprites,
    private propSprites: PropSprites,
    private floorTile: (ctx: CanvasRenderingContext2D, x: number, y: number) => void,
  ) {}

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState, menu: BattleMenu, now: number, pixel: number): void {
    const battle = state.battle!;
    for (const f of battle.fx) if (!this.fxStart.has(f.seq)) this.fxStart.set(f.seq, now);
    const scale = Math.max(2, Math.min(5, Math.floor(Math.min(w, h) / 170)));
    const panelTop = Math.round(h - Math.min(310, Math.max(262, h * 0.34)));

    this.drawBackdrop(ctx, w, panelTop, scale);
    this.drawTurnBar(ctx, w, battle);

    const enemies = battle.combatants.filter((c) => c.side === 'enemy');
    const actor = currentActor(battle);
    const targetId = menu.level === 'target' ? menu.targets(state)[menu.target] : null;
    const size = SPRITE * scale;
    const gap = Math.min(size * 1.6, (w - 80) / Math.max(1, enemies.length));
    const rowY = Math.round(h * 0.18);
    const reading = skillLevel(state, 'read_the_room');
    enemies.forEach((c, i) => {
      const cx = Math.round(w / 2 + (i - (enemies.length - 1) / 2) * gap);
      // Read the Room: what it is about to do, as much as you can tell.
      const intent = intentText(battle, c, reading);
      if (intent) {
        ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
        const lines = wrapLines(ctx, intent, Math.max(130, gap - 14));
        lines.forEach((l, j) => {
          const tw = ctx.measureText(l).width;
          ctx.fillStyle = 'rgba(10, 6, 16, 0.85)';
          ctx.fillRect(cx - tw / 2 - 5, rowY - 30 - (lines.length - 1 - j) * 15, tw + 10, 15);
          ctx.fillStyle = '#ffb040';
          ctx.fillText(l, cx - tw / 2, rowY - 28 - (lines.length - 1 - j) * 15);
        });
        ctx.font = FONT;
      }
      this.drawCombatant(ctx, c, cx, rowY, size, battle, now, {
        flip: true,
        highlight: c.id === targetId,
        acting: actor?.id === c.id,
      });
    });

    const me = youIn(battle);
    const meSize = SPRITE * (scale + 1);
    const meX = Math.round(w * 0.12);
    this.drawCombatant(ctx, me, meX, panelTop - meSize - 64, meSize, battle, now, {
      flip: false,
      highlight: me.id === targetId,
      acting: actor?.id === me.id,
      sprite: this.playerSprites('up', 'stand', false),
    });
    // Your allies stand beside you, a little smaller.
    const allies = battle.combatants.filter((c) => c.ally);
    const allySize = SPRITE * scale;
    const allyGap = Math.max(allySize * 1.25, 110);
    allies.forEach((c, i) => {
      this.drawCombatant(ctx, c, Math.round(meX + meSize * 0.6 + allyGap * (i + 0.6)), panelTop - allySize - 64, allySize, battle, now, {
        flip: false,
        highlight: c.id === targetId,
        acting: actor?.id === c.id,
        sprite: this.allySprites(c.defId),
      });
    });
    const arenaX = Math.max(Math.round(w * 0.42), Math.round(meX + meSize * 0.6 + allyGap * (allies.length + 0.2)));

    // The arena: props you can Improvise with, between you and them.
    if (battle.props.length) {
      const ps = SPRITE * Math.max(2, scale - 1);
      const baseY = panelTop - ps - 30;
      ctx.font = FONT;
      ctx.fillStyle = '#6f7d70';
      ctx.fillText('ARENA', arenaX, baseY - 22);
      battle.props.forEach((p, i) => {
        const x = Math.round(arenaX + i * (ps + 40));
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (p.usesLeft <= 0) ctx.globalAlpha = 0.3;
        ctx.drawImage(this.propSprites(p.defId), x, baseY, ps, ps);
        ctx.restore();
        ctx.fillStyle = p.usesLeft > 0 ? '#c8d0c4' : '#5a5f58';
        centered(ctx, PROPS[p.defId].name, x + ps / 2, baseY + ps + 4);
      });
    }

    const menuW = Math.min(300, Math.round(w * 0.32));
    this.drawLog(ctx, 16, panelTop, w - menuW - 48, h - panelTop - 16, battle);
    this.drawMenu(ctx, w - menuW - 16, panelTop, menuW, h - panelTop - 16, state, menu);

    if (battle.round === 1 && battle.ambushSide) {
      ctx.font = FONT;
      ctx.fillStyle = battle.ambushSide === 'player' ? '#d9b310' : '#f08a7a';
      centered(ctx, battle.ambushSide === 'player' ? UI_TEXT.ambush.yours : UI_TEXT.ambush.theirs, w / 2, 52);
    }
    if (battle.result && battle.wait === 0) this.drawResult(ctx, w, h, battle, now, pixel);
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

    // Elites stand in a gold glow.
    ctx.fillStyle = c.elite ? 'rgba(255, 210, 58, 0.6)' : 'rgba(0,0,0,0.45)';
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
    // Bigger art (bosses) stands on the same spot and grows upward.
    const big = (size * sprite.width) / SPRITE;
    ctx.drawImage(sprite, -big / 2, size - big, big, big);
    ctx.restore();
    if (hit) {
      // White flash: redraw the sprite as a silhouette.
      ctx.save();
      ctx.globalAlpha = 0.55 * (1 - hit.t / 0.4);
      ctx.filter = 'brightness(5)';
      ctx.translate(cx + shake, top + bob);
      if (opts.flip) ctx.scale(-1, 1);
      ctx.drawImage(sprite, -big / 2, size - big, big, big);
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
    // Status badges, in plain words with turns left.
    if (c.statuses.length) {
      ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillStyle = '#e0b84a';
      centered(ctx, c.statuses.map((s) => `${STATUSES[s.kind].name.toUpperCase()} ${s.turnsLeft}`).join('  '), cx, top + size + 56);
      ctx.font = FONT;
    }

    for (const { f, t } of fx) {
      if (t < 1 && (f.kind === 'weak' || f.kind === 'resist')) {
        // A word over the target's head, above the damage number.
        ctx.globalAlpha = 1 - t;
        ctx.font = FONT_BIG;
        ctx.fillStyle = f.kind === 'weak' ? '#ffd23a' : '#9aa0a8';
        centered(ctx, f.kind === 'weak' ? 'WEAK SPOT!' : 'RESISTED', cx, top - 14 - t * 30);
        ctx.globalAlpha = 1;
        continue;
      }
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
    const yourTurn = battle.yourTurn && battle.wait === 0 && currentActor(battle)?.id === 'player';
    if (battle.result) return;
    if (!yourTurn) {
      // Someone else is acting: say who, so the pause reads as their turn.
      const who = currentActor(battle);
      ctx.fillStyle = '#9aa89a';
      ctx.fillText(who && who.id !== 'player' ? `${who.name.toUpperCase()}'S TURN...` : 'GET READY...', x + 14, y + 12);
      return;
    }

    let rows: { label: string; enabled: boolean }[];
    const improvTitles: Record<string, string> = {
      improv: 'IMPROVISE  (ESC back)', prop: 'USE WHICH PROP?', verb: 'DO WHAT WITH IT?', jankA: 'COMBINE: FIRST ITEM', jankB: 'COMBINE: SECOND ITEM',
    };
    let cursor: number;
    let title: string;
    if (menu.level === 'item') {
      rows = menu.itemRows(state);
      cursor = menu.itemCursor;
      title = 'ITEM  (ESC back)';
    } else if (improvTitles[menu.level]) {
      rows = menu.improvRows(state);
      cursor = menu.sub;
      title = improvTitles[menu.level];
    } else if (menu.level === 'target') {
      rows = [];
      cursor = -1;
      const titles = { attack: 'ATTACK: CHOOSE A TARGET', ability: 'HEX: CHOOSE A TARGET', item: 'ITEM: CHOOSE A TARGET', friend: 'ITEM: WHO GETS IT?', spare: 'SPARE: CHOOSE WHO' };
      title = titles[menu.pending.kind];
    } else {
      rows = menu.options(state);
      cursor = menu.cursor;
      title = 'YOUR TURN';
    }
    ctx.fillStyle = '#d9b310';
    ctx.fillText(title, x + 14, y + 12);
    const rowH = rows.length > 6 ? 21 : 24;
    rows.forEach((r, i) => {
      const ry = y + 40 + i * rowH;
      if (i === cursor) {
        ctx.fillStyle = '#2a2a12';
        ctx.fillRect(x + 8, ry - 4, w - 16, rowH - 2);
        ctx.fillStyle = '#d9b310';
        ctx.fillText('>', x + 14, ry);
      }
      ctx.fillStyle = r.enabled ? (i === cursor ? '#f4ecd0' : '#c8d0c4') : '#5a5f58';
      ctx.fillText(r.label, x + 30, ry);
    });

    // Plain help for the highlighted choice, under the options.
    const helpY = y + 40 + rows.length * rowH + 10;
    ctx.fillStyle = '#3a4a3a';
    ctx.fillRect(x + 12, helpY - 6, w - 24, 1);
    ctx.fillStyle = '#9aa89a';
    const lines = wrapLines(ctx, menu.help(state), w - 28);
    const fit = Math.max(1, Math.floor((y + h - helpY - 8) / 18));
    lines.slice(0, fit).forEach((l, i) => ctx.fillText(l, x + 14, helpY + i * 18));
  }

  private resultSince = new WeakMap<BattleState, number>();

  /** The end of a fight, game-show style: a neon banner that pops in. */
  private drawResult(ctx: CanvasRenderingContext2D, w: number, h: number, battle: BattleState, now: number, pixel: number): void {
    if (!this.resultSince.has(battle)) this.resultSince.set(battle, now);
    const since = this.resultSince.get(battle)!;
    const r = battle.result!;
    const text = UI_TEXT.result[r];
    const look = {
      won: { outer: NEON.pink, inner: NEON.cyan, title: NEON.gold, badge: NEON.pink },
      fled: { outer: NEON.cyan, inner: NEON.purple, title: NEON.cyan, badge: NEON.cyan },
      lost: { outer: NEON.red, inner: NEON.purple, title: NEON.red, badge: NEON.red },
    }[r];
    ctx.fillStyle = 'rgba(8, 2, 16, 0.6)';
    ctx.fillRect(0, 0, w, h);
    const cy = Math.round(h * 0.36);
    lowRes(ctx, w, h, pixel, (g, lw, lh) => {
      if (r === 'won') confetti(g, lw, lh, since, now);
      const bw = Math.min(280, lw - 8);
      const subs = wrapPixel(text.sub, bw - 28);
      const scale = fitScale(text.title, bw - 28, 4, TITLE_STYLE);
      const th = textHeight({ ...TITLE_STYLE, scale });
      const bh = 13 + th + 6 + subs.length * 9 + 26;
      const x = Math.round((lw - bw) / 2);
      const y = Math.round((cy * lh) / h - bh / 2);
      const cx = Math.round(lw / 2);
      neonPanel(g, x, y, bw, bh, look.outer, look.inner, now);
      title(g, text.title, cx, y + 13, look.title, scale);
      sign(g, text.badge, x + bw - 4, y - 10, look.badge, now, { align: 'right' });
      let yy = y + 13 + th + 6;
      for (const line of subs) {
        drawText(g, line, cx, yy, { color: '#ffffff', align: 'center' });
        yy += 9;
      }
      if (blink(now)) drawText(g, UI_TEXT.result.prompt, cx, yy + 4, { color: NEON.pink.core, outline: '#2a0a3a', align: 'center' });
    }, { pop: popIn((now - since) / 400), origin: [w / 2, cy], minH: 120 });
  }
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = 'rgba(14, 18, 16, 0.94)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3a4a3a';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
