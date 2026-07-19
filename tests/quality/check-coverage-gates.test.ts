import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  changedMetrics,
  evaluateBaseline,
  evaluateCoverageGate,
  evaluateThresholds,
  fileMetrics,
  isTypeOnlySource,
  parseLcov,
} from '../../scripts/check-coverage-gates.mjs';

const policy = JSON.parse(
  readFileSync(path.join(process.cwd(), 'quality/critical-coverage-paths.json'), 'utf8'),
) as {
  globs: string[];
  changedGlobs: string[];
  thresholds: { lines: number; statements: number; functions: number; branches: number };
  changedThresholds: { lines: number; statements: number; functions: number; branches: number };
  globalBaseline: {
    metrics: {
      lines: { covered: number; total: number };
      statements: { covered: number; total: number };
      functions: { covered: number; total: number };
      branches: { covered: number; total: number };
    };
  };
};

/** Security-wave paths that must never drop out of critical/changed coverage scope. */
const SECURITY_WAVE_PATHS = [
  'src/auth.ts',
  'src/auth.config.ts',
  'src/lib/auth/session-projection.ts',
  'src/shared/constants/account-disable.ts',
  'src/shared/constants/admin-invariant.ts',
  'src/app/api/admin/users/[userId]/status/route.ts',
  'src/app/api/admin/users/route.ts',
  'src/services/admin/AdminService.ts',
  'src/repositories/UserRepository.ts',
  'src/repositories/AuthAccountRepository.ts',
  'src/models/User.ts',
  'src/models/AdminMutationFence.ts',
] as const;

function matchesAnyGlob(file: string, globs: string[]): boolean {
  return globs.some((glob) => path.matchesGlob(file, glob));
}

describe('coverage gate', () => {
  it('distinguishes type-only modules from runtime modules', () => {
    expect(isTypeOnlySource("import type { A } from './a'; export type B = A;")).toBe(true);
    expect(isTypeOnlySource('export const answer = 42;')).toBe(false);
  });

  it('calculates statement, function, and branch coverage', () => {
    expect(
      fileMetrics({
        s: { 0: 1, 1: 0 },
        f: { 0: 1 },
        b: { 0: [1, 0] },
      }),
    ).toEqual({
      statements: { total: 2, covered: 1, pct: 50 },
      functions: { total: 1, covered: 1, pct: 100 },
      branches: { total: 2, covered: 1, pct: 50 },
    });
  });

  it('ratchets both covered count and percentage against the reviewed baseline', () => {
    const baseline = { lines: { covered: 80, total: 100 } };

    expect(evaluateBaseline({ lines: { covered: 80, total: 100, pct: 80 } }, baseline)).toEqual([]);
    expect(
      evaluateBaseline({ lines: { covered: 79, total: 90, pct: 87.78 } }, baseline),
    ).toContainEqual(expect.stringContaining('covered count'));
    expect(
      evaluateBaseline({ lines: { covered: 80, total: 110, pct: 72.73 } }, baseline),
    ).toContainEqual(expect.stringContaining('regressed'));
  });

  it('intersects LCOV and Istanbul maps with changed lines', () => {
    const lcov = parseLcov('SF:src/example.ts\nDA:4,1\nDA:5,0\nend_of_record\n');
    const record = {
      s: { 0: 1, 1: 0 },
      statementMap: {
        0: { start: { line: 4 }, end: { line: 4 } },
        1: { start: { line: 5 }, end: { line: 5 } },
      },
      f: { 0: 1 },
      fnMap: { 0: { loc: { start: { line: 3 }, end: { line: 6 } } } },
      b: { 0: [1, 0] },
      branchMap: { 0: { loc: { start: { line: 5 }, end: { line: 5 } } } },
    };

    const metrics = changedMetrics(record, lcov.get('src/example.ts'), new Set([5]));
    expect(metrics.lines).toMatchObject({ total: 1, covered: 0 });
    expect(metrics.statements).toMatchObject({ total: 1, covered: 0 });
    expect(metrics.functions).toMatchObject({ total: 1, covered: 1 });
    expect(metrics.branches).toMatchObject({ total: 2, covered: 1 });
    expect(evaluateThresholds('changed', metrics, { lines: 90 })).toHaveLength(1);
  });

  it('keeps the security wave inside both critical globs and changedGlobs', () => {
    for (const file of SECURITY_WAVE_PATHS) {
      expect(matchesAnyGlob(file, policy.globs), `${file} missing from globs`).toBe(true);
      expect(matchesAnyGlob(file, policy.changedGlobs), `${file} missing from changedGlobs`).toBe(
        true,
      );
    }
    // Presentation and unrelated UI must not dilute the security changed scope.
    expect(matchesAnyGlob('src/components/ui/Button.tsx', policy.changedGlobs)).toBe(false);
  });

  it('fails closed when a changed security file is uncovered (no false green)', () => {
    const securityFile = 'src/shared/constants/account-disable.ts';
    expect(matchesAnyGlob(securityFile, policy.changedGlobs)).toBe(true);

    const uncoveredRecord = {
      s: { 0: 0, 1: 0 },
      statementMap: {
        0: { start: { line: 1 }, end: { line: 1 } },
        1: { start: { line: 2 }, end: { line: 2 } },
      },
      f: { 0: 0 },
      fnMap: { 0: { name: 'isAuthVersion', loc: { start: { line: 1 }, end: { line: 2 } } } },
      b: { 0: [0, 0] },
      branchMap: { 0: { loc: { start: { line: 1 }, end: { line: 1 } } } },
    };

    const lcov = parseLcov(
      `SF:${securityFile}\nDA:1,0\nDA:2,0\nFN:1,isAuthVersion\nFNDA:0,isAuthVersion\nend_of_record\n`,
    );

    // Synthetic single-file gate: only this security file is runtime, fully uncovered on changed lines.
    const result = evaluateCoverageGate({
      root: process.cwd(),
      coverage: { [path.resolve(process.cwd(), securityFile)]: uncoveredRecord },
      lcov,
      policy: {
        ...policy,
        // Isolate baseline so this unit test only asserts the changed-path failure path.
        globalBaseline: {
          metrics: {
            lines: { covered: 0, total: 2 },
            statements: { covered: 0, total: 2 },
            functions: { covered: 0, total: 1 },
            branches: { covered: 0, total: 2 },
          },
        },
      },
      changedLines: new Map([[securityFile, new Set([1, 2])]]),
      runtimeFiles: [securityFile],
    });

    expect(
      result.failures.some(
        (failure: string | null) =>
          typeof failure === 'string' && failure.includes(`${securityFile} changed`),
      ),
    ).toBe(true);
    // Without changedGlobs membership the same uncovered file would not produce a changed-path failure.
    const outOfScope = evaluateCoverageGate({
      root: process.cwd(),
      coverage: { [path.resolve(process.cwd(), securityFile)]: uncoveredRecord },
      lcov,
      policy: {
        ...policy,
        changedGlobs: ['src/lib/password.ts'],
        globalBaseline: {
          metrics: {
            lines: { covered: 0, total: 2 },
            statements: { covered: 0, total: 2 },
            functions: { covered: 0, total: 1 },
            branches: { covered: 0, total: 2 },
          },
        },
      },
      changedLines: new Map([[securityFile, new Set([1, 2])]]),
      runtimeFiles: [securityFile],
    });
    expect(
      outOfScope.failures.some(
        (failure: string | null) =>
          typeof failure === 'string' && failure.includes(`${securityFile} changed`),
      ),
    ).toBe(false);
  });
});
