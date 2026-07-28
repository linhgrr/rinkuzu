import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

describe('ESLint global ignores', () => {
  it('excludes generated reports without excluding production source', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });

    await expect(eslint.isPathIgnored('playwright-report/trace/assets/generated.js')).resolves.toBe(
      true,
    );
    await expect(eslint.isPathIgnored('test-results/trace.js')).resolves.toBe(true);
    await expect(eslint.isPathIgnored('reports/mutation/generated.js')).resolves.toBe(true);
    await expect(eslint.isPathIgnored('src/lib/utils.ts')).resolves.toBe(false);
  }, 60_000);
});
