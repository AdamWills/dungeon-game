// The inventory screen (time is paused): worn gear on top, pockets below,
// details and stats on the right. Turns key presses into InvCommands.

import { CLASSES } from '../data/classes';
import { INVENTORY_CAP, ITEMS, RARITY_NAMES } from '../data/items';
import { RACES } from '../data/races';
import { UI_TEXT } from '../data/uiText';
import { carriedCount, equipPreview, SLOTS, type Slot, weaponOf } from '../game/equipment';
import { ALLIES, STANCE_ORDER, STANCES } from '../data/allies';
import { SKILLS } from '../data/skills';
import { skillLevel } from '../game/skills';
import type { Entity, GameState, InvCommand, ItemInstance } from '../game/types';
import type { MenuKey } from './input';
import type { ItemIcons } from './itemIcons';
import { centered, FONT, FONT_BIG, wrapLines } from './text';

type Row =
  | { kind: 'worn'; slot: Slot; item?: ItemInstance }
  | { kind: 'pocket'; index: number; item: ItemInstance }
  | { kind: 'ally'; ally: Entity };

const RARITY_COLOR: Record<string, string> = { junk: '#a8a090', standard: '#c8d0c4', special: '#6ab0f0', cursed: '#c060e0', hosts_pick: '#f0c040' };

export class InventoryMenu {
  cursor = 0;
  /** Giving a pocket item: which ally the gift goes to. */
  giving: { slot: number; ally: number } | null = null;

  rows(state: GameState): Row[] {
    const p = state.player;
    return [
      ...SLOTS.map((slot): Row => ({ kind: 'worn', slot, item: p.equipment?.[slot] })),
      ...p.inventory.map((item, index): Row => ({ kind: 'pocket', index, item })),
      ...state.party.map((ally): Row => ({ kind: 'ally', ally })),
    ];
  }

