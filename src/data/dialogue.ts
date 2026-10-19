// Conversations with allies: meeting them (before they join) and chatting with
// them later from the pause screen. Words first; every line is a draft.
// {price}, {tokens} and {name} are filled in.

export type TalkEffect =
  | { kind: 'recruit' } // they join the party
  | { kind: 'pay' } // hand over the bribe at the current price
  | { kind: 'haggle'; win: string; lose: string } // Charm roll: cheaper on a win, dearer on a loss
  | { kind: 'loyalty'; amount: number }
  | { kind: 'learn'; fact: string } // shown on their card from now on
  | { kind: 'dismiss' } // they leave for good (a spared enemy you sent away)
  | { kind: 'end' }; // walk away; you can talk again later

export type TalkChoice = {
  text: string;
  /** Node to go to next; leave out with an `end`, `recruit` or `dismiss` effect. */
  next?: string;
  effects?: TalkEffect[];
  /** Only offered when this holds. */
  requires?: 'canPay' | 'notHaggled';
};

export type TalkNode = { line: string; choices: TalkChoice[] };
export type Conversation = { start: string; nodes: Record<string, TalkNode> };

/** How haggling goes: chance from Charm, and how much the price moves. */
export const HAGGLE = { base: 0.35, perCharm: 0.1, max: 0.9, discount: 4, surcharge: 3 };

const BACK = { text: 'Something else.', next: 'more' };

export const MEETINGS: Record<string, Conversation> = {
  marjorie: {
    start: 'start',
    nodes: {
      start: {
        line: "Oi. You. You're not crew, are you? Crew don't make eye contact.",
        choices: [
          { text: 'Who are you?', next: 'who' },
          { text: 'Why are you locked up?', next: 'why' },
          { text: 'Want out?', next: 'out' },
          { text: 'Never mind. (Leave)', effects: [{ kind: 'end' }] },
        ],
      },
      more: {
        line: 'Anything else, or are we done chatting? I am not a chatter.',
        choices: [
          { text: 'Who are you?', next: 'who' },
          { text: 'Why are you locked up?', next: 'why' },
          { text: 'Want out?', next: 'out' },
          { text: 'Never mind. (Leave)', effects: [{ kind: 'end' }] },
        ],
      },
      who: {
        line: 'Marjorie Pyle. Forklift operator, eleven years, no accidents. Well. One accident. He was fine. Mostly fine.',
        choices: [BACK],
      },
      why: {
        line: 'Season 3. A boom mic kept dipping into my shot. I asked nicely twice. The third time I asked with the mic.',
        choices: [BACK],
      },
      out: {
        line: "Get me out and I'll carry you through this sewer. I don't do speeches. I do lifting.",
        choices: [
          { text: 'Deal. (Open the cell)', effects: [{ kind: 'recruit' }] },
          {
            text: 'Promise her a share of the prize money. (Open the cell)',
            effects: [{ kind: 'learn', fact: 'You promised her a share of the prize.' }, { kind: 'loyalty', amount: 15 }, { kind: 'recruit' }],
          },
          BACK,
        ],
      },
    },
  },
  moss: {
    start: 'start',
    nodes: {
      start: {
        line: 'Ah, a patient! Or a customer. In this economy the difference is mostly paperwork.',
        choices: [
          { text: 'Are you a real doctor?', next: 'real' },
          { text: 'What do you charge?', next: 'price' },
          { text: 'Never mind. (Leave)', effects: [{ kind: 'end' }] },
        ],
      },
      more: {
        line: 'Was there something else? I bill by the minute. I am joking. I bill by the second.',
        choices: [
          { text: 'Are you a real doctor?', next: 'real' },
          { text: 'What do you charge?', next: 'price' },
          { text: 'Never mind. (Leave)', effects: [{ kind: 'end' }] },
        ],
      },
      real: {
        line: 'I attended medical school for four years. Not in a row, and not as a student. I cleaned it.',
        choices: [{ text: 'Something else.', next: 'more', effects: [{ kind: 'learn', fact: 'Not a real doctor. Cleaned a medical school for four years.' }] }],
      },
      price: {
        line: "{price} Prize Tokens and I'll make house calls for the rest of your short life. Payment up front. You have {tokens}.",
        choices: [
          { text: 'Pay {price} tokens.', requires: 'canPay', effects: [{ kind: 'pay' }, { kind: 'recruit' }] },
          { text: 'Haggle. (Charm helps; it can go badly)', requires: 'notHaggled', effects: [{ kind: 'haggle', win: 'haggleWin', lose: 'haggleLose' }] },
          { text: "I'll come back. (Leave)", effects: [{ kind: 'end' }] },
        ],
      },
      haggleWin: {
        line: "Fine, fine. {price}. Don't tell the other patients. There are no other patients.",
        choices: [
          { text: 'Pay {price} tokens.', requires: 'canPay', effects: [{ kind: 'pay' }, { kind: 'recruit' }] },
          { text: "I'll come back. (Leave)", effects: [{ kind: 'end' }] },
        ],
      },
      haggleLose: {
        line: 'Haggling with a medical professional? That is a surcharge. {price}. And I am writing this down.',
        choices: [
          { text: 'Pay {price} tokens.', requires: 'canPay', effects: [{ kind: 'pay' }, { kind: 'loyalty', amount: -10 }, { kind: 'recruit' }] },
          { text: "I'll come back. (Leave)", effects: [{ kind: 'end' }] },
        ],
      },
    },
  },
  skitch: {
    start: 'start',
    nodes: {
      start: {
        line: "D-don't hit me again! I'm good! I'm on your side now! Which side is that? THAT side! Yours!",
        choices: [
          { text: 'Why should I trust you?', next: 'trust' },
          { text: "What's with the nail gun?", next: 'gun' },
          { text: 'Welcome aboard.', effects: [{ kind: 'loyalty', amount: 10 }, { kind: 'recruit' }] },
          { text: 'Get lost, rat.', effects: [{ kind: 'dismiss' }] },
        ],
      },
      more: {
        line: 'Is that a yes? It sounded like a yes. Please be a yes.',
        choices: [
          { text: 'Why should I trust you?', next: 'trust' },
          { text: "What's with the nail gun?", next: 'gun' },
          { text: 'Welcome aboard.', effects: [{ kind: 'loyalty', amount: 10 }, { kind: 'recruit' }] },
          { text: 'Get lost, rat.', effects: [{ kind: 'dismiss' }] },
        ],
      },
      trust: {
        line: "You shouldn't! Nobody should! But I've been looking for the exit since the pilot, and I know every way to run away.",
        choices: [{ text: 'Something else.', next: 'more', effects: [{ kind: 'learn', fact: 'Has been looking for the exit since the pilot episode.' }] }],
      },
      gun: {
        line: 'Found it. Or it found me. It mostly goes off when I get scared. So: always.',
        choices: [{ text: 'Something else.', next: 'more', effects: [{ kind: 'learn', fact: 'The nail gun goes off when he is scared. He is always scared.' }] }],
      },
    },
  },
};

