// Status effects (GDD "Combat"): fixed durations that stack by duration, not
// intensity. Damage-over-time lands at the start of the affected one's turn.

export type StatusKind = 'bleed' | 'poison' | 'burning' | 'stunned' | 'charmed' | 'hexed' | 'hasted';

export type StatusDef = {
  kind: StatusKind;
  name: string;
  /** Plain help for menus and badges. */
  help: string;
  /** Damage taken at the start of each of its holder's turns. */
  dot?: number;
  /** Log line when it ticks or bites; {name} and {dmg} are filled in. */
  tickLine?: string;
  /** The same, when it is happening to you. */
  youLine?: string;
};

export const STATUSES: Record<StatusKind, StatusDef> = {
  bleed: { kind: 'bleed', name: 'Bleeding', help: 'Loses 1 HP at the start of each turn.', dot: 1, tickLine: '{name} bleeds for {dmg}. Somebody get a mop!', youLine: 'You bleed for {dmg}. Somebody get a mop!' },
  poison: { kind: 'poison', name: 'Poisoned', help: 'Loses 2 HP at the start of each turn.', dot: 2, tickLine: '{name} takes {dmg} from poison. Green is not a flattering colour.', youLine: 'You take {dmg} from poison. Green is not your colour, contestant.' },
  burning: { kind: 'burning', name: 'Burning', help: 'Loses 3 HP at the start of each turn.', dot: 3, tickLine: '{name} burns for {dmg}! Somebody fetch the extinguisher. Slowly.', youLine: 'You burn for {dmg}! Now THAT is a hot contestant!' },
  stunned: { kind: 'stunned', name: 'Stunned', help: 'Loses its turn.', tickLine: '{name} is stunned and just stands there. Riveting television.', youLine: 'You are stunned and just stand there. Riveting television.' },
  charmed: { kind: 'charmed', name: 'Charmed', help: 'Will not attack.', tickLine: '{name} is too charmed to fight. Aww!' },
  hexed: { kind: 'hexed', name: 'Hexed', help: 'Takes double damage.' },
  hasted: { kind: 'hasted', name: 'Hasted', help: 'Acts twice each round.' },
};
