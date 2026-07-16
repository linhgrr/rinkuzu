import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  evaluateMutationReport,
  validateMutationSourceEvidence,
  validateMutationScopeEvidence,
} from '../../scripts/check-mutation-report.mjs';
import { CRITICAL_MUTATION_PATTERNS } from '../../scripts/mutation-scope.mjs';

function reportWith(statuses: string[]) {
  return {
    schemaVersion: '1.0',
    framework: { name: 'StrykerJS', version: '9.6.1' },
    config: {
      mutate: [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'],
    },
    files: {
      'src/lib/auth.ts': {
        mutants: statuses.map((status, index) => ({
          id: String(index),
          mutatorName: 'BooleanLiteral',
          replacement: index % 2 === 0 ? 'true' : 'false',
          location: {
            start: { line: index + 1, column: 0 },
            end: { line: index + 1, column: 4 },
          },
          status,
        })),
      },
    },
  };
}

const registry = { schemaVersion: 1, waivers: [] };
const baselineWith = (statuses: string[]) => {
  const detected = statuses.filter((status) => ['Killed', 'Timeout'].includes(status)).length;
  const survived = statuses.filter((status) => status === 'Survived').length;
  const noCoverage = statuses.filter((status) => status === 'NoCoverage').length;
  const valid = detected + survived + noCoverage;
  return {
    schemaVersion: 1,
    toolVersion: '9.6.1',
    scopePatterns: [...CRITICAL_MUTATION_PATTERNS],
    valid,
    detected,
    survived,
    noCoverage,
    score: valid === 0 ? 0 : (detected / valid) * 100,
  };
};
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createSourceFixture(source: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rinkuzu-mutation-report-'));
  temporaryRoots.push(root);
  const relativePath = 'mutated-source.ts';
  const sourcePath = path.join(root, relativePath);
  writeFileSync(sourcePath, source);
  return { root, relativePath, sourcePath };
}

describe('mutation report gate', () => {
  it('uses report source content instead of timestamps for freshness', () => {
    const source = 'export const enabled = true;\n';
    const fixture = createSourceFixture(source);
    const future = new Date(Date.now() + 60_000);
    utimesSync(fixture.sourcePath, future, future);

    expect(
      validateMutationSourceEvidence({
        root: fixture.root,
        report: { files: { [fixture.relativePath]: { source, mutants: [] } } },
      }),
    ).toEqual([]);
  });

  it('rejects mutation evidence when the current source content changed', () => {
    const fixture = createSourceFixture('export const enabled = false;\n');

    expect(
      validateMutationSourceEvidence({
        root: fixture.root,
        report: {
          files: {
            [fixture.relativePath]: {
              source: 'export const enabled = true;\n',
              mutants: [],
            },
          },
        },
      }),
    ).toEqual([`${fixture.relativePath}: mutation report source does not match the current file.`]);
  });

  it('rejects missing source files and reports without original source content', () => {
    const fixture = createSourceFixture('export const enabled = true;\n');

    expect(
      validateMutationSourceEvidence({
        root: fixture.root,
        report: {
          files: {
            [fixture.relativePath]: { mutants: [] },
            'missing-source.ts': { source: 'export {};\n', mutants: [] },
          },
        },
      }),
    ).toEqual([
      `${fixture.relativePath}: mutation report is missing the original source content.`,
      'missing-source.ts: mutated source file is missing.',
    ]);
  });

  it('requires every mutant to be detected for a small changed scope', () => {
    const result = evaluateMutationReport({
      report: reportWith(['Killed', 'Survived']),
      registry,
      mode: 'changed',
      toolVersion: '9.6.1',
    });
    expect(result.errors).toContain(
      'Changed critical scope has 2 mutants; all must be detected when fewer than 20 exist.',
    );
  });

  it('passes a full report at the break threshold with no NoCoverage mutants', () => {
    const statuses = [...Array(8).fill('Killed'), ...Array(2).fill('Survived')];
    const result = evaluateMutationReport({
      report: reportWith(statuses),
      registry,
      baseline: baselineWith(statuses),
      mode: 'full',
      toolVersion: '9.6.1',
    });
    expect(result.score).toBe(80);
    expect(result.errors).toEqual([]);
  });

  it('fails invalid terminal and NoCoverage states', () => {
    const result = evaluateMutationReport({
      report: reportWith(['Pending', 'NoCoverage']),
      registry,
      baseline: baselineWith([]),
      mode: 'full',
      toolVersion: '9.6.1',
    });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('invalid terminal status Pending'),
        expect.stringContaining('NoCoverage debt increased'),
      ]),
    );
  });

  it('fails closed when the full baseline is missing or internally inconsistent', () => {
    const missing = evaluateMutationReport({
      report: reportWith(['Killed']),
      registry,
      mode: 'full',
      toolVersion: '9.6.1',
    });
    expect(missing.errors).toContain('Full mutation baseline schemaVersion must be 1.');

    const inconsistent = evaluateMutationReport({
      report: reportWith(['Killed']),
      registry,
      baseline: { ...baselineWith(['Killed']), detected: 0 },
      mode: 'full',
      toolVersion: '9.6.1',
    });
    expect(inconsistent.errors).toEqual(
      expect.arrayContaining([
        'Full mutation baseline counts are internally inconsistent.',
        'Full mutation baseline score does not match its counts.',
      ]),
    );
  });

  it('rejects a full report generated from a stale or narrowed mutation input', () => {
    const statuses = ['Killed'];
    const report = reportWith(statuses);
    report.config.mutate = ['src/lib/auth/**/*.ts'];

    const result = evaluateMutationReport({
      report,
      registry,
      baseline: baselineWith(statuses),
      mode: 'full',
      toolVersion: '9.6.1',
    });

    expect(result.errors).toContain(
      'Full mutation report input does not match the production policy.',
    );
  });

  it('rejects score, survived, and NoCoverage regressions in a full report', () => {
    const result = evaluateMutationReport({
      report: reportWith(['Killed', 'Survived', 'NoCoverage']),
      registry,
      baseline: baselineWith(['Killed', 'Killed']),
      mode: 'full',
      toolVersion: '9.6.1',
    });

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('regressed below baseline'),
        expect.stringContaining('Survived debt increased'),
        expect.stringContaining('NoCoverage debt increased'),
      ]),
    );
  });

  it('keeps the 80% threshold for changed critical code even with a legacy full baseline', () => {
    const result = evaluateMutationReport({
      report: reportWith([...Array(15).fill('Killed'), ...Array(5).fill('Survived')]),
      registry,
      baseline: baselineWith(['NoCoverage']),
      mode: 'changed',
      toolVersion: '9.6.1',
    });

    expect(result.errors).toContain('Mutation score 75.00% is below the 80% break threshold.');
  });

  it('rejects an unsupported report schema instead of guessing compatibility', () => {
    const report = reportWith(['Killed']);
    report.schemaVersion = '2';

    const result = evaluateMutationReport({
      report,
      registry,
      mode: 'changed',
      toolVersion: '9.6.1',
    });

    expect(result.errors).toContain('Stryker mutation report schemaVersion must be 1.0.');
  });

  it('rejects mutation evidence produced by a different Stryker version', () => {
    const report = reportWith(['Killed']);
    report.framework.version = '9.5.0';

    const result = evaluateMutationReport({
      report,
      registry,
      mode: 'changed',
      toolVersion: '9.6.1',
    });

    expect(result.errors).toContain(
      'Mutation report StrykerJS version does not match the gate version.',
    );
  });

  it('binds changed-mode evidence to the exact selected files and commit', () => {
    const report = {
      ...reportWith(['Killed']),
      config: { mutate: ['src/lib/auth.ts'] },
    };
    const scope = {
      schemaVersion: 1,
      mode: 'changed',
      headSha: 'abc123',
      files: ['src/lib/auth.ts'],
    };

    expect(
      validateMutationScopeEvidence({ report, scope, mode: 'changed', headSha: 'abc123' }),
    ).toEqual([]);
    expect(
      validateMutationScopeEvidence({
        report,
        scope: { ...scope, files: ['src/models/User.ts'] },
        mode: 'changed',
        headSha: 'abc123',
      }),
    ).toEqual(
      expect.arrayContaining([
        'Mutation report files do not exactly match the changed critical scope.',
        'Stryker mutate input does not exactly match the changed critical scope.',
      ]),
    );
  });

  it('binds full-mode evidence to the centralized production patterns', () => {
    const report = {
      ...reportWith(['Killed']),
      config: {
        mutate: [...CRITICAL_MUTATION_PATTERNS, '!src/**/*.{test,spec}.{ts,tsx}'],
      },
    };
    const scope = {
      schemaVersion: 1,
      mode: 'full',
      headSha: 'abc123',
      fullPatterns: [...CRITICAL_MUTATION_PATTERNS],
    };

    expect(
      validateMutationScopeEvidence({ report, scope, mode: 'full', headSha: 'abc123' }),
    ).toEqual([]);
    expect(
      validateMutationScopeEvidence({
        report,
        scope: { ...scope, headSha: 'stale' },
        mode: 'full',
        headSha: 'abc123',
      }),
    ).toContain('Mutation scope HEAD does not match the checked commit.');
  });
});
