// Set pieces (GDD "Direction change: AI-first"): hand-built mechanics that a
// floor is built around, each claiming a room of its own. Most have a
// station you talk to (a podium, a kiosk, a pipe with a fella in it); the
// scene is a small script of lines and choices whose effects come from the
// fixed list below, so a later AI twist can only rearrange known pieces.
// Words first; every line is a draft. {vars} are filled in by game/setPieces.

import type { Rarity, StatKey } from './items';

export type SceneEffect =
  /** Hand over tokens: a set amount, or the current bet. */
  | { kind: 'pay'; amount: number | 'bet' }
  /** Receive tokens: a random amount, or double the bet back. */
  | { kind: 'tokens'; amount: [number, number] | 'betWin' }
  /** An item of one of these rarities (an AI one-of-a-kind first, when ready). */
  | { kind: 'prize'; rarities: Rarity[] }
  | { kind: 'heal'; amount: number | 'full' }
  /** Lose HP, never below 1: a set piece is a hard lesson, not a death trap. */
  | { kind: 'hurt'; amount: number }
  /** A permanent stat change for the run; 'random' picks one and names it in {stat}. */
  | { kind: 'boon'; stat: StatKey | 'random'; amount: number }
  /** These creatures pop out; the fight starts when the scene closes. */
  | { kind: 'fight'; enemies: string[] }
  /** Go to one of these nodes by weight; Charm adds to an outcome's weight. */
  | { kind: 'roll'; outcomes: { node: string; weight: number; perCharm?: number }[] }
  /** Mark the floor boss's lair on your map. */
  | { kind: 'reveal' }
  /** Vendors: buy what is on this shelf. */
  | { kind: 'buy'; slot: number }
  /** Charm roll for a better price (once). */
  | { kind: 'haggle'; win: string; lose: string }
  /** Pick-a-Pipe: choose a pipe, then stick or switch. */
  | { kind: 'pipe'; pipe: number }
  | { kind: 'pipeFinal'; switch: boolean }
  /** The Valve Room: turn one. */
  | { kind: 'valve'; valve: number }
  /** Remember something for this set piece (a choice can then require it). */
  | { kind: 'flag'; flag: string }
  /** The set piece is used up. */
  | { kind: 'done' }
  /** Walk away; you can come back. */
  | { kind: 'end' };

export type SceneRequire =
  | { kind: 'canPay'; amount: number | 'bet' }
  | { kind: 'inStock'; slot: number }
  | { kind: 'notHaggled' }
  | { kind: 'noFlag'; flag: string };

export type SceneChoice = { text: string; next?: string; effects?: SceneEffect[]; requires?: SceneRequire };
/** `effects` run once, as the node is entered. */
export type SceneNode = { line: string; choices: SceneChoice[]; effects?: SceneEffect[] };

export type SetPieceDef = {
  id: string;
  /** Plain heading for the scene screen and the map. */
  name: string;
  /** Plain help: what it is and what it does (the prompt bar and the map legend). */
  help: string;
  /** The station's sprite, or null for a room with no one to talk to (the gauntlet). */
  station: string | null;
  /** Smallest room it fits in (inside the walls). */
  minSize: { w: number; h: number };
  /** Chet, the first time you walk in. */
  intros: string[];
  start: string;
  /** Where the scene opens once the set piece is used up. */
  done: string;
  nodes: Record<string, SceneNode>;
};

