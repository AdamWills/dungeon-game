// Movement, sight and combat numbers. Untuned on purpose until M5.

export const TUNING = {
  /** Fixed-step ticks to cross one tile while roaming (60 ticks = 1 second). */
  playerTicksPerTile: 9,
  /**
   * Out of battle you heal 1 HP every this many ticks (allies too), but only
   * after this long without getting hurt (user feedback: spike damage was
   * gone in a couple of seconds).
   */
  regenTicks: 300,
  regenDelayTicks: 600,
  /** Field-of-view radius in tiles. */
  fovRadius: 8,

  dash: { ticks: 18, ticksPerTile: 4, cooldown: 120 },

  /** Distance (tiles, Chebyshev) at which touching starts a battle. */
  contactRadius: 0.8,
  /** Enemies this close (tiles) to the contact point join, up to the max. */
  joinRadius: 2,
  maxEnemiesPerBattle: 3,
  /** After a successful flee: no new fight for this long, enemies stand dazed. */
  fleeGraceTicks: 90,
  fleeStunTicks: 60,

  ai: {
    alertBubbleTicks: 45,
    suspicionTicks: 120,
    /** Ticks a hearing enemy stands puzzled ("?") before turning to the sound. */
    hearReactTicks: 45,
    /** Hearing range multiplier while the player dashes. */
    dashNoise: 2,
    waypointWait: [20, 70] as [number, number],
    /** Residents further than this (tiles) from you hold still; the floor is big. */
    activeRadius: 30,
  },

  combat: {
    hitBase: 0.9,
    hitPerEvasion: 0.06,
    hitMin: 0.2,
    hitMax: 0.95,
    ambushMultiplier: 1.5,
    defendMultiplier: 0.5,
    fleeBase: 0.5,
    fleePerSpeed: 0.1,
    fleePerExtraEnemy: 0.1,
    fleeMin: 0.1,
    fleeMax: 0.9,
  },

  /** XP and levels (GDD "Levelling"). Total XP to reach each level, from level 2. */
  progression: {
    xpToLevel: [30, 80, 160, 280],
    maxLevel: 5,
    pointsPerLevel: 3,
    ambushXpBonus: 0.25,
    recruitXp: 10,
    discoveryXp: 4,
  },

  /** What one point buys at level-up (GDD "Stats"). */
  pointValue: { maxHp: 4, str: 1, speed: 1, evasion: 1, armor: 1, charm: 1 },

  /** Prize Tokens in chests, min and max. */
  chestTokens: [3, 8] as [number, number],

  party: {
    /** Allies a party can hold besides you. */
    maxAllies: 3,
    /** Allies further than this many tiles behind catch up at a run. */
    catchUpDistance: 3,
    catchUpTicksPerTile: 5,
  },

  /** Battle pacing, in fixed steps (60 a second): the beat between turns. */
  battle: { turnTicks: 50, skipTicks: 30, resultTicks: 60 },
};