  handle(key: MenuKey, state: GameState): InvCommand | null {
    if (this.giving) {
      const g = this.giving;
      const n = state.party.length;
      if (key === 'up' || key === 'left') g.ally = (g.ally + n - 1) % n;
      else if (key === 'down' || key === 'right') g.ally = (g.ally + 1) % n;
      else if (key === 'back' || key === 'give') this.giving = null;
      else if (key === 'confirm') {
        this.giving = null;
        const ally = state.party[g.ally];
        if (ally) return { kind: 'give', slot: g.slot, allyId: ally.id };
      }
      return null;
    }
    const rows = this.rows(state);
    this.cursor = Math.min(this.cursor, rows.length - 1);
    if (key === 'up') this.cursor = (this.cursor + rows.length - 1) % rows.length;
    else if (key === 'down') this.cursor = (this.cursor + 1) % rows.length;
    const row = rows[this.cursor];
    if (row.kind === 'ally') {
      // Left and right change the stance.
      const mind = row.ally.ally!;
      const i = STANCE_ORDER.indexOf(mind.stance);
      const step = key === 'left' ? -1 : key === 'right' || key === 'confirm' ? 1 : 0;
      if (!step) return null;
      return { kind: 'stance', allyId: row.ally.id, stance: STANCE_ORDER[(i + step + STANCE_ORDER.length) % STANCE_ORDER.length] };
    }
    if (key === 'give' && row.kind === 'pocket' && state.party.length && ITEMS[row.item.defId]?.use?.consumable) {
      this.giving = { slot: row.index, ally: 0 };
      return null;
    }
    if (key === 'confirm') {
      if (row.kind === 'worn') return row.item ? { kind: 'unequip', slot: row.slot } : null;
      const def = ITEMS[row.item.defId];
      if (def?.slot) return { kind: 'equip', slot: row.index };
      return { kind: 'use', slot: row.index };
    }
    if (key === 'drop' && row.kind === 'pocket') return { kind: 'drop', slot: row.index };
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState, icons: ItemIcons, hostHistory: string[] = []): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, w, h);
    const pw = Math.min(900, w - 32);
    const ph = Math.min(560, h - 32);
    const px = Math.round((w - pw) / 2);
    const py = Math.round((h - ph) / 2);
    ctx.fillStyle = '#0e1210';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#3a4a3a';
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

    ctx.textBaseline = 'top';
    ctx.font = FONT_BIG;
    ctx.fillStyle = '#d9b310';
    ctx.fillText('INVENTORY', px + 20, py + 16);
    ctx.font = FONT;
    ctx.fillStyle = '#9aa89a';
    ctx.fillText(UI_TEXT.inventory.sub, px + 20, py + 46);
    const count = `${carriedCount(state.player)}/${INVENTORY_CAP} carried`;
    ctx.fillText(count, px + pw - 20 - ctx.measureText(count).width, py + 22);

    const rows = this.rows(state);
    this.cursor = Math.min(this.cursor, rows.length - 1);
    const listX = px + 20;
    const listW = Math.round(pw * 0.48);
    let y = py + 78;
    const pockets = state.player.inventory.length;
    const lineH = rows.length > 13 ? 22 : 26;
    rows.forEach((row, i) => {
      if (i === SLOTS.length) {
        ctx.fillStyle = '#6f7d70';
        ctx.fillText(pockets ? 'POCKETS' : 'POCKETS (empty)', listX, y + 6);
        y += 28;
      }
      if (i === SLOTS.length + pockets) {
        ctx.fillStyle = '#6f7d70';
        ctx.fillText('PARTY', listX, y + 6);
        y += 28;
      }
      if (i === 0) {
        ctx.fillStyle = '#6f7d70';
        ctx.fillText('WORN', listX, y);
        y += 22;
      }
      const selected = i === this.cursor;
      if (selected) {
        ctx.fillStyle = '#2a2a12';
        ctx.fillRect(listX - 6, y - 4, listW, lineH);
      }
      if (row.kind === 'ally') {
        const def = ALLIES[row.ally.defId];
        const giftTo = this.giving && state.party[this.giving.ally] === row.ally;
        ctx.fillStyle = giftTo ? '#ffd23a' : selected ? '#f4ecd0' : '#9fd68a';
        ctx.fillText(`${giftTo ? 'GIVE TO > ' : ''}${def.short}  ${row.ally.stats.hp}/${row.ally.stats.maxHp} HP  < ${STANCES[row.ally.ally!.stance].name} >`, listX + 28, y);
        y += lineH;
        return;
      }
      const label = row.kind === 'worn' ? `${row.slot[0].toUpperCase()}${row.slot.slice(1)}: ` : '';
      if (row.item) {
        icons(ctx, row.item.defId, listX, y - 2, 1.25);
        const def = ITEMS[row.item.defId];
        ctx.fillStyle = selected ? '#f4ecd0' : RARITY_COLOR[def?.rarity ?? 'standard'];
        ctx.fillText(label + (def?.name ?? row.item.defId), listX + 28, y);
      } else {
        ctx.fillStyle = '#5a5f58';
        ctx.fillText(`${label}(nothing)`, listX + 28, y);
      }
      y += lineH;
    });

    // Details for the selected row, then stats.
    const dx = px + listW + 44;
    const dw = pw - (dx - px) - 20;
    let dy = py + 78;
    const row = rows[this.cursor];
    const def = row && row.kind !== 'ally' && row.item ? ITEMS[row.item.defId] : undefined;
    if (row?.kind === 'ally') {
      const a = ALLIES[row.ally.defId];
      const stance = STANCES[row.ally.ally!.stance];
      ctx.font = FONT_BIG;
      ctx.fillStyle = '#9fd68a';
      for (const l of wrapLines(ctx, a.name, dw)) {
        ctx.fillText(l, dx, dy);
        dy += 28;
      }
      ctx.font = FONT;
      const s = row.ally.stats;
      const block = (text: string, color: string, gap = 8) => {
        ctx.fillStyle = color;
        for (const l of wrapLines(ctx, text, dw)) {
          ctx.fillText(l, dx, dy);
          dy += 19;
        }
        dy += gap;
      };
      block(`HP ${s.hp}/${s.maxHp}   Strength ${s.str}   Speed ${s.speed}   Evasion ${s.evasion}   Armor ${s.armor}`, '#c8d0c4');
      block(`${a.passive.name}: ${a.passive.help}`, '#e8e4da');
      block(`${a.ability.name}: ${a.ability.help}`, '#e8e4da');
      block(`Stance: ${stance.name}. ${stance.help}`, '#d9b310');
      block(UI_TEXT.inventory.allyKeys, '#9aa89a');
    }
    if (def && row.kind !== 'ally') {
      ctx.font = FONT_BIG;
      ctx.fillStyle = RARITY_COLOR[def.rarity];
      for (const l of wrapLines(ctx, def.name, dw)) {
        ctx.fillText(l, dx, dy);
        dy += 28;
      }
      ctx.font = FONT;
      ctx.fillStyle = '#6f7d70';
      ctx.fillText(RARITY_NAMES[def.rarity] + (def.cursed ? ' (cursed)' : ''), dx, dy);
      dy += 26;
      ctx.fillStyle = '#e8e4da';
      for (const l of wrapLines(ctx, def.help, dw)) {
        ctx.fillText(l, dx, dy);
        dy += 19;
      }
      dy += 8;
      ctx.fillStyle = '#9aa89a';
      for (const l of wrapLines(ctx, `"${def.description}"`, dw)) {
        ctx.fillText(l, dx, dy);
        dy += 19;
      }
      // If it is in your pockets: what wearing it would change.
      if (row.kind === 'pocket') {
        for (const c of equipPreview(state, def.id)) {
          ctx.fillStyle = c.after > c.before ? '#7aea5a' : '#ff6a50';
          ctx.fillText(`${c.name} ${c.before} → ${c.after}`, dx, dy);
          dy += 19;
        }
      }
      dy += 12;
      ctx.fillStyle = '#d9b310';
      const action =
        row.kind === 'worn' ? (def.cursed ? UI_TEXT.inventory.cursed : UI_TEXT.inventory.unequip) : def.slot ? UI_TEXT.inventory.equip : def.use ? (def.use.battleOnly || def.use.target !== 'self' ? UI_TEXT.inventory.battleOnly : UI_TEXT.inventory.use) : UI_TEXT.inventory.carry;
      const give = row.kind === 'pocket' && state.party.length && def.use?.consumable ? ` ${UI_TEXT.inventory.give}` : '';
      for (const l of wrapLines(ctx, action + give, dw)) {
        ctx.fillText(l, dx, dy);
        dy += 19;
      }
    }

    const s = state.player.stats;
    const wpn = weaponOf(state.player);
    const sy = py + ph - 154;
    ctx.fillStyle = '#6f7d70';
    ctx.fillText(`${RACES[state.race].name.toUpperCase()} ${CLASSES[state.cls].name.toUpperCase()}`, dx, sy);
    ctx.fillStyle = '#c8d0c4';
    const stats = [
      `HP ${s.hp}/${s.maxHp}`,
      `Strength ${s.str}   Speed ${s.speed}`,
      `Evasion ${s.evasion}   Armor ${s.armor}   Charm ${s.charm}`,
      `Weapon: ${wpn.name} (${wpn.damage} damage)`,
      ...Object.values(SKILLS).map((k) => `${k.name}: level ${skillLevel(state, k.id)}`),
    ];
    stats.forEach((t, i) => ctx.fillText(t, dx, sy + 22 + i * 20));

    // Chet's recent lines, newest last.
    const recent = hostHistory.slice(-2);
    if (recent.length) {
      ctx.fillStyle = '#6f7d70';
      let hy = py + ph - 52 - recent.length * 18;
      ctx.fillText('CHET SAID', listX, hy - 20);
      ctx.fillStyle = '#d9b310';
      for (const l of recent) {
        const t = wrapLines(ctx, l, listW - 30)[0];
        ctx.fillText(t + (t.length < l.length ? '...' : ''), listX, hy);
        hy += 18;
      }
    }
    ctx.fillStyle = '#9aa89a';
    centered(ctx, this.giving ? UI_TEXT.inventory.giveKeys : UI_TEXT.inventory.keys, px + pw / 2, py + ph - 26);
  }
}
