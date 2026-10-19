// Map hazards (GDD "Hazard pre-damage"): they hurt anything standing on them,
// player and residents alike, and the damage carries into battle.

export type HazardKind = 'sludge' | 'spikes' | 'gas_vent';

export type HazardDef = {
  kind: HazardKind;
  name: string;
  /** Plain help, shown when you stand on one. */
  help: string;
  damage: number;
  /** Damage repeats this often (ticks) while standing on it. */
  everyTicks: number;
  /** Also hurts on the step onto it. */
  onEnter: boolean;
  /** Also hurts the moment it switches on under you (spikes popping up). */
  onRise?: boolean;
  /** Active for `on` ticks out of every `on + off`; always active if absent. */
  cycle?: { on: number; off: number };
  /** For the elimination report: "with a lovely {deathMove}". */
  deathMove: string;
};

export const HAZARDS: Record<HazardKind, HazardDef> = {
  sludge: {
    kind: 'sludge', name: 'Sludge Pool',
    help: 'Sludge: hurts anything standing in it, 1 HP every 3/4 second.',
    damage: 1, everyTicks: 45, onEnter: false,
    deathMove: 'long, relaxing soak',
  },
  spikes: {
    kind: 'spikes', name: 'Floor Spikes',
    help: 'Spikes: pop up and drop back on a timer. 3 damage if they are up when you step on, or pop up under you. Wait for them to drop.',
    damage: 3, everyTicks: 100_000, onEnter: true, onRise: true, cycle: { on: 50, off: 80 },
    deathMove: 'surprise pedicure',
  },
  gas_vent: {
    kind: 'gas_vent', name: 'Gas Vent',
    help: 'Gas vent: puffs on and off; 2 damage every half second while it is puffing.',
    damage: 2, everyTicks: 30, onEnter: false, cycle: { on: 90, off: 150 },
    deathMove: 'deep breath of something green',
  },
};
