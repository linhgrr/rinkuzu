import { createHash } from 'node:crypto';
import { normalizeMutationPath } from './mutation-scope.mjs';

/** Shard reports and per-shard incremental caches live here (gitignored, under reports/). */
export const MUTATION_SHARDS_DIR_RELATIVE = 'reports/mutation/shards';
export const MAX_MUTATION_SHARDS = 64;

/**
 * Parse a shard count from `--shards N` or `MUTATION_SHARDS`. Integer 1..64.
 *
 * @param {string | number | undefined | null} raw
 * @returns {number}
 */
export function parseMutationShardCount(raw) {
  const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (
    String(raw ?? '').trim() === '' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_MUTATION_SHARDS
  ) {
    throw new Error(
      `Mutation shard count must be an integer between 1 and ${MAX_MUTATION_SHARDS} (got ${raw}).`,
    );
  }
  return value;
}

/**
 * 1-based shard of a repo path. Derived from a hash of the path alone, so a
 * file keeps its shard (and that shard's incremental cache) when other files
 * are added or removed. Only changing N reshuffles.
 *
 * @param {string} filePath
 * @param {number} shardCount
 * @returns {number}
 */
export function mutationShardOf(filePath, shardCount) {
  const count = parseMutationShardCount(shardCount);
  const digest = createHash('sha256').update(normalizeMutationPath(filePath), 'utf8').digest();
  return (digest.readUInt32BE(0) % count) + 1;
}

/**
 * Deterministic, disjoint partition of the inventory into `shardCount`
 * sorted lists (index 0 = shard 1). Together they cover every input file.
 *
 * @param {string[]} files
 * @param {number} shardCount
 * @returns {string[][]}
 */
export function partitionMutationInventory(files, shardCount) {
  const count = parseMutationShardCount(shardCount);
  /** @type {string[][]} */
  const shards = Array.from({ length: count }, () => []);
  for (const file of new Set(files.map(normalizeMutationPath))) {
    shards[mutationShardOf(file, count) - 1].push(file);
  }
  return shards.map((shard) => shard.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * Repo-relative report and incremental-cache paths for shard k of N.
 *
 * @param {number} shard 1-based
 * @param {number} shardCount
 */
export function mutationShardPaths(shard, shardCount) {
  const stem = `${MUTATION_SHARDS_DIR_RELATIVE}/${shard}-of-${shardCount}`;
  return {
    reportRelative: `${stem}.mutation.json`,
    incrementalRelative: `${stem}.incremental.json`,
  };
}
