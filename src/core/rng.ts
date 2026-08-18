/**
 * A deterministic, seedable pseudo-random number generator (mulberry32).
 *
 * The generator is a *value*, not an object: every draw returns the next state
 * alongside the number. That keeps every caller — including the game reducer — pure,
 * so a game replays identically from its seed and no test is flaky.
 */
export type Rng = { readonly state: number };

export function createRng(seed: number): Rng {
  // Coerce to a uint32 so any integer seed, including a negative one, is usable.
  return { state: seed >>> 0 };
}

/** Draws a float in [0, 1). */
export function nextFloat(rng: Rng): [value: number, next: Rng] {
  let t = (rng.state + 0x6d2b79f5) >>> 0;
  const nextState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, { state: nextState }];
}

/** Draws an integer in [0, maxExclusive). */
export function nextInt(rng: Rng, maxExclusive: number): [value: number, next: Rng] {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new Error(`nextInt needs a positive integer bound, got ${maxExclusive}`);
  }
  const [value, next] = nextFloat(rng);
  return [Math.floor(value * maxExclusive), next];
}

/** Picks one element, and returns the advanced generator. */
export function pick<T>(rng: Rng, items: readonly T[]): [value: T, next: Rng] {
  if (items.length === 0) throw new Error('Cannot pick from an empty list');
  const [index, next] = nextInt(rng, items.length);
  return [items[index] as T, next];
}
