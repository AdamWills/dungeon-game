// The pause screen (time is paused): a paper doll of your character with all
// twelve gear slots around it, your pockets and party beside it, and details
// for whatever is highlighted. Turns key presses into InvCommands.

import { ALLIES, STANCE_ORDER, STANCES } from '../data/allies';
import { CLASSES } from '../data/classes';
import { INVENTORY_CAP, ITEMS, RARITY_NAMES, SLOT_NAMES } from '../data/items';
import { RACES } from '../data/races';
import { SKILLS } from '../data/skills';
import { UI_TEXT } from '../data/uiText';
import { DAMAGE_TYPES } from '../data/damage';
import { fill } from '../data/battleText';
import { carriedCount, equipComparison, SLOTS, type Slot, weaponOf } from '../game/equipment';
import { skillLevel } from '../game/skills';
import type { Entity, GameState, InvCommand, ItemInstance } from '../game/types';
import type { MenuKey } from './input';
import type { ItemIcons } from './itemIcons';
import { dressedFront, type GearColor, type PlayerSprites } from './playerSprite';
import { centered, FONT, FONT_BIG, wrapLines } from './text';

type Row =
  | { kind: 'worn'; slot: Slot; item?: ItemInstance }
  | { kind: 'pocket'; index: number; item: ItemInstance }
  | { kind: 'ally'; ally: Entity };

const RARITY_COLOR: Record<string, string> = { junk: '#a8a090', standard: '#c8d0c4', special: '#6ab0f0', cursed: '#c060e0', hosts_pick: '#f0c040' };

/** Slot rows are the first 12: six down the left of the doll, six down the right. */
const PER_COLUMN = 6;

/** Plain label for a worn slot (the two ring slots both read "Ring"). */
function slotLabel(slot: Slot): string {
  return slot === 'ring1' || slot === 'ring2' ? SLOT_NAMES.ring : SLOT_NAMES[slot];
}

export class InventoryMenu {
  cursor = 0;
  private dressedKey = '';
  private dressedSprite: HTMLCanvasElement | null = null;
  private colors = new Map<string, GearColor>();

  /** The doll in its worn gear; rebuilt only when the gear changes. */
  private dressed(state: GameState, icons: ItemIcons): HTMLCanvasElement {
    const eq = state.player.equipment ?? {};
    const key = `${state.race}:${state.cls}:` + SLOTS.map((s) => eq[s]?.defId ?? '').join('|');
    if (key !== this.dressedKey || !this.dressedSprite) {
      const worn: Record<string, GearColor> = {};
      for (const slot of SLOTS) {
        const id = eq[slot]?.defId;
        if (id && slot !== 'weapon' && slot !== 'offhand') worn[slot] = this.colorOf(id, icons);
      }
      this.dressedSprite = dressedFront(worn, { race: state.race, cls: state.cls });
      this.dressedKey = key;
    }
    return this.dressedSprite;
  }

