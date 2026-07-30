import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'quality-eslint',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    testTimeout: 60_000,
    fileParallelism: false,
    environment: 'node',
    include: ['tests/quality/eslint-global-ignores.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
});
