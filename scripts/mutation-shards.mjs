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
 * Repo-relative report, incremental-cache and binding-meta paths for shard k
 * of N. The meta (written by `--only-shard`) ties the report to the head SHA
 * and workspace fingerprint it was produced for, because the shard directory
 * is a volume that outlives the run.
 *
 * @param {number} shard 1-based
 * @param {number} shardCount
 */
export function mutationShardPaths(shard, shardCount) {
  const stem = `${MUTATION_SHARDS_DIR_RELATIVE}/${shard}-of-${shardCount}`;
  return {
    reportRelative: `${stem}.mutation.json`,
    incrementalRelative: `${stem}.incremental.json`,
    metaRelative: `${stem}.meta.json`,
  };
}

function prefixIds(ids, prefix) {
  return Array.isArray(ids) ? ids.map((id) => `${prefix}${id}`) : ids;
}

/**
 * Merge shard reports produced by ONE run (same head SHA) into a single
 * mutation-testing-elements report. Mutant and test ids are only unique per
 * Stryker run, so each shard's ids are namespaced `<k>:`. `config.mutate` is
 * the full policy the shards partition, so the existing full-mode evidence
 * binder judges the merged report unchanged (it still checks the exact file
 * inventory, which is what proves the shards covered everything).
 *
 * @param {Array<{ shard: number, report?: any }>} shardReports
 * @param {string[]} fullMutate
 */
export function mergeMutationShardReports(shardReports, fullMutate) {
  if (shardReports.length === 0) throw new Error('No shard reports to merge.');
  const [{ report: first }] = shardReports;
  /** @type {Record<string, any>} */
  const files = {};
  /** @type {Record<string, any>} */
  const testFiles = {};
  for (const { shard, report } of shardReports) {
    const prefix = `${shard}:`;
    for (const [file, details] of Object.entries(report?.files ?? {})) {
      if (files[file]) throw new Error(`File ${file} appears in more than one shard report.`);
      files[file] = {
        ...details,
        mutants: (details?.mutants ?? []).map((mutant) => ({
          ...mutant,
          id: `${prefix}${mutant.id}`,
          coveredBy: prefixIds(mutant.coveredBy, prefix),
          killedBy: prefixIds(mutant.killedBy, prefix),
        })),
      };
    }
    for (const [file, details] of Object.entries(report?.testFiles ?? {})) {
      const tests = (details?.tests ?? []).map((test) => ({ ...test, id: `${prefix}${test.id}` }));
      testFiles[file] = testFiles[file]
        ? { ...testFiles[file], tests: [...testFiles[file].tests, ...tests] }
        : { ...details, tests };
    }
  }
  return {
    ...first,
    files,
    testFiles,
    config: { ...first.config, mutate: [...fullMutate] },
  };
}
