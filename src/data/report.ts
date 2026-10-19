// The elimination report on the death screen (GDD "EliminationReport"):
// who you were, what got you, how the run went, your last words, a useless
// parting gift and Chet's sign-off.

/** Your last words are your last action, in your own voice. */
export const LAST_WORDS: Record<string, string[]> = {
  attack: ['I\'ve got this one.', 'Hold still.', 'Watch and learn.'],
  ability: ['Stand back, I\'m a professional.', 'Time for my special move!'],
  item: ['I\'ll just use this {item}.', 'This {item} should help.'],
  defend: ['Brace! Brace!', 'I\'ll just wait this out.'],
  flee: ['Nope.', 'I\'ll be right back.'],
  badIdea: ['What does this button do?', 'Hold my drink.'],
  jank: ['What if I combine these?', 'Trust me, this will work.'],
  prop: ['Watch this.', 'I saw this in a film once.'],
  spare: ['Aww, look at his little face.'],
  eat: ['I\'ll just eat this.', 'Five-second rule.'],
  walk: ['It\'s probably just water.', 'I\'m sure it\'s fine.'],
  none: ['...', 'Is this thing on?'],
};

export const PARTING_GIFTS = [
  'a commemorative DESCEND & WIN! mug, already chipped',
  'a home version of the game, missing all the pieces',
  'a year\'s supply of sewer water',
  'a signed photo of Chet Valentine, signed by someone else',
  'a gift card for a restaurant that closed in 1983',
  'a novelty foam finger, slightly bitten',
];

export const SIGN_OFFS = [
  'Tough break, kid! Let\'s hear it for the {enemy}, folks!',
  'What a run! Well. A run. Give it up for the {enemy}!',
  'And THAT is why we have a waiver! Goodnight, folks!',
  'Don\'t touch that dial! We\'ll have a new contestant right after this!',
  'They came, they saw, they met the {enemy}! Beautiful!',
];

export const REPORT = {
  title: 'YOU DIED',
  subtitle: 'What a run! Well. A run.',
  badge: "YOU'RE OUT!",
  lines: {
    who: 'Contestant: one (1) {race} {class}, level {level}.',
    cause: 'Eliminated by: {enemy}, with a lovely {move}.',
    record: 'Survived: {fights}, {badIdeas}, {allies}.',
    lastWords: 'Last words: "{lastWords}"',
    gift: 'Your parting gift: {gift}.',
    chet: 'Chet says: "{signOff}"',
  },
  fights: ['no fights', '1 fight', '{n} fights'],
  badIdeas: ['no Bad Ideas', '1 Bad Idea', '{n} Bad Ideas'],
  allies: ['no allies', '1 ally', '{n} allies'],
  alliesLost: ' ({n} not for long)',
  prompt: 'Press ENTER to start a new run.',
};

/** "no fights" / "1 fight" / "3 fights". */
export function counted(forms: string[], n: number): string {
  return (n === 0 ? forms[0] : n === 1 ? forms[1] : forms[2]).replace('{n}', String(n));
}
