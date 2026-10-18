// Battle menu: cursor state (UI only) that turns key presses into a
// BattleCommand for the next fixed step.

import { ABILITIES, HEX_TURNS } from '../data/abilities';
import { fill } from '../data/battleText';
import { CLASSES } from '../data/classes';
import { ITEMS } from '../data/items';
import { UI_TEXT } from '../data/uiText';
import { currentActor, enemiesOf, hasStatus } from '../battle/turns';
import { baseDamage, hitChance } from '../game/combat';
import { weaponOf } from '../game/equipment';
import type { BattleCommand, BattleState, GameState } from '../game/types';
import type { MenuKey } from './input';

export type MenuOption = { id: 'attack' | 'ability' | 'item' | 'defend' | 'flee'; label: string; enabled: boolean; help: string };

/** What a target choice is for. */
type Pending = { kind: 'attack' } | { kind: 'ability'; abilityId: string } | { kind: 'item'; slot: number };

export class BattleMenu {
  level: 'main' | 'target' | 'item' = 'main';
  cursor = 0;
  target = 0;
  itemCursor = 0;
  pending: Pending = { kind: 'attack' };
  private battle: BattleState | null = null;

  options(state: GameState): MenuOption[] {
    const cls = CLASSES[state.cls];
    const ability = ABILITIES[cls.ability];
    const cd = state.player.cooldowns[cls.ability] ?? 0;
    const weapon = weaponOf(state.player);
    const usable = state.player.inventory.filter((i) => ITEMS[i.defId]?.use).length;
    const H = UI_TEXT.help;
    const abilityHelp = !ability ? '' : cd > 0 ? fill(H.recharging, { name: ability.name, turns: cd }) : ability.help;
    return [
      { id: 'attack', label: `Attack (${weapon.name})`, enabled: true, help: fill(H.attack, { weapon: weapon.name }) },
      { id: 'ability', label: ability ? (cd > 0 ? `${ability.name} (${cd})` : ability.name) : 'Ability', enabled: !!ability && cd === 0, help: abilityHelp },
      { id: 'item', label: `Item (${usable})`, enabled: usable > 0, help: usable > 0 ? H.item : H.noItems },
      { id: 'defend', label: 'Defend', enabled: true, help: H.defend },
      { id: 'flee', label: 'Flee', enabled: true, help: H.flee },
    ];
  }

  /** Alive enemies in screen order, for target selection. */
  targets(state: GameState): string[] {
    return state.battle ? enemiesOf(state.battle).filter((c) => c.alive).map((c) => c.id) : [];
  }

