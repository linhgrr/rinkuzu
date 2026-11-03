import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Stryker sets STRYKER_MUTATOR_WORKER in the processes that run its tests.
// next-config-secrets.test.ts requires next.config.js, which loads the native
// @parcel/watcher addon; under Stryker's vitest workers the addon fails with
// "Module did not self-register" and kills the dry run (RIN-647). That test
// covers no mutable source, so it is skipped there only. It still runs in
// the normal unit suite.
const strykerExclude = process.env['STRYKER_MUTATOR_WORKER']
  ? ['src/config/next-config-secrets.test.ts']
  : [];

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'node',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    testTimeout: 20_000,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: [
      'node_modules/**',
      '.next/**',
      'tests/e2e/**',
      'tests/integration/**',
      'tests/quality/**',
      ...strykerExclude,
    ],
  },
});
