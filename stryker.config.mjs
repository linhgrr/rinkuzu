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
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;
