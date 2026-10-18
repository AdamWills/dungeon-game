// Movement, sight and combat numbers. Untuned on purpose until M5.

export const TUNING = {
  /** Fixed-step ticks to cross one tile while roaming (60 ticks = 1 second). */
  playerTicksPerTile: 9,
  /** Field-of-view radius in tiles. */
  fovRadius: 8,

  dash: { ticks: 18, ticksPerTile: 4, cooldown: 120 },

  /** Distance (tiles, Chebyshev) at which touching starts a battle. */
  contactRadius: 0.8,
  /** Enemies this close (tiles) to the contact point join, up to the max. */
  joinRadius: 3,
  maxEnemiesPerBattle: 4,
  /** After a successful flee: no new fight for this long, enemies stand dazed. */
  fleeGraceTicks: 90,
  fleeStunTicks: 60,

  ai: {
    alertBubbleTicks: 45,
    suspicionTicks: 120,
    waypointWait: [20, 70] as [number, number],
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
};
