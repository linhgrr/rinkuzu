import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    name: 'component',
    setupFiles: ['tests/setup/vitest.setup.ts'],
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    testTimeout: 20_000,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.tsx', 'tests/**/*.{test,spec}.tsx'],
    exclude: [
      'node_modules/**',
      '.next/**',
      'tests/e2e/**',
      'tests/integration/**',
      'tests/quality/**',
    ],
  },
});
