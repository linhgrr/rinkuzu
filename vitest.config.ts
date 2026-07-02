import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    setupFiles: ['tests/setup/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'src/app/**',
        'src/generated/**',
        'src/interfaces/**',
        'src/models/**',
        'src/repositories/**',
        'src/types/**',
        'src/**/types/**',
        'src/entities/**',
        'src/lib/*-factory.ts',
        'src/lib/mongoose.ts',
        'src/lib/mongoose-count-buckets.ts',
        'src/lib/routing/**',
        'src/lib/validation/**',
        'src/features/adaptive/lib/adaptive-api-fetch.ts',
        'src/features/adaptive/lib/adaptive-api-methods.ts',
        'src/services/admin/**',
        'src/services/payment/PayOSService.ts',
        'src/services/quiz/**',
        'src/shared/constants/**',
        'tests/helpers/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**'],
  },
});