/** Gutter Mart shelf prices by rarity. Haggling moves them by these fractions. */
export const SHOP = { prices: { junk: 4, standard: 12, special: 30, cursed: 10, hosts_pick: 60 } as Record<Rarity, number>, shelves: ['standard', 'standard', 'special'] as Rarity[], haggleWin: -0.25, haggleLose: 0.2 };
/** The Fella's coin flip. */
export const BET = 10;
/** Pick-a-Pipe: what is behind the three pipes (shuffled per floor), and what each is called when Chet peeks. */
export const PIPES = { contents: ['prize', 'tokens', 'monster'] as const, peek: { tokens: 'a soggy pile of Prize Tokens', monster: 'a very angry Sludge Hopper, who goes right back in' } };
/** The Valve Room: the colours, the marker-pen hint for each, and how many goes you get. */
export const VALVES = {
  colours: ['red', 'green', 'blue', 'gold'],
  hints: [
    'Turn the one the colour of what comes out of contestants.',
    'Turn the one the colour of everything down here.',
    'Turn the one the colour of the host when his projector flickers.',
    "Turn the one the colour of the host's teeth. Not the real ones. He has no real ones.",
  ],
  tries: 2,
};
/** The shrine's boons: how much one point of each stat is worth. */
export const BOON_SIZE: Record<StatKey, number> = { maxHp: 3, str: 1, speed: 1, evasion: 1, armor: 1, charm: 1 };
export const STAT_NAMES: Record<StatKey, string> = { maxHp: 'Max HP', str: 'Strength', speed: 'Speed', evasion: 'Evasion', armor: 'Armor', charm: 'Charm' };

const LEAVE = { text: 'Walk away.', effects: [{ kind: 'end' as const }] };

