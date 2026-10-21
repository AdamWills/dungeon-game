// Floor themes. Generator settings live here so a new theme is a data change.

export type FloorTheme = {
  id: string;
  name: string;
  width: number;
  height: number;
  rooms: { min: number; max: number };
  roomWidth: [number, number];
  roomHeight: [number, number];
  /** Fraction of the map dug out as rooms before rot.js stops adding them. */
  roomDugPercentage: number;
  /** Enemies per room (the start room stays empty) and who turns up. */
  enemiesPerRoom: [number, number];
  /** Chance an enemy's patrol route leads out to a neighbouring room. */
  roamChance: number;
  /**
   * Who turns up. `minDepth` keeps tougher residents away from the start
   * (0 = start room, 1 = stairs), so the first rooms teach rather than kill.
   */
  enemies: { id: string; weight: number; maxPerFloor?: number; minDepth?: number }[];
  /** Rooms closer to the start than this hold at most one resident. */
  quietDepth: number;
  /** Chests per floor, and the chance a slain enemy drops an item. */
  chests: [number, number];
  /** Arena props (barrels, vending machines, ...) per floor. */
  props: [number, number];
  dropChance: number;
  /** Allies waiting on this floor: captives (cells, bribes) and deserters among the enemies. */
  captives: string[];
  deserters: string[];
  /** Elites per floor (residents with a trait), from this far along. */
  elites: { count: [number, number]; minDepth: number };
  /** Room bosses (each holds a room of its own) and the floor boss in the stairs lair. */
  roomBosses: { ids: string[]; count: [number, number]; minDepth: number };
  floorBoss: string;
  /** Props always placed in the floor boss's lair (it should be beatable with what is there). */
  lairProps: string[];
  /** Sludge pools (clusters), spike tiles and gas vents per floor. */
  hazards: { sludgePools: [number, number]; spikes: [number, number]; gasVents: [number, number] };
  /** Set pieces (data/setPieces), each in a room of its own, from this far along. */
  setPieces: { kind: string; minDepth: number }[];
};

export const FLOOR_THEMES: Record<string, FloorTheme> = {
  intake_sewers: {
    id: 'intake_sewers',
    name: 'The Intake Sewers',
    // A big floor (user decision): about nine times the first version.
    width: 192,
    height: 120,
    rooms: { min: 60, max: 100 },
    roomWidth: [5, 12],
    roomHeight: [4, 8],
    roomDugPercentage: 0.18,
    enemiesPerRoom: [0, 2],
    roamChance: 0.35,
    enemies: [
      { id: 'intake_rat', weight: 5 },
      { id: 'feral_intern', weight: 3, minDepth: 0.2 },
      { id: 'sludge_hopper', weight: 3 },
      { id: 'pipe_leech', weight: 2, minDepth: 0.4 },
      { id: 'grudge_gator', weight: 1, maxPerFloor: 10, minDepth: 0.6 },
    ],
    quietDepth: 0.35,
    chests: [20, 30],
    props: [30, 45],
    dropChance: 0.3,
    captives: ['marjorie', 'moss'],
    deserters: ['skitch'],
    elites: { count: [4, 6], minDepth: 0.2 },
    roomBosses: { ids: ['sump_crab', 'old_flushy', 'hairball_hydra'], count: [2, 3], minDepth: 0.45 },
    floorBoss: 'fatberg',
    lairProps: ['barrel', 'barrel'],
    hazards: { sludgePools: [12, 20], spikes: [18, 28], gasVents: [8, 14] },
    // One of each on the big floor; the shop and the shrine come early, the gambles and creatures later.
    setPieces: [
      { kind: 'gutter_mart', minDepth: 0.15 },
      { kind: 'clog_shrine', minDepth: 0.2 },
      { kind: 'pick_a_pipe', minDepth: 0.3 },
      { kind: 'overflow_fella', minDepth: 0.35 },
      { kind: 'valve_room', minDepth: 0.4 },
      { kind: 'drain_gauntlet', minDepth: 0.5 },
      // Creature encounters: talk your way through.
      { kind: 'bartholomew_squeak', minDepth: 0.25 },
      { kind: 'mother_mildew', minDepth: 0.35 },
      { kind: 'sir_reginald', minDepth: 0.45 },
    ],
  },
};
