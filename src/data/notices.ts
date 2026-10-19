// On-screen House Rules and end-of-run screens, in the voice of Chet
// Valentine, host of DESCEND & WIN! Chet never explains mechanics plainly;
// he announces House Rules. Full host line pools arrive in M4.

export const NOTICES = {
  movement:
    'HOUSE RULE #1: Contestants move with the ARROW KEYS or WASD. The walls are real, folks. Mostly.',
  stairs:
    'HOUSE RULE #2: The stairs down are in the FLOOR BOSS\'s lair! Find it, beat it, then stand on the stairs and press E or SPACE to finish the round. Bigger residents along the way carry bigger prizes!',
  pause: 'HOUSE RULE #3: ESC means a commercial break! Nothing moves until we are back on air.',
  dash: 'HOUSE RULE #4: SHIFT for a quick sprint past the residents! Sprinting is loud, and the sneakers need a moment to recharge.',
  inventory: 'HOUSE RULE #6: ESC or I opens your pockets and pauses the show. Equip something nice for the cameras!',
  sneak: 'HOUSE RULE #5: Residents see in cones and hear footsteps. Tiptoe up behind them for a big surprise bonus!',
  weakSpots: 'HOUSE RULE #7: Everybody down here has a weak spot! Blunt, Sharp, Fire or Gross: find theirs and you get to go again. Switch weapons, throw things, set things on fire!',
  paused: 'COMMERCIAL BREAK. Stay right where you are. Press ESC when you are ready to go back on air.',
  onStairs: 'You are on the stairs. Press E to take them and finish the run.',
  bossHud: { hidden: 'FLOOR BOSS: not found', found: 'FLOOR BOSS: {boss} (TAB map)', beaten: 'FLOOR BOSS: beaten, stairs open' },
  onSealedStairs: 'The stairs are sealed until the floor boss is beaten.',

  died: {
    title: 'YOU DIED',
    subtitle: 'Thanks for playing, contestant!',
    badge: "YOU'RE OUT!",
    lines: [
      'Contestant: one (1) {class}, previously alive.',
      'Eliminated by: {enemy}, with a lovely {move}.',
      'Your parting gift: a commemorative DESCEND & WIN! mug, already chipped.',
      'Chet says: "Tough break, kid! Let\'s hear it for the {enemy}, folks!"',
    ],
    prompt: 'Press ENTER to start a new run.',
  },
  escaped: {
    title: 'YOU ESCAPED',
    subtitle: 'Round 1 complete! Stay tuned!',
    badge: 'WINNER!',
    lines: [
      'The contestant has found the stairwell and left the Intake Sewers!',
      'Nobody had that on the board, folks. Nobody.',
      'Chet says: "Don\'t go changing! Actually, do. You\'ll need to."',
    ],
    prompt: 'Press ENTER to start a new run.',
  },
};
