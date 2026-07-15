import { describe, expect, it } from 'vitest';
import {
  collectCoverageDirectives,
  collectTestViolations,
  validateCoverageWaivers,
} from '../../scripts/check-test-integrity.mjs';

describe('test integrity guard', () => {
  it('accepts executable tests and parameterized tests', () => {
    const source = `
      test('runs', () => { expect(true).toBe(true); });
      test.each([1, 2])('runs %s', (value) => { expect(value).toBeGreaterThan(0); });
    `;

    expect(collectTestViolations(source)).toEqual([]);
  });

  it('rejects disabled, empty, conditional, and retried tests', () => {
    const source = `
      test.skip('disabled', () => { expect(true).toBe(true); });
      it('empty', () => {});
      if (enabled) test('conditional', () => { expect(true).toBe(true); });
      test('retried', { retry: 2 }, () => { expect(true).toBe(true); });
    `;

    const messages = collectTestViolations(source).map((violation) => violation.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('test.skip'),
        expect.stringContaining('Empty'),
        expect.stringContaining('Conditional'),
        expect.stringContaining('retries'),
      ]),
    );
  });

  it('only accepts exact, unexpired defensive coverage waivers', () => {
    const directives = collectCoverageDirectives(
      'const fallback = /* v8 ignore next */ buildFallback();',
      'src/fallback.ts',
    );
    const waiver = {
      id: 'CVR-001',
      file: 'src/fallback.ts',
      line: 1,
      directive: directives[0]?.directive,
      sourceHash: directives[0]?.sourceHash,
      kind: 'defensive',
      reason: 'Defensive fallback cannot be reached through supported inputs.',
      owner: 'frontend-platform',
      expiresAt: '2099-01-01T00:00:00.000Z',
    };

    expect(validateCoverageWaivers(directives, { schemaVersion: 1, waivers: [waiver] })).toEqual(
      [],
    );
    expect(
      validateCoverageWaivers(directives, {
        schemaVersion: 1,
        waivers: [{ ...waiver, sourceHash: 'stale' }],
      }),
    ).toContain('src/fallback.ts:1: waiver fingerprint is stale.');
  });
});
