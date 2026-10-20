// Battle log lines, mostly Chet Valentine calling the action. Variants are
// picked without touching the game RNG, so adding a line never changes a
// fight's outcome.

export const BATTLE_TEXT = {
  open: {
    player_ambush: [
      'OHHH, a sneak attack! The judges LOVE initiative! Bonus damage this round!',
      'You caught them napping! Bonus round, folks, bonus round!',
    ],
    enemy_ambush: [
      'Ooh, ambushed! They get the first swing, and a little something extra. That is the game!',
      'Caught from behind! Somebody check the contestant\'s peripheral vision.',
    ],
    normal: [
      'It\'s a SHOWDOWN! Contestant, come on down!',
      'Fighters, take your marks! Keep it clean. No, don\'t, actually.',
    ],
  },
  joined: ['{name} joins the fight! Nobody invited it, and we love that.', '{name} wanders onto the set. Security? No? Great!'],
  playerHit: [
    'You hit {target} with the {weapon} for {dmg}.',
    'You apply the {weapon} to {target}. {dmg} damage! Big hand, folks!',
    'The {weapon} meets {target}. {dmg} damage. The pipe is fine.',
  ],
  playerMiss: [
    'You swing at {target} and hit only air. Ooh, so close! Well, not that close.',
    'You miss {target}. Let\'s see that again in slow motion. Actually, let\'s not.',
  ],
  enemyMiss: ['{actor} tries {move} and misses! The contestant lives to lose another day!', "{actor}'s {move} goes wide. Somebody get that on the highlight reel."],
  bonus: ' (Ambush bonus.)',
  braced: ' (Bracing halved it.)',
  kill: [
    '{target} has been ELIMINATED! Let\'s hear it for violence!',
    '{target} is down! And it is NOT getting back up! What a show!',
    '{target} is reduced to a mess our cleaning crew will be talking about for weeks.',
  ],
  defend: ['You brace yourself. Great posture! Terrible odds, great posture.', 'You raise your guard. The folks at home are on the edge of their seats.'],
  cooldown: '{ability} is recharging for {turns} more turns. Patience, contestant! Patience!',
  noItems: 'Your pockets contain lint and regret. Lint is not a usable prize.',
  fleeOk: ['You run for it! Leaving so soon? Don\'t worry, they\'ll follow you. They always do!', 'You flee the scene! The fastest you have moved all season!'],
  fleeFail: ['You try to flee and trip over your own feet. Classic television!', 'Escape denied! Ooh, the door is a painting. Who put that there?'],
  victory: ['VICTORY! And the crowd goes WILD!', 'Our contestant survives! Nobody had that on the board, folks!'],
  defeat: ['The contestant is DOWN! Folks, that is TELEVISION!'],
  statusOn: '{target} is now {status}!',
  statusOnYou: 'You are now {status}!',
  resisted: '{target} shrugs off being {status}. Show-off.',
  statusOff: '{target} is no longer {status}.',
  statusOffYou: 'You are no longer {status}.',
  cantUseHere: 'That is not something you can use in a fight, contestant!',
  hasteExtra: 'You are moving so fast the cameras can barely keep up!',
  cantImprov: 'That is not going to work right now, contestant. Pick something else!',
  badIdeaSpent: 'One Bad Idea per fight, contestant! House rules!',
  propWrecked: 'The {prop} is wrecked. Somebody bill the contestant.',
  // The party (M4).
  enemyHitsAlly: [
    '{actor} goes for {target} with {move}. {dmg} damage!',
    '{actor} hits {target} with {move} for {dmg}. Rude!',
    '{actor} uses {move} on {target}. {dmg} damage, and the cameras caught all of it!',
  ],
  enemyMissesAlly: ['{actor} tries {move} on {target} and misses!', '{target} dodges {actor}\'s {move}. Nice footwork!'],
  allyMiss: ['{ally} misses {target}. Classic {ally}.', '{ally} swings at {target} and finds only air.'],
  allyDefend: ['{ally} braces. Smart. Cowardly, but smart.', '{ally} hunkers down.'],
  allyDown: ['{target} is DOWN! Eliminated! Oh, that one is going to hurt the ratings!', '{target} is OUT! A moment of silence! That will do!'],
  spareOk: ['You spare {target}! And {target} switches sides, folks! Loyalty is so fluid down here!'],
  spareFail: ['You offer {target} mercy. {target} offers you a nail. Rejected!', '{target} is not convinced. Try being more charming!'],
  spareNotYet: 'Rough {target} up a bit more first, contestant! Nobody takes mercy from a full health bar!',
  typedNoEffect: '(No damage or healing.)',
  swapped: 'You switch to the {weapon}: {type} damage. That does not take your turn.',
  weakNote: ' WEAK SPOT ({type})!',
  resistNote: ' It shrugs off {type}.',
  weakFound: 'Ooh, {target} HATES {type}! Note that down, folks!',
  goAgain: 'It is off balance! Go again, contestant!',
  windup: '{actor} is winding up {move}! Next turn it lands big. Defend, or put it down first.',
  windupAll: '{actor} is winding up {move}! Next turn it hits everybody. Brace yourselves!',
  eliteSpotted: 'Oh, look at THAT! The {name} is an elite, folks. Tougher, meaner, and it is carrying a prize!',
  summoned: '{actor} uses {move}! {count} {name} join the fight!',
  skitchSpotted: 'Ooh, is that Skitch? This little guy has been looking for the exit since the pilot episode! Rough him up, then show some mercy!',
  partingHit: '{actor} gets a parting shot on {target} for {dmg} while you leg it!',
  backfireAlly: 'It lands on {target} instead, for {dmg}! {target} will remember this.',
  remedySide: 'Side effect: {target} is now {status}!',
  secondOpinion: '{ally} gives everyone a second opinion: up to +{amount} HP all round.',
  xp: '+{xp} XP.',
  lateFees: '{name} pays {dmg} in late fees. Overdue Invoice!',
  itemOnAlly: 'You give {target} the {item}. +{amount} HP. Teamwork!',
  tokens: '+{amount} Prize Tokens.',
  token: '+1 Prize Token.',
  skillUp: '{skill} is now level {level}! {help}',
  allyHolds: '{ally} holds back and looks at you. Mercy, or not?',
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
