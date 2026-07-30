import path from 'node:path';
import { defineConfig } from 'vitest/config';

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
    ],
  },
});
