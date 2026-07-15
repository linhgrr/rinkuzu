import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fingerprintDuplicate,
  validateDuplicationConfig,
  validateDuplicationReport,
} from '../../scripts/check-duplication.mjs';

const temporaryDirectories: string[] = [];

function baseline(overrides = {}) {
  return {
    schemaVersion: 1,
    detector: { version: '5.0.12' },
    minimumAnalyzedSources: 400,
    limits: { clones: 2, duplicatedLines: 20, percentage: 2.2 },
    knownCloneFingerprints: ['known-clone'],
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    duplicates: [
      {
        format: 'typescript',
        firstFile: { name: 'a.ts', start: 1, end: 5 },
        secondFile: { name: 'b.ts', start: 1, end: 5 },
      },
    ],
    statistics: {
      total: {
        clones: 1,
        duplicatedLines: 5,
        percentage: 1,
        sources: 450,
        ...overrides,
      },
    },
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('duplicate-code quality gate', () => {
  it('locks detector sensitivity, scope, exclusions, and evidence output', () => {
    const policy = baseline({
      detector: {
        version: '5.0.12',
        mode: 'mild',
        minLines: 5,
        minTokens: 50,
        maxSize: '10mb',
      },
      scope: {
        paths: ['src'],
        formats: ['typescript', 'javascript'],
        ignore: ['**/*.test.*'],
      },
    });
    const config = {
      path: ['src'],
      format: ['typescript', 'javascript'],
      mode: 'weak',
      minLines: 5,
      minTokens: 50,
      maxSize: '10mb',
      threshold: 2.2,
      reporters: ['console'],
      output: 'reports/jscpd',
      ignore: ['**/*.test.*'],
      gitignore: true,
      skipLocal: false,
      absolute: false,
    };

    expect(validateDuplicationConfig(config, policy)).toEqual([
      '.jscpd.json mode must be "mild"; received "weak".',
      '.jscpd.json reporters must be ["json"]; received ["console"].',
    ]);
  });

  it('accepts a known clone while aggregate ceilings and scan coverage hold', () => {
    expect(validateDuplicationReport(report(), baseline(), ['known-clone'])).toEqual([]);
  });

  it('fails on a new clone even when aggregate metrics remain below the ceilings', () => {
    expect(validateDuplicationReport(report(), baseline(), ['new-clone'])).toEqual([
      'New duplicate detected: src/a.ts:1-5 <-> src/b.ts:1-5.',
    ]);
  });

  it('fails closed for incomplete scan coverage and inconsistent reports', () => {
    const result = report({ sources: 12, clones: 0 });
    expect(validateDuplicationReport(result, baseline(), ['known-clone'])).toEqual([
      'jscpd report is inconsistent: 1 clone records but total.clones=0.',
      'Only 12 source files were analyzed; minimum is 400.',
    ]);
  });

  it('keeps a fingerprint stable when unchanged fragments move to other lines', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rinkuzu-duplication-'));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, 'src'));
    const fragment = ['const one = 1;', 'const two = 2;', 'const three = 3;'].join('\n');
    writeFileSync(path.join(root, 'src', 'a.ts'), `${fragment}\n`);
    writeFileSync(path.join(root, 'src', 'b.ts'), `${fragment}\n`);
    const original = {
      format: 'typescript',
      firstFile: { name: 'a.ts', start: 1, end: 3 },
      secondFile: { name: 'b.ts', start: 1, end: 3 },
    };
    const firstFingerprint = fingerprintDuplicate(root, original);

    writeFileSync(path.join(root, 'src', 'a.ts'), `// shifted\n${fragment}\n`);
    writeFileSync(path.join(root, 'src', 'b.ts'), `// shifted\n${fragment}\n`);
    const shifted = {
      ...original,
      firstFile: { name: 'a.ts', start: 2, end: 4 },
      secondFile: { name: 'b.ts', start: 2, end: 4 },
    };
    expect(fingerprintDuplicate(root, shifted)).toBe(firstFingerprint);
  });
});
