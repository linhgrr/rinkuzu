import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'quality',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    testTimeout: 20_000,
    environment: 'node',
    include: ['tests/quality/**/*.{test,spec}.{ts,tsx}'],
    // Cold-ESLint tests run once, serially, in vitest.quality-eslint.config.ts (RIN-1210).
    exclude: [
      'node_modules/**',
      '.next/**',
      'tests/quality/eslint-global-ignores.test.ts',
      'tests/quality/eslint-api-error-layer.test.ts',
    ],
  },
});