export const SET_PIECES: Record<string, SetPieceDef> = {
  pick_a_pipe: {
    id: 'pick_a_pipe',
    name: 'Pick-a-Pipe!',
    help: 'A game: pick one of three pipes. One has a prize, one has tokens, one has a monster. One go.',
    station: 'podium',
    minSize: { w: 5, h: 4 },
    intros: [
      "Folks, it's time for everybody's favourite segment: PICK-A-PIPE! Step up to the podium, contestant!",
      'Ooh, you found the PICK-A-PIPE stage! Three pipes, one dream, and something wet in the third one!',
      "PICK-A-PIPE! The only game where losing is technically also a fight! Podium's right there, champ!",
    ],
    start: 'start',
    done: 'done',
    nodes: {
      start: {
        line: "It's PICK-A-PIPE! Three pipes, contestant. One holds a FABULOUS PRIZE. One holds a pile of Prize Tokens. And one holds something that lives in a pipe and is not happy about it. Choose!",
        choices: [
          { text: 'Pipe number 1.', effects: [{ kind: 'pipe', pipe: 0 }] },
          { text: 'Pipe number 2.', effects: [{ kind: 'pipe', pipe: 1 }] },
          { text: 'Pipe number 3.', effects: [{ kind: 'pipe', pipe: 2 }] },
          { text: 'Not now. (Walk away)', effects: [{ kind: 'end' }] },
        ],
      },
      offer: {
        line: "Pipe {picked}! Bold! Now let's take a peek inside Pipe {revealed}... it's {revealedWhat}! So, contestant: do you STICK with Pipe {picked}, or SWITCH to Pipe {other}?",
        choices: [
          { text: 'Stick with Pipe {picked}.', effects: [{ kind: 'pipeFinal', switch: false }] },
          { text: 'Switch to Pipe {other}.', effects: [{ kind: 'pipeFinal', switch: true }] },
        ],
      },
      won_prize: {
        line: 'DING DING DING! A FABULOUS PRIZE! Look at it, folks. Look at it glisten. Some of that is the prize and some of that is pipe.',
        effects: [{ kind: 'prize', rarities: ['special'] }, { kind: 'done' }],
        choices: [{ text: 'Take a bow.', effects: [{ kind: 'end' }] }],
      },
      won_tokens: {
        line: "Prize Tokens! {gained} of them! Not the big prize, but you can't spend a big prize. Well, you can't spend these either, much. Congratulations!",
        effects: [{ kind: 'tokens', amount: [15, 25] }, { kind: 'done' }],
        choices: [{ text: 'Pocket them.', effects: [{ kind: 'end' }] }],
      },
      won_monster: {
        line: "Oh no. Oh, that's terrible. That's the pipe with the THINGS in it. Wonderful television, though! Fight!",
        effects: [{ kind: 'fight', enemies: ['sludge_hopper', 'sludge_hopper', 'pipe_leech'] }, { kind: 'done' }],
        choices: [{ text: 'Fight!', effects: [{ kind: 'end' }] }],
      },
      done: {
        line: "That's all for PICK-A-PIPE, folks! The pipes are closed. Please stop looking into the pipes.",
        choices: [LEAVE],
      },
    },
  },

  drain_gauntlet: {
    id: 'drain_gauntlet',
    name: 'The Drain Gauntlet',
    help: 'A room of spikes around a prize chest. Spikes rise and drop on a timer: cross when they are down.',
    station: null,
    minSize: { w: 5, h: 5 },
    intros: [
      "It's THE DRAIN GAUNTLET! A fabulous prize in the middle, and between you and it: physics! Mind the spikes!",
      'Welcome to THE DRAIN GAUNTLET, where the floor has opinions! Prize in the middle, folks. Feet optional.',
      "THE DRAIN GAUNTLET! Our last contestant made it all the way to the chest. Most of him did, anyway!",
    ],
    start: 'start',
    done: 'start',
    nodes: { start: { line: '', choices: [LEAVE] } },
  },

  overflow_fella: {
    id: 'overflow_fella',
    name: 'The Fella in the Overflow Pipe',
    help: 'A stranger with deals: some of your health for a prize, a coin flip, or a secret. One deal, then he is gone.',
    station: 'overflow_pipe',
    minSize: { w: 4, h: 4 },
    intros: [
      "Oh! Somebody's living in our overflow pipe. Folks, he is NOT on the payroll. Let's see where this goes!",
      'A fella in a pipe, offering deals! The legal department would like me to say nothing at all, so: nothing at all!',
      "Look who's in the overflow pipe! Contestant, never take candy from a pipe. Unless it's really good candy!",
    ],
    start: 'start',
    done: 'done',
    nodes: {
      start: {
        line: "Psst. Contestant. Over here. In the pipe. No, the other pipe. I got deals. Deals the show don't know about.",
        choices: [
          { text: 'What kind of deals?', next: 'deals' },
          { text: "No thanks, I don't talk to pipes. (Walk away)", effects: [{ kind: 'end' }] },
        ],
      },
      deals: {
        line: "Deal one: you give me a little bit of you, I give you something shiny. Deal two: double or nothing on {bet} tokens, I flip, you trust me. Deal three: a secret. Secrets are free. That's how you know they're good.",
        choices: [
          { text: 'A bit of me? (Lose 5 Max HP for good; get a Rare item)', next: 'shiny', effects: [{ kind: 'boon', stat: 'maxHp', amount: -5 }] },
          { text: 'Double or nothing. (Bet {bet} tokens)', requires: { kind: 'canPay', amount: 'bet' }, effects: [{ kind: 'pay', amount: 'bet' }, { kind: 'roll', outcomes: [{ node: 'flipWin', weight: 45, perCharm: 3 }, { node: 'flipLose', weight: 55 }] }] },
          { text: 'Tell me a secret.', requires: { kind: 'noFlag', flag: 'secret' }, next: 'secret', effects: [{ kind: 'flag', flag: 'secret' }, { kind: 'reveal' }] },
          { text: 'Never mind. (Walk away)', effects: [{ kind: 'end' }] },
        ],
      },
      shiny: {
        line: "Lovely. Lovely! Don't look at what I'm doing. Okay, it's done. You won't miss it. Here's your shiny. Pleasure, pleasure.",
        effects: [{ kind: 'prize', rarities: ['special'] }, { kind: 'done' }],
        choices: [{ text: 'I feel lighter. (Leave)', effects: [{ kind: 'end' }] }],
      },
      flipWin: {
        line: "Heads! Is it heads? It's heads. Ugh. Here, {gained} tokens. You cheated. I don't know how, but I respect it.",
        effects: [{ kind: 'tokens', amount: 'betWin' }, { kind: 'done' }],
        choices: [{ text: 'Pleasure doing business. (Leave)', effects: [{ kind: 'end' }] }],
      },
      flipLose: {
        line: "Tails! Tough break. The coin's got two tails, but that's just a coin thing. Nothing personal. Bye now.",
        effects: [{ kind: 'done' }],
        choices: [{ text: '...Right. (Leave)', effects: [{ kind: 'end' }] }],
      },
      secret: {
        line: "The big greasy fella at the bottom of this sewer? I know where he sleeps. There. I drew it on your map. Your actual map. Don't ask how I got in there.",
        choices: [{ text: 'About those other deals...', next: 'deals' }, LEAVE],
      },
      done: {
        line: 'The pipe is empty. Taped inside is a note: "NO REFUNDS. NO RETURNS. NO, YOU CAN\'T COME IN."',
        choices: [LEAVE],
      },
    },
  },

  gutter_mart: {
    id: 'gutter_mart',
    name: 'Gutter Mart',
    help: 'A shop: buy items for Prize Tokens. You can haggle once (Charm helps; it can go badly).',
    station: 'kiosk',
    minSize: { w: 4, h: 4 },
    intros: [
      "It's GUTTER MART, our official on-set convenience store! Prices so low, they're underground! Because they are!",
      'Shopping break! GUTTER MART has everything a contestant needs, and several things nobody needs!',
      "Ooh, GUTTER MART! Remember, folks: Prize Tokens can't buy happiness, but they can buy a damp bandage!",
    ],
    start: 'start',
    done: 'start',
    nodes: {
      start: {
        line: "Welcome to Gutter Mart, where the prices are low and the ceiling is lower. I'm Duane, night manager. It's always night. You've got {tokens} tokens.",
        choices: [
          { text: '{item0}: {price0} tokens. {help0}', requires: { kind: 'inStock', slot: 0 }, effects: [{ kind: 'buy', slot: 0 }] },
          { text: '{item1}: {price1} tokens. {help1}', requires: { kind: 'inStock', slot: 1 }, effects: [{ kind: 'buy', slot: 1 }] },
          { text: '{item2}: {price2} tokens. {help2}', requires: { kind: 'inStock', slot: 2 }, effects: [{ kind: 'buy', slot: 2 }] },
          { text: 'Haggle. (Charm helps; it can go badly)', requires: { kind: 'notHaggled' }, effects: [{ kind: 'haggle', win: 'haggleWin', lose: 'haggleLose' }] },
          { text: 'Just looking. (Walk away)', effects: [{ kind: 'end' }] },
        ],
      },
      bought: {
        line: 'Pleasure doing business. No receipts. We had a receipt incident. You have {tokens} tokens left.',
        choices: [{ text: 'Something else.', next: 'start' }, { text: "That's all. (Walk away)", effects: [{ kind: 'end' }] }],
      },
      broke: {
        line: "You're {short} tokens short. I'd run a tab, but the last guy with a tab got eaten. Mid-sentence. Still owes me.",
        choices: [{ text: 'Something else.', next: 'start' }, { text: "That's all. (Walk away)", effects: [{ kind: 'end' }] }],
      },
      haggleWin: {
        line: "Okay, okay, you've got a face I can't say no to. Mostly because it's frightening. Everything's a quarter off.",
        choices: [{ text: 'Let me see the shelves.', next: 'start' }],
      },
      haggleLose: {
        line: 'Haggling? In MY Gutter Mart? That\'s a twenty percent attitude fee. On everything. Forever.',
        choices: [{ text: 'Let me see the shelves.', next: 'start' }],
      },
    },
  },

  clog_shrine: {
    id: 'clog_shrine',
    name: 'Shrine of the Clog',
    help: 'A shrine: pray once for a blessing. It might heal you, make you stronger for good, or take something. An offering of tokens improves the odds.',
    station: 'shrine',
    minSize: { w: 4, h: 4 },
    intros: [
      "A shrine! Folks, the show takes no position on religion, but it does take a position on DRAMA! Pray away!",
      "It's the Shrine of the Clog! Worshipped by the sewer faithful, and by our insurance company, who are VERY nervous!",
      "Look at that, a shrine! Pray for a miracle, contestant! We've got the cameras on standby either way!",
    ],
    start: 'start',
    done: 'done',
    nodes: {
      start: {
        line: 'A shrine built from a toilet, three candles and a lot of faith. A sign reads: THE CLOG PROVIDES. THE CLOG ALSO TAKES. PRAY ONCE.',
        choices: [
          { text: 'Pray. (Free; something might be taken)', effects: [{ kind: 'roll', outcomes: [{ node: 'healed', weight: 45 }, { node: 'blessed', weight: 30, perCharm: 2 }, { node: 'tithe', weight: 25 }] }] },
          { text: 'Leave an offering of 10 tokens, then pray. (Nothing is taken)', requires: { kind: 'canPay', amount: 10 }, effects: [{ kind: 'pay', amount: 10 }, { kind: 'roll', outcomes: [{ node: 'blessed', weight: 60 }, { node: 'healed', weight: 40 }] }] },
          { text: 'Back away slowly.', effects: [{ kind: 'end' }] },
        ],
      },
      healed: {
        line: 'The candles flare. Something warm and smelly washes over you. Every wound closes. Some of them closed with hair in.',
        effects: [{ kind: 'heal', amount: 'full' }, { kind: 'done' }],
        choices: [{ text: 'Praise the Clog. (Leave)', effects: [{ kind: 'end' }] }],
      },
      blessed: {
        line: 'The toilet flushes on its own. You feel it in your bones: +{amount} {stat}, for good. The Clog provides.',
        effects: [{ kind: 'boon', stat: 'random', amount: 1 }, { kind: 'done' }],
        choices: [{ text: 'Praise the Clog. (Leave)', effects: [{ kind: 'end' }] }],
      },
      tithe: {
        line: 'The candles go out. Something reaches up out of the bowl and takes a tithe. You have lost {amount} {stat}, for good. The Clog also takes.',
        effects: [{ kind: 'boon', stat: 'random', amount: -1 }, { kind: 'done' }],
        choices: [{ text: 'Rude. (Leave)', effects: [{ kind: 'end' }] }],
      },
      done: {
        line: "The candles have gone cold. The sign now reads: THE CLOG IS ON BREAK.",
        choices: [LEAVE],
      },
    },
  },

  valve_room: {
    id: 'valve_room',
    name: 'The Valve Room',
    help: 'A puzzle: four valves, one opens a stash. The hint is on the plaque. A wrong valve hurts. Two goes.',
    station: 'valves',
    minSize: { w: 4, h: 4 },
    intros: [
      "THE VALVE ROOM! A brain-teaser, folks! I'd help, but I'm a hologram, and also I would not!",
      "It's puzzle time in THE VALVE ROOM! One valve opens a stash. The others open your pores. With steam!",
      'Ooh, THE VALVE ROOM! Contestants, read the plaque. Read it twice. Read it like your face depends on it!',
    ],
    start: 'start',
    done: 'done',
    nodes: {
      start: {
        line: "Four valves on a pipe: red, green, blue and gold. A plaque reads: ONE VALVE OPENS THE STASH. THE REST OPEN YOU. Under it, in marker: \"{hint}\" Goes left: {tries}.",
        choices: [
          { text: 'Turn the red valve.', effects: [{ kind: 'valve', valve: 0 }] },
          { text: 'Turn the green valve.', effects: [{ kind: 'valve', valve: 1 }] },
          { text: 'Turn the blue valve.', effects: [{ kind: 'valve', valve: 2 }] },
          { text: 'Turn the gold valve.', effects: [{ kind: 'valve', valve: 3 }] },
          { text: 'Think about it. (Walk away)', effects: [{ kind: 'end' }] },
        ],
      },
      right: {
        line: 'CLUNK. A panel in the wall swings open: a stash! Somebody hid this from the show. Somebody is going to be very upset.',
        effects: [{ kind: 'prize', rarities: ['special'] }, { kind: 'tokens', amount: [10, 20] }, { kind: 'done' }],
        choices: [{ text: 'Take it all. (Leave)', effects: [{ kind: 'end' }] }],
      },
      wrong: {
        line: 'PSSSHHHT. Scalding steam, right in the everything. 4 damage. Goes left: {tries}.',
        effects: [{ kind: 'hurt', amount: 4 }],
        choices: [{ text: 'Read the plaque again.', next: 'start' }, { text: 'Walk away, steaming.', effects: [{ kind: 'end' }] }],
      },
      flooded: {
        line: 'PSSSHHHT. More steam. Then a clank, and every valve locks for good. The stash stays hidden. 4 damage.',
        effects: [{ kind: 'hurt', amount: 4 }, { kind: 'done' }],
        choices: [{ text: 'Walk away, steaming.', effects: [{ kind: 'end' }] }],
      },
      done: {
        line: 'The valves are locked tight. Someone has added to the plaque in marker: "TOLD YOU."',
        choices: [LEAVE],
      },
    },
  },
};