  /** An item's colours, taken from its icon: the commonest bright colour, plus a shade and a highlight. */
  private colorOf(defId: string, icons: ItemIcons): GearColor {
    const hit = this.colors.get(defId);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d')!;
    icons(g, defId, 0, 0, 1);
    const d = g.getImageData(0, 0, 16, 16).data;
    const counts = new Map<string, number>();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const lum = d[i] + d[i + 1] + d[i + 2];
      if (lum < 90) continue; // skip outlines
      const k = `${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '8,8,8';
    const [r, gg, b] = top.split(',').map((n) => Number(n) * 16 + 8);
    const hex = (f: number) => `rgb(${Math.min(255, Math.round(r * f))}, ${Math.min(255, Math.round(gg * f))}, ${Math.min(255, Math.round(b * f))})`;
    const col = { main: hex(1), shade: hex(0.72), hi: hex(1.3) };
    this.colors.set(defId, col);
    return col;
  }
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
    const listStart = SLOTS.length;
    const row0 = rows[this.cursor];

    // Left and right move between the doll's two columns and the list; on an
    // ally they change its stance instead.
    if ((key === 'left' || key === 'right') && row0.kind !== 'ally') {
      const c = this.cursor;
      if (c < PER_COLUMN) this.cursor = key === 'right' ? c + PER_COLUMN : c;
      else if (c < listStart) this.cursor = key === 'left' ? c - PER_COLUMN : rows.length > listStart ? listStart : c;
      else if (key === 'left') this.cursor = PER_COLUMN;
      return null;
    }
    if (key === 'up') this.cursor = (this.cursor + rows.length - 1) % rows.length;
    else if (key === 'down') this.cursor = (this.cursor + 1) % rows.length;
    const row = rows[this.cursor];
    if (row.kind === 'ally') {
      if (key === 'talk') return { kind: 'talk', allyId: row.ally.id };
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

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, state: GameState, icons: ItemIcons, _sprites: PlayerSprites, hostHistory: string[] = []): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
    ctx.fillRect(0, 0, w, h);
    const pw = Math.min(1060, w - 24);
    const ph = Math.min(620, h - 24);
    const px = Math.round((w - pw) / 2);
    const py = Math.round((h - ph) / 2);
    ctx.fillStyle = '#0e1210';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#3a4a3a';
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);

    ctx.textBaseline = 'top';
    ctx.font = FONT_BIG;
    ctx.fillStyle = '#d9b310';
    ctx.fillText('INVENTORY', px + 20, py + 14);
    ctx.font = FONT;
    ctx.fillStyle = '#9aa89a';
    ctx.fillText(`${UI_TEXT.inventory.sub}   Seed ${state.seed}`, px + 180, py + 20);

    const rows = this.rows(state);
    this.cursor = Math.min(this.cursor, rows.length - 1);
    const top = py + 56;

    // --- the paper doll ----------------------------------------------------
    const dollW = Math.round(pw * 0.4);
    const box = 44;
    const gapY = Math.max(52, Math.floor((ph - 140) / PER_COLUMN));
    const leftX = px + 20;
    const rightX = px + dollW - box - 10;
    const size = Math.min(rightX - leftX - box - 30, 24 * 7);
    // Dressed in whatever is worn, with the weapon and off-hand item in its hands.
    const sprite = this.dressed(state, icons);
    const dx0 = Math.round(px + dollW / 2 + 5 - size / 2);
    const k = size / 24;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, dx0, top + 40, size, size);
    const eq = state.player.equipment ?? {};
    if (eq.weapon) icons(ctx, eq.weapon.defId, Math.round(dx0 + 16 * k), Math.round(top + 40 + 8 * k), k * 0.6);
    if (eq.offhand) icons(ctx, eq.offhand.defId, Math.round(dx0 - 2 * k), Math.round(top + 40 + 10 * k), k * 0.6);
    ctx.restore();
    ctx.fillStyle = '#c8d0c4';
    centered(ctx, `${RACES[state.race].name} ${CLASSES[state.cls].name}, level ${state.level}`, px + dollW / 2 + 5, top + 50 + size);

    SLOTS.forEach((slot, i) => {
      const col = i < PER_COLUMN ? 0 : 1;
      const x = col === 0 ? leftX : rightX;
      const y = top + (i % PER_COLUMN) * gapY;
      const selected = i === this.cursor;
      const item = state.player.equipment?.[slot];
      const def = item && ITEMS[item.defId];
      ctx.fillStyle = selected ? '#2a2a12' : '#161c18';
      ctx.fillRect(x, y, box, box);
      ctx.strokeStyle = selected ? '#d9b310' : def ? RARITY_COLOR[def.rarity] : '#2e3a30';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, box - 1, box - 1);
      ctx.lineWidth = 1;
      if (item) icons(ctx, item.defId, x + 6, y + 6, 2);
      ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillStyle = selected ? '#f4ecd0' : '#6f7d70';
      const label = slotLabel(slot);
      const lx = col === 0 ? x + box + 6 : x - ctx.measureText(label).width - 6;
      ctx.fillText(label, lx, y + 4);
      ctx.font = FONT;
    });

    // --- pockets and party ----------------------------------------------------
    const listX = px + dollW + 24;
    const listW = Math.round(pw * 0.27);
    let y = top;
    const pockets = state.player.inventory.length;
    ctx.fillStyle = '#6f7d70';
    ctx.fillText(`POCKETS ${carriedCount(state.player)}/${INVENTORY_CAP}${pockets ? '' : ' (empty)'}`, listX, y);
    y += 24;
    const lineH = 24;
    rows.forEach((row, i) => {
      if (row.kind === 'worn') return;
      if (row.kind === 'ally' && i === SLOTS.length + pockets) {
        y += 8;
        ctx.fillStyle = '#6f7d70';
        ctx.fillText('PARTY', listX, y);
        y += 24;
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
        ctx.fillText(`${giftTo ? 'GIVE TO > ' : ''}${def.short} ${row.ally.stats.hp}/${row.ally.stats.maxHp}  < ${STANCES[row.ally.ally!.stance].name} >`, listX, y);
      } else {
        icons(ctx, row.item.defId, listX, y - 2, 1.25);
        const def = ITEMS[row.item.defId];
        ctx.fillStyle = selected ? '#f4ecd0' : RARITY_COLOR[def?.rarity ?? 'standard'];
        const name = wrapLines(ctx, def?.name ?? row.item.defId, listW - 34)[0];
        ctx.fillText(name, listX + 26, y);
      }
      y += lineH;
    });

    // --- details for the highlighted thing, then your stats --------------------
    const dx = listX + listW + 20;
    const dw = px + pw - 20 - dx;
    let dy = top;
    const block = (text: string, color: string, gap = 8) => {
      ctx.fillStyle = color;
      for (const l of wrapLines(ctx, text, dw)) {
        ctx.fillText(l, dx, dy);
        dy += 19;
      }
      dy += gap;
    };
    const row = rows[this.cursor];
    if (row?.kind === 'ally') {
      const a = ALLIES[row.ally.defId];
      const stance = STANCES[row.ally.ally!.stance];
      ctx.font = FONT_BIG;
      block(a.name, '#9fd68a', 4);
      ctx.font = FONT;
      const s = row.ally.stats;
      block(`HP ${s.hp}/${s.maxHp}   Strength ${s.str}   Speed ${s.speed}   Evasion ${s.evasion}   Armor ${s.armor}`, '#c8d0c4');
      block(`${a.passive.name}: ${a.passive.help}`, '#e8e4da');
      block(`${a.ability.name}: ${a.ability.help}`, '#e8e4da');
      block(`Stance: ${stance.name}. ${stance.help}`, '#d9b310');
      const known = row.ally.ally!.known ?? [];
      if (known.length) {
        block(UI_TEXT.inventory.known, '#e070c0', 2);
        for (const fact of known) block(`- ${fact}`, '#e8e4da', 2);
      }
      block(UI_TEXT.inventory.allyKeys, '#9aa89a');
    } else if (row?.kind === 'worn' && !row.item) {
      ctx.font = FONT_BIG;
      block(slotLabel(row.slot), '#6f7d70', 4);
      ctx.font = FONT;
      block(UI_TEXT.inventory.emptySlot, '#9aa89a');
    } else if (row) {
      const def = ITEMS[row.item!.defId];
      ctx.font = FONT_BIG;
      block(def.name, RARITY_COLOR[def.rarity], 4);
      ctx.font = FONT;
      block(`${RARITY_NAMES[def.rarity]}${def.invented ? ', one of a kind' : ''}${def.cursed ? ' (stuck once worn)' : ''}${def.slot ? `, worn on: ${SLOT_NAMES[def.slot]}` : ''}`, '#6f7d70');
      block(def.help, '#e8e4da');
      block(`"${def.description}"`, '#9aa89a');
      // In your pockets: what it would replace and every change, even none (user request).
      const cmp = row.kind === 'pocket' ? equipComparison(state, def.id) : null;
      if (cmp) {
        const P = UI_TEXT.prize;
        block(cmp.blockedBy ? fill(P.blocked, { item: cmp.blockedBy }) : cmp.replaces ? fill(P.replaces, { item: cmp.replaces, slot: cmp.slotName }) : fill(P.emptySlot, { slot: cmp.slotName }), cmp.blockedBy ? '#ff6a50' : '#c8d0c4', 2);
        for (const c of cmp.changes) {
          const better = typeof c.after === 'number' && typeof c.before === 'number' ? c.after > c.before : null;
          block(`${c.name} ${c.before} → ${c.after}`, better === null ? '#6ab0f0' : better ? '#7aea5a' : '#ff6a50', 0);
        }
        if (!cmp.changes.length) block(P.noChanges, '#9aa89a', 0);
      }
      dy += 8;
      const action =
        row.kind === 'worn' ? (def.cursed ? UI_TEXT.inventory.cursed : UI_TEXT.inventory.unequip) : def.slot ? UI_TEXT.inventory.equip : def.use ? (def.use.battleOnly || def.use.target !== 'self' ? UI_TEXT.inventory.battleOnly : UI_TEXT.inventory.use) : UI_TEXT.inventory.carry;
      const give = row.kind === 'pocket' && state.party.length && def.use?.consumable ? ` ${UI_TEXT.inventory.give}` : '';
      block(action + give, '#d9b310');
    }

    const s = state.player.stats;
    const wpn = weaponOf(state.player);
    const stats = [
      `HP ${s.hp}/${s.maxHp}`,
      `Strength ${s.str}   Speed ${s.speed}`,
      `Evasion ${s.evasion}   Armor ${s.armor}   Charm ${s.charm}`,
      `Weapon: ${wpn.name} (${wpn.damage} ${DAMAGE_TYPES[wpn.type].name.toLowerCase()})`,
      ...Object.values(SKILLS).map((k) => `${k.name}: level ${skillLevel(state, k.id)}`),
    ];
    const sy = py + ph - 50 - stats.length * 20;
    ctx.fillStyle = '#6f7d70';
    ctx.fillText('YOUR STATS', dx, sy - 22);
    ctx.fillStyle = '#c8d0c4';
    stats.forEach((t, i) => ctx.fillText(t, dx, sy + i * 20));

    // Chet's last line, under the pockets.
    const last = hostHistory[hostHistory.length - 1];
    if (last) {
      ctx.fillStyle = '#6f7d70';
      ctx.fillText('CHET SAID', listX, py + ph - 92);
      ctx.fillStyle = '#d9b310';
      wrapLines(ctx, last, listW).slice(0, 2).forEach((l, i) => ctx.fillText(l, listX, py + ph - 72 + i * 18));
    }
    ctx.fillStyle = '#9aa89a';
    centered(ctx, this.giving ? UI_TEXT.inventory.giveKeys : UI_TEXT.inventory.keys, px + pw / 2, py + ph - 26);
  }
}
