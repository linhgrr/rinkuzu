import { describe, expect, it } from 'vitest';
import { seededRandom } from './seeded-random';

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed and differs for another seed', () => {
    const take = (seed: number) => {
      const random = seededRandom(seed);
      return Array.from({ length: 5 }, () => random());
    };

    expect(take(42)).toEqual(take(42));
    expect(take(42)).not.toEqual(take(43));
    for (const value of take(42)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
