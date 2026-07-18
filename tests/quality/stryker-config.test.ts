import { describe, expect, it } from 'vitest';
import { CRITICAL_MUTATION_PATTERNS } from '../../scripts/mutation-scope.mjs';
import config, { mutationThresholdsForMode } from '../../stryker.config.mjs';

describe('Stryker production configuration', () => {
  it('keeps tool metadata and runtime assets out of mutation sandboxes', () => {
    expect(config.ignorePatterns).toEqual(
      expect.arrayContaining(['.claude/**', '.gitnexus/**', '.npm/**', 'public/**', 'reports/**']),
    );
  });

  it('materializes unreferenced candidates instead of relying on Vitest related selection', () => {
    expect(config['vitest']).toMatchObject({ related: false });
  });

  it('includes runtime auth and security entrypoints previously missed by critical globs', () => {
    expect(CRITICAL_MUTATION_PATTERNS).toEqual(
      expect.arrayContaining([
        'src/auth.ts',
        'src/auth.config.ts',
        'src/lib/security/**/*.ts',
        'src/lib/password.ts',
        'src/lib/auth-tokens.ts',
        'src/lib/auth/**/*.ts',
      ]),
    );
    expect(config.mutate).toEqual(
      expect.arrayContaining([
        'src/auth.ts',
        'src/auth.config.ts',
        'src/lib/security/**/*.ts',
        'src/lib/password.ts',
        'src/lib/auth-tokens.ts',
      ]),
    );
    // Directory-shaped path is not a mutate pattern (files live under src/lib/auth/**).
    expect(config.mutate).not.toContain('src/lib/auth.ts');
  });

  it('keeps presentational TSX out of the critical logic mutation scope', () => {
    expect(config.mutate).toEqual([
      ...CRITICAL_MUTATION_PATTERNS,
      '!src/**/*.{test,spec}.{ts,tsx}',
    ]);
    expect(CRITICAL_MUTATION_PATTERNS).toContain('src/features/{admin,adaptive,quiz}/**/*.ts');
    expect(CRITICAL_MUTATION_PATTERNS).not.toContain(
      'src/features/{admin,adaptive,quiz}/**/*.{ts,tsx}',
    );
  });

  it('blocks changed critical regressions but lets the full report reach the debt ratchet', () => {
    expect(mutationThresholdsForMode('changed').break).toBe(80);
    expect(mutationThresholdsForMode(undefined).break).toBe(80);
    expect(mutationThresholdsForMode('full').break).toBeNull();
  });
});
