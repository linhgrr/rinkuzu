import { describe, expect, it } from 'vitest';
import {
  changedMetrics,
  evaluateBaseline,
  evaluateThresholds,
  fileMetrics,
  isTypeOnlySource,
  parseLcov,
} from '../../scripts/check-coverage-gates.mjs';

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
});
