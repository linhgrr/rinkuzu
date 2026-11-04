import { describe, expect, it } from 'vitest';
import {
  MAX_MUTATION_SHARDS,
  mutationShardOf,
  mutationShardPaths,
  parseMutationShardCount,
  partitionMutationInventory,
} from '../../scripts/mutation-shards.mjs';

const inventory = Array.from({ length: 300 }, (_, i) => `src/app/api/item-${i}/route.ts`).concat([
  'src/app/api/quiz/[id]/route.ts',
  'src/models/User.ts',
  'src/repositories/mappers/quiz.ts',
]);

describe('partitionMutationInventory', () => {
  it('is disjoint and covers the whole inventory', () => {
    const shards = partitionMutationInventory(inventory, 4);
    expect(shards).toHaveLength(4);
    const flat = shards.flat();
    expect(new Set(flat).size).toBe(flat.length);
    expect([...flat].sort()).toEqual([...inventory].sort());
  });

  it('is deterministic and order independent', () => {
    const reversed = [...inventory].reverse();
    expect(partitionMutationInventory(reversed, 5)).toEqual(
      partitionMutationInventory(inventory, 5),
    );
  });

  it('keeps existing files in their shard when a file is added', () => {
    const before = partitionMutationInventory(inventory, 4);
    const after = partitionMutationInventory([...inventory, 'src/lib/auth/new-guard.ts'], 4);
    for (let k = 0; k < 4; k += 1) {
      expect(after[k].filter((file) => file !== 'src/lib/auth/new-guard.ts')).toEqual(before[k]);
    }
  });

  it('spreads files across every shard instead of chunking by group', () => {
    for (const shard of partitionMutationInventory(inventory, 4)) {
      expect(shard.length).toBeGreaterThan(40);
    }
  });

  it('normalizes and de-duplicates paths', () => {
    const shards = partitionMutationInventory(['./src/auth.ts', 'src\\auth.ts', 'src/auth.ts'], 2);
    expect(shards.flat()).toEqual(['src/auth.ts']);
  });

  it('puts everything in one shard when N is 1', () => {
    expect(partitionMutationInventory(inventory, 1)[0]).toHaveLength(inventory.length);
  });
});

describe('mutationShardOf', () => {
  it('returns a 1-based shard in range', () => {
    for (const file of inventory) {
      const shard = mutationShardOf(file, 7);
      expect(shard).toBeGreaterThanOrEqual(1);
      expect(shard).toBeLessThanOrEqual(7);
    }
  });
});

describe('parseMutationShardCount', () => {
  it.each(['1', '4', String(MAX_MUTATION_SHARDS), 3])('accepts %s', (raw) => {
    expect(parseMutationShardCount(raw)).toBe(Number(raw));
  });

  it.each(['', undefined, '0', '-2', '1.5', 'four', String(MAX_MUTATION_SHARDS + 1)])(
    'rejects %s',
    (raw) => {
      expect(() => parseMutationShardCount(raw)).toThrow(/between 1 and/);
    },
  );
});

describe('mutationShardPaths', () => {
  it('names report and incremental file per shard under reports/mutation/shards', () => {
    expect(mutationShardPaths(2, 4)).toEqual({
      reportRelative: 'reports/mutation/shards/2-of-4.mutation.json',
      incrementalRelative: 'reports/mutation/shards/2-of-4.incremental.json',
    });
  });
});
