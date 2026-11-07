/**
 * Deterministic random numbers in [0, 1) from a 32-bit seed (mulberry32). The server and the
 * hydrating client shuffle with the same seed, so the first question can be server-rendered
 * without a hydration mismatch (RIN-1032).
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