/** Chatting with an ally in your party, from the pause screen (T). */
export const CHATS: Record<string, { high: string; mid: string; low: string; advice: string }> = {
  marjorie: {
    high: "Not bad, for a contestant. You lift with your legs. Metaphorically. You'd be terrible at actual lifting.",
    mid: "I'm here. I'm lifting. That's the arrangement.",
    low: "I've filed a grievance. In my head. It's a long one. You're on every page.",
    advice: "Big ones first. The little ones get bored and wander off.",
  },
  moss: {
    high: "Your vitals are excellent! I don't actually know how to read vitals, but you look excellent!",
    mid: 'Remember to hydrate. Not from the sludge. I cannot stress that enough. Not from the sludge.',
    low: "I've been reviewing our arrangement and frankly my bedside manner is wasted on you.",
    advice: 'Bandages work best if you use them before you are dead. That is medicine.',
  },
  skitch: {
    high: "You're the best boss I've ever had! You're the only boss I've ever had, but still!",
    mid: "Is it safe? Is it ever safe? Asking for me.",
    low: "I'm not saying I'd run. I'm saying I've already worked out which way.",
    advice: "Don't let things catch you from behind. Turn and look at them. They hate being looked at.",
  },
};

export const CHAT_CHOICES = {
  kind: "Glad you're with me.",
  advice: 'Any advice?',
  done: 'Back to it.',
  /** Kind words only count once every this many fights. */
  kindEvery: 2,
  kindLoyalty: 4,
};
