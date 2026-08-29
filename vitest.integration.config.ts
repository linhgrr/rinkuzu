import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // The database fence runs before any suite can connect, and throws rather
    // than skipping: an integration suite that quietly runs nothing is worse
    // than one that fails.
    setupFiles: ['tests/setup/vitest.setup.ts', 'tests/setup/integration-db.ts'],
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    // Integration files share Mongoose's process-global connection. Serializing
    // files prevents one suite from disconnecting another suite mid-assertion.
    fileParallelism: false,
    environment: 'node',
    // Bounded so a suite waiting on a lease, a transaction retry or a replica
    // set that never comes up fails the run instead of hanging CI to its job
    // timeout.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    teardownTimeout: 15_000,
    include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
  },
});
