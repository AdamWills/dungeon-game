// Battle log lines. Variants are picked without touching the game RNG, so
// adding a line never changes a fight's outcome.

export const BATTLE_TEXT = {
  open: {
    player_ambush: [
      'POLICY NOTICE 2-A: Unannounced violence detected. Bonus damage approved for one round.',
      'You catch them unaware. The Auditor marks this as initiative.',
    ],
    enemy_ambush: [
      'POLICY NOTICE 2-B: You have been caught. Your assailant receives a punctuality bonus.',
      'Ambushed. The Auditor notes you were looking the wrong way, again.',
    ],
    normal: [
      'A dispute has been opened. Please resolve it violently.',
      'Hostilities commence. Please keep your limbs inside the incident at all times.',
    ],
  },
  joined: ['{name} joins the fight. Nobody invited it.', '{name} wanders in, sensing paperwork.'],
  playerHit: [
    'You hit {target} with the {weapon} for {dmg}.',
    'You apply the {weapon} to {target}. {dmg} damage, receipt pending.',
    'The {weapon} meets {target}. {dmg} damage. The pipe is fine.',
  ],
  playerMiss: [
    'You swing at {target} and hit only air, which files no complaint.',
    'You miss {target}. It noticed.',
  ],
  enemyMiss: ['{actor} tries {move} and misses.', "{actor}'s {move} goes wide. Embarrassing for everyone."],
  bonus: ' (Ambush bonus.)',
  braced: ' (Bracing halved it.)',
  kill: [
    '{target} is no longer a going concern.',
    '{target} dies. The paperwork will outlive it.',
    '{target} is reduced to a mess the janitorial budget cannot cover.',
  ],
  defend: ['You brace yourself. It is mostly posture.', 'You assume a defensive stance, as taught by nobody.'],
  cooldown: '{ability} is on cooldown for {turns} more turns. The Auditor has noted the attempt.',
  noItems: 'Your pockets contain lint and regret.',
  fleeOk: ['You flee. The Auditor records it as a strategic withdrawal, in quotes.', 'You run. It is the most athletic thing you have done this year.'],
  fleeFail: ['You try to flee and trip over your own dignity.', 'Escape denied. They are faster, or you are slower. Both, really.'],
  victory: ['Dispute resolved. All parties but you have been closed.', 'Victory. The Auditor files it under "unexpected".'],
  defeat: ['You have died. The incident report is being drafted with enthusiasm.'],
} as const;

/** Stable variant pick from a few integers, independent of the game RNG. */
export function variant<T>(lines: readonly T[], ...salt: number[]): T {
  let h = 2166136261;
  for (const n of salt) h = Math.imul(h ^ (n | 0), 16777619);
  return lines[(h >>> 0) % lines.length];
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}
