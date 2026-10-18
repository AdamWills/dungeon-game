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
    help: 'Spikes: 3 damage when stepped on, and again every second you stay.',
    damage: 3, everyTicks: 60, onEnter: true,
    deathMove: 'surprise pedicure',
  },
  gas_vent: {
    kind: 'gas_vent', name: 'Gas Vent',
    help: 'Gas vent: puffs on and off; 2 damage every half second while it is puffing.',
    damage: 2, everyTicks: 30, onEnter: false, cycle: { on: 90, off: 150 },
    deathMove: 'deep breath of something green',
  },
};
