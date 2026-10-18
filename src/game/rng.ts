// Seeded RNG (sfc32). State is a plain array so it can live in GameState and
// round-trip through JSON. Game logic must use this, never Math.random.

export type Rng = { s: [number, number, number, number] };

export function createRng(seed: number): Rng {
  // splitmix32 to spread a single seed across four words
  let x = seed >>> 0;
  const next = () => {
    x = (x + 0x9e3779b9) >>> 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const rng: Rng = { s: [next(), next(), next(), next()] };
  for (let i = 0; i < 12; i++) nextU32(rng);
  return rng;
}

export function nextU32(rng: Rng): number {
  const s = rng.s;
  const t = (((s[0] + s[1]) >>> 0) + s[3]) >>> 0;
  s[3] = (s[3] + 1) >>> 0;
  s[0] = s[1] ^ (s[1] >>> 9);
  s[1] = (s[2] + (s[2] << 3)) >>> 0;
  s[2] = ((s[2] << 21) | (s[2] >>> 11)) >>> 0;
  s[2] = (s[2] + t) >>> 0;
  return t;
}

/** Float in [0, 1). */
export function nextFloat(rng: Rng): number {
  return nextU32(rng) / 4294967296;
}

/** Integer in [min, max], inclusive. */
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(nextFloat(rng) * items.length)];
}

/** A fresh seed for a sub-system (floor generation, loot, ...). */
export function deriveSeed(rng: Rng): number {
  return nextU32(rng);
}
