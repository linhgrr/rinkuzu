import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from './asyncPool';

describe('mapWithConcurrency', () => {
  it('maps items in order with the given concurrency', async () => {
    const result = await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 2);

    expect(result).toEqual([2, 4, 6]);
  });

  it('handles an empty array', async () => {
    const result = await mapWithConcurrency([], 5, async () => 'x');

    expect(result).toEqual([]);
  });

  it('handles a single item', async () => {
    const result = await mapWithConcurrency([42], 1, async (n) => n.toString());

    expect(result).toEqual(['42']);
  });

  it('preserves output order with asynchronous work', async () => {
    const delays = [30, 10, 20];
    const result = await mapWithConcurrency(delays, 2, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });

    expect(result).toEqual([30, 10, 20]);
  });

  it('throws when concurrency is 0', async () => {
    await expect(
      mapWithConcurrency([1], 0, async (n) => n),
    ).rejects.toThrow('concurrency must be greater than 0');
  });

  it('throws when concurrency is negative', async () => {
    await expect(
      mapWithConcurrency([1], -1, async (n) => n),
    ).rejects.toThrow('concurrency must be greater than 0');
  });

  it('works when concurrency exceeds item count', async () => {
    const result = await mapWithConcurrency(['a', 'b'], 10, async (s) => s.toUpperCase());

    expect(result).toEqual(['A', 'B']);
  });

  it('propagates mapper errors', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async () => {
        throw new Error('mapper failed');
      }),
    ).rejects.toThrow('mapper failed');
  });
});