  handle(key: MenuKey, state: GameState): BattleCommand | null {
    const battle = state.battle;
    if (!battle) return null;
    if (battle !== this.battle) {
      this.battle = battle;
      this.level = 'main';
      this.cursor = 0;
    }
    if (battle.result) return key === 'confirm' ? { kind: 'continue' } : null;
    if (currentActor(battle)?.side !== 'player') return null;

    if (this.level === 'target') {
      const ids = this.targets(state);
      if (key === 'left' || key === 'up') this.target = (this.target + ids.length - 1) % ids.length;
      else if (key === 'right' || key === 'down') this.target = (this.target + 1) % ids.length;
      else if (key === 'back') this.level = this.pending.kind === 'item' ? 'item' : 'main';
      else if (key === 'confirm' && ids.length) {
        this.level = 'main';
        const targetId = ids[this.target % ids.length];
        const p = this.pending;
        if (p.kind === 'attack') return { kind: 'attack', targetId };
        if (p.kind === 'ability') return { kind: 'ability', abilityId: p.abilityId, targetId };
        return { kind: 'item', slot: p.slot, targetId };
      }
      return null;
    }

    if (this.level === 'item') {
      const n = state.player.inventory.length;
      if (key === 'up') this.itemCursor = (this.itemCursor + n - 1) % Math.max(1, n);
      else if (key === 'down') this.itemCursor = (this.itemCursor + 1) % Math.max(1, n);
      else if (key === 'back') this.level = 'main';
      else if (key === 'confirm') {
        const slot = Math.min(this.itemCursor, n - 1);
        const def = ITEMS[state.player.inventory[slot]?.defId];
        if (def?.use?.target === 'one_enemy') return this.chooseTarget(state, { kind: 'item', slot });
        this.level = 'main';
        return { kind: 'item', slot };
      }
      return null;
    }

    const opts = this.options(state);
    if (key === 'up') this.cursor = (this.cursor + opts.length - 1) % opts.length;
    else if (key === 'down') this.cursor = (this.cursor + 1) % opts.length;
    else if (key === 'confirm') {
      const opt = opts[this.cursor];
      switch (opt.id) {
        case 'attack':
          return this.chooseTarget(state, { kind: 'attack' });
        case 'ability': {
          const abilityId = CLASSES[state.cls].ability;
          const cd = state.player.cooldowns[abilityId] ?? 0;
          // Cooldown refusals go through anyway so the host can comment.
          if (cd === 0 && ABILITIES[abilityId]?.target === 'one_enemy') return this.chooseTarget(state, { kind: 'ability', abilityId });
          return { kind: 'ability', abilityId };
        }
        case 'item':
          if (!opt.enabled) return { kind: 'item', slot: -1 };
          this.level = 'item';
          this.itemCursor = Math.max(0, state.player.inventory.findIndex((i) => ITEMS[i.defId]?.use));
          return null;
        case 'defend':
          return { kind: 'defend' };
        case 'flee':
          return { kind: 'flee' };
      }
    }
    return null;
  }

  private chooseTarget(state: GameState, pending: Pending): null {
    this.pending = pending;
    this.level = 'target';
    this.target = Math.min(this.target, Math.max(0, this.targets(state).length - 1));
    return null;
  }

  itemRows(state: GameState): { label: string; enabled: boolean }[] {
    return state.player.inventory.map((i) => {
      const def = ITEMS[i.defId];
      return { label: def?.name ?? i.defId, enabled: !!def?.use };
    });
  }

  /** Plain help for whatever the cursor is on. */
  help(state: GameState): string {
    const battle = state.battle;
    if (!battle) return '';
    if (this.level === 'item') {
      const inst = state.player.inventory[this.itemCursor];
      const def = inst && ITEMS[inst.defId];
      if (!def) return UI_TEXT.help.noItems;
      return def.use ? def.help : `${def.help} ${UI_TEXT.help.equipOnly}`;
    }
    if (this.level === 'target') {
      const id = this.targets(state)[this.target];
      const foe = battle.combatants.find((c) => c.id === id);
      const me = battle.combatants.find((c) => c.side === 'player');
      if (!foe || !me) return UI_TEXT.help.targetKeys;
      const p = this.pending;
      let what: string;
      if (p.kind === 'attack') {
        const dmg = baseDamage(weaponOf(state.player).damage, me.stats.str, foe.stats.armor) * (hasStatus(foe, 'hexed') ? 2 : 1);
        what = fill(UI_TEXT.help.target, { name: foe.name, hp: foe.stats.hp, max: foe.stats.maxHp, chance: Math.round(hitChance(foe.stats.evasion) * 100), dmg });
      } else if (p.kind === 'ability') {
        what = fill(UI_TEXT.help.hexTarget, { name: foe.name, hp: foe.stats.hp, max: foe.stats.maxHp, turns: HEX_TURNS });
      } else {
        const def = ITEMS[state.player.inventory[p.slot]?.defId];
        what = `${foe.name}: ${foe.stats.hp}/${foe.stats.maxHp} HP. ${def?.help ?? ''}`;
      }
      return `${what} ${UI_TEXT.help.targetKeys}`;
    }
    return this.options(state)[this.cursor]?.help ?? '';
  }
}
