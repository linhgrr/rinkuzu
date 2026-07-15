import { describe, expect, it } from 'vitest';
import {
  collectPlaywrightTitles,
  validateRequiredFlows,
} from '../../scripts/check-required-e2e-flows.mjs';

describe('required E2E flow guard', () => {
  const policy = {
    schemaVersion: 1,
    flows: [
      {
        id: 'auth',
        tag: '@critical-auth',
        description: 'Authentication lifecycle',
      },
    ],
  };

  it('counts tags only in executable Playwright titles', () => {
    const titles = collectPlaywrightTitles(`
      // test('@critical-auth fake', () => {});
      const note = '@critical-auth also fake';
      test('@critical-auth real flow', async ({ page }) => { await page.goto('/en'); });
    `);
    expect(titles).toEqual(['@critical-auth real flow']);
    expect(validateRequiredFlows(policy, titles)).toEqual([]);
  });

  it('fails closed when a required flow is missing', () => {
    expect(validateRequiredFlows(policy, ['public smoke'])).toEqual([
      'auth: no executable Playwright test is tagged @critical-auth.',
    ]);
  });
});
