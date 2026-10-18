// Plain interface text: menu help, headings and labels. The Auditor's voice
// lives in the log, notices and reports; this file says what things do.

export const UI_TEXT = {
  help: {
    attack: 'Hit one enemy with your {weapon}. You choose the target next.',
    item: 'Use something from your pockets. Takes your turn.',
    noItems: 'You have no items left.',
    defend: 'Take half damage until your next turn.',
    flee: 'Try to escape back to the map. Easier if you are faster than them. A failed try costs your turn.',
    recharging: '{name} is recharging: ready in {turns} of your turns.',
    target: '{name}: {hp}/{max} HP. You hit {chance}% of the time, for {dmg} damage.',
    targetKeys: 'Arrows choose, Enter attacks, Esc goes back.',
  },
  result: {
    won: { title: 'VICTORY', sub: 'Dispute resolved.' },
    fled: { title: 'YOU GOT AWAY', sub: 'Filed as a "strategic withdrawal". They will keep chasing you.' },
    lost: { title: 'YOU DIED', sub: 'An incident report is being drafted.' },
    prompt: 'Press ENTER to continue',
  },
  bubbles: { '!': 'spotted you', '?': 'heard you', z: 'asleep' } as Record<string, string>,
};
