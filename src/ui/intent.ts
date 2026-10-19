// What Read the Room tells you about an enemy's next move, by skill level:
// nothing, then the kind of move, its name, roughly how hard, and at whom.

import { ENEMIES } from '../data/enemies';
import { HEAVY_BONUS, INTENT_KINDS } from '../data/skills';
import { STATUSES } from '../data/statuses';
import { baseDamage } from '../game/combat';
import type { BattleState, Combatant } from '../game/types';
import { fill } from '../data/battleText';

export function intentText(battle: BattleState, enemy: Combatant, level: number): string | null {
  if (level <= 0 || !enemy.alive || !enemy.intent) return null;
  const def = ENEMIES[enemy.defId];
  const move = def.moves.find((m) => m.id === enemy.intent!.moveId);
  if (!move) return null;
  const kind = move.status
    ? fill(INTENT_KINDS.status, { status: STATUSES[move.status.kind].name.toLowerCase() })
    : move.bonus >= HEAVY_BONUS
      ? INTENT_KINDS.heavy
      : INTENT_KINDS.attack;
  if (level === 1) return kind;
  let text = `${move.name}: ${kind.toLowerCase()}`;
  const target = battle.combatants.find((c) => c.id === enemy.intent!.targetId);
  if (level >= 3 && target) text += `, ~${baseDamage(def.weapon + move.bonus, enemy.stats.str, target.stats.armor)} dmg`;
  if (level >= 4 && target) text += ` to ${target.id === 'player' ? 'you' : target.name}`;
  return text;
}
