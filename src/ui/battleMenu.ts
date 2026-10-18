// Battle menu: cursor state (UI only) that turns key presses into a
// BattleCommand for the next fixed step.

import { ABILITIES } from '../data/abilities';
import { CLASSES } from '../data/classes';
import { fill } from '../data/battleText';
import { ITEMS } from '../data/items';
import { UI_TEXT } from '../data/uiText';
import { baseDamage, hitChance } from '../game/combat';
import { currentActor, enemiesOf } from '../battle/turns';
import type { BattleCommand, BattleState, GameState } from '../game/types';
import type { MenuKey } from './input';

export type MenuOption = { id: 'attack' | 'ability' | 'item' | 'defend' | 'flee'; label: string; enabled: boolean; help: string };

export class BattleMenu {
  level: 'main' | 'target' | 'item' = 'main';
  cursor = 0;
  target = 0;
  itemCursor = 0;
  private battle: BattleState | null = null;

  options(state: GameState): MenuOption[] {
    const cls = CLASSES[state.player.defId];
    const ability = ABILITIES[cls.ability];
    const cd = state.player.cooldowns[cls.ability] ?? 0;
    const items = state.player.inventory.length;
    const H = UI_TEXT.help;
    const abilityHelp = !ability ? '' : cd > 0 ? fill(H.recharging, { name: ability.name, turns: cd }) : ability.help;
    return [
      { id: 'attack', label: `Attack (${cls.weapon.name})`, enabled: true, help: fill(H.attack, { weapon: cls.weapon.name }) },
      { id: 'ability', label: ability ? (cd > 0 ? `${ability.name} (${cd})` : ability.name) : 'Ability', enabled: !!ability && cd === 0, help: abilityHelp },
      { id: 'item', label: `Item (${items})`, enabled: items > 0, help: items > 0 ? H.item : H.noItems },
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
      else if (key === 'back') this.level = 'main';
      else if (key === 'confirm' && ids.length) {
        this.level = 'main';
        return { kind: 'attack', targetId: ids[this.target % ids.length] };
      }
      return null;
    }

    if (this.level === 'item') {
      const n = state.player.inventory.length;
      if (key === 'up') this.itemCursor = (this.itemCursor + n - 1) % Math.max(1, n);
      else if (key === 'down') this.itemCursor = (this.itemCursor + 1) % Math.max(1, n);
      else if (key === 'back') this.level = 'main';
      else if (key === 'confirm') {
        this.level = 'main';
        return { kind: 'item', slot: Math.min(this.itemCursor, n - 1) };
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
          this.level = 'target';
          this.target = Math.min(this.target, Math.max(0, this.targets(state).length - 1));
          return null;
        case 'ability':
          // Cooldown refusals go through anyway so the Auditor can comment.
          return { kind: 'ability', abilityId: CLASSES[state.player.defId].ability };
        case 'item':
          if (!opt.enabled) return { kind: 'item', slot: 0 };
          this.level = 'item';
          this.itemCursor = 0;
          return null;
        case 'defend':
          return { kind: 'defend' };
        case 'flee':
          return { kind: 'flee' };
      }
    }
    return null;
  }

  itemLabels(state: GameState): string[] {
    return state.player.inventory.map((i) => ITEMS[i.defId]?.name ?? i.defId);
  }

  /** Plain help for whatever the cursor is on. */
  help(state: GameState): string {
    const battle = state.battle;
    if (!battle) return '';
    if (this.level === 'item') {
      const inst = state.player.inventory[this.itemCursor];
      return inst ? (ITEMS[inst.defId]?.help ?? '') : UI_TEXT.help.noItems;
    }
    if (this.level === 'target') {
      const id = this.targets(state)[this.target];
      const foe = battle.combatants.find((c) => c.id === id);
      const me = battle.combatants.find((c) => c.side === 'player');
      if (!foe || !me) return UI_TEXT.help.targetKeys;
      const weapon = CLASSES[state.player.defId].weapon.damage;
      const line = fill(UI_TEXT.help.target, {
        name: foe.name,
        hp: foe.stats.hp,
        max: foe.stats.maxHp,
        chance: Math.round(hitChance(foe.stats.evasion) * 100),
        dmg: baseDamage(weapon, me.stats.str, foe.stats.armor),
      });
      return `${line} ${UI_TEXT.help.targetKeys}`;
    }
    return this.options(state)[this.cursor]?.help ?? '';
  }
}
