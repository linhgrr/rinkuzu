import { CRITICAL_MUTATION_PATTERNS } from './scripts/mutation-scope.mjs';

export function mutationThresholdsForMode(mode) {
  return {
    high: 85,
    low: 80,
    break: mode === 'full' ? null : 80,
  };
}

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  mutate: [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'],
  ignorePatterns: [
    '.agents/**',
    '.claude/**',
    '.code-review-graph/**',
    '.gitnexus/**',
    '.next/**',
    '.npm/**',
    'coverage/**',
    'perf/**',
    'playwright-report/**',
    'public/**',
    'reports/**',
    'test-results/**',
  ],
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
    // Vitest related-test selection can omit unreferenced mutation candidates
    // from the JSON inventory. Run the full unit corpus so missing files fail
    // as NoCoverage instead of disappearing from evidence. Sharded campaigns
    // (run-mutation-gate --shards) opt in with MUTATION_VITEST_RELATED=1 so a
    // shard does not pay the whole-corpus dry run; the runner sets it itself,
    // and the per-shard inventory check still fails a shard that drops a file.
    related: process.env['MUTATION_VITEST_RELATED'] === '1',
  },
  coverageAnalysis: 'perTest',
  reporters: ['progress', 'clear-text', 'json', 'html'],
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  thresholds: mutationThresholdsForMode(process.env['MUTATION_GATE_MODE']),
  timeoutMS: 10_000,
  timeoutFactor: 1.5,
  // Stryker's own default is five minutes, and the dry run here does not fit
  // in it: `related: false` runs the whole unit corpus, instrumented, under
  // perTest coverage, before a single mutant is scored. It timed out there
  // every time, and a gate that cannot reach evaluation reports no score at
  // all rather than a bad one. Bounded and explicit, not removed.
  dryRunTimeoutMinutes: 20,
  // Reuse the verdicts of mutants whose source and covering tests have not
  // changed since the last run. The campaign is 19,500 mutants over 378 files
  // and every invocation was re-deciding all of them from scratch; the cache
  // is what makes a second run cost only what actually moved. It changes no
  // verdict — a mutant is re-tested the moment anything it depends on differs
  // — so the score means the same thing it did before.
  //
  // Cached under reports/mutation/, which is gitignored: it is a cache, not
  // evidence, and a stale one is discarded rather than trusted.
  incremental: true,
  incrementalFile: 'reports/mutation/stryker-incremental.json',
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;
