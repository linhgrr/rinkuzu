import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertRatchetableBaseline,
  duplicationConfigFingerprint,
  fingerprintDuplicate,
  isFieldListOnlyDuplicate,
  isImportOnlyDuplicate,
  removableTotals,
  validateDuplicationConfig,
  validateDuplicationProvenance,
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
    // Two errors, not one: the clone is unknown *and* the baseline entry it
    // displaced no longer corresponds to anything the detector found. The
    // second half is what stops a re-cut from hiding a new clone among stale
    // entries nobody checks.
    expect(validateDuplicationReport(report(), baseline(), ['new-clone'])).toEqual([
      'New duplicate detected: src/a.ts:1-5 <-> src/b.ts:1-5.',
      'Baseline fingerprint known-clone matches no clone in the report; re-cut quality/duplication-baseline.json.',
    ]);
  });

  it('fails closed for incomplete scan coverage and inconsistent reports', () => {
    const result = report({ sources: 12, clones: 0 });
    expect(validateDuplicationReport(result, baseline(), ['known-clone'])).toEqual([
      'jscpd report is inconsistent: 1 clone records but total.clones=0.',
      'Only 12 source files were analyzed; minimum is 400.',
    ]);
  });

  it('excludes only complete import-only fragments from fingerprint regression', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rinkuzu-duplication-imports-'));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, 'src'));
    const imports = [
      'import {',
      '  first,',
      '  second,',
      "} from './dependency';",
      "import type { Contract } from './contract';",
    ].join('\n');
    writeFileSync(path.join(root, 'src', 'a.ts'), `${imports}\n`);
    writeFileSync(path.join(root, 'src', 'b.ts'), `${imports}\n`);
    const duplicate = {
      format: 'typescript',
      firstFile: { name: 'a.ts', start: 1, end: 5 },
      secondFile: { name: 'b.ts', start: 1, end: 5 },
    };

    expect(isImportOnlyDuplicate(root, duplicate)).toBe(true);
    expect(
      validateDuplicationReport(report(), baseline({ knownCloneFingerprints: [] }), [], []),
    ).toEqual([]);
  });

  it('keeps executable and mixed import fragments actionable', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rinkuzu-duplication-logic-'));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, 'src'));
    const executable = [
      "import { dependency } from './dependency';",
      'export function execute() {',
      '  return dependency();',
      '}',
      '',
    ].join('\n');
    writeFileSync(path.join(root, 'src', 'a.ts'), executable);
    writeFileSync(path.join(root, 'src', 'b.ts'), executable);
    const duplicate = {
      format: 'typescript',
      firstFile: { name: 'a.ts', start: 1, end: 4 },
      secondFile: { name: 'b.ts', start: 1, end: 4 },
    };

    expect(isImportOnlyDuplicate(root, duplicate)).toBe(false);
    const evidence = report();
    expect(
      validateDuplicationReport(evidence, baseline(), ['new-clone'], evidence.duplicates),
    ).toEqual([
      'New duplicate detected: src/a.ts:1-5 <-> src/b.ts:1-5.',
      'Baseline fingerprint known-clone matches no clone in the report; re-cut quality/duplication-baseline.json.',
    ]);
  });

  it('fails closed for parse-error fragments instead of treating them as import-only', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rinkuzu-duplication-parse-'));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, 'src'));
    // Incomplete import: runtime parseDiagnostics must be non-empty → not import-only.
    const broken = ['import {', '  first,', '  second', "from './dependency'", ''].join('\n');
    writeFileSync(path.join(root, 'src', 'a.ts'), broken);
    writeFileSync(path.join(root, 'src', 'b.ts'), broken);
    const duplicate = {
      format: 'typescript',
      firstFile: { name: 'a.ts', start: 1, end: 4 },
      secondFile: { name: 'b.ts', start: 1, end: 4 },
    };

    expect(isImportOnlyDuplicate(root, duplicate)).toBe(false);
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

  it('keeps clone fingerprints stable across path separators', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'rinkuzu-duplication-'));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, 'src', 'nested'), { recursive: true });
    const fragment = ['const one = 1;', 'const two = 2;', 'const three = 3;'].join('\n');
    writeFileSync(path.join(root, 'src', 'nested', 'a.ts'), `${fragment}\n`);
    writeFileSync(path.join(root, 'src', 'nested', 'b.ts'), `${fragment}\n`);

    const windowsPaths = {
      format: 'typescript',
      firstFile: { name: 'nested\\a.ts', start: 1, end: 3 },
      secondFile: { name: 'nested\\b.ts', start: 1, end: 3 },
    };
    const posixPaths = {
      format: 'typescript',
      firstFile: { name: 'nested/a.ts', start: 1, end: 3 },
      secondFile: { name: 'nested/b.ts', start: 1, end: 3 },
    };

    expect(fingerprintDuplicate(root, windowsPaths)).toBe(fingerprintDuplicate(root, posixPaths));
  });
});

/**
 * The baseline is evidence, and evidence has to be checkable.
 *
 * It used to claim a `sourceCommit`, which could never be true: the file is cut
 * from a working tree that has no commit yet, so the field either named the
 * parent — whose sources it does not describe — or a SHA that would exist only
 * after the file naming it was written. The one that shipped named an object
 * that was not in the repository at all, and nothing checked it, which is the
 * definition of provenance theatre.
 */
describe('baseline provenance', () => {
  function provenanced(overrides = {}) {
    const draft = {
      ...baseline(),
      scope: { paths: ['src'] },
      generatedFrom: 'working-tree',
      ...overrides,
    };
    return { ...draft, configFingerprint: duplicationConfigFingerprint(draft) };
  }

  it('accepts a baseline whose fingerprint matches the config it records', () => {
    expect(validateDuplicationProvenance(provenanced())).toEqual([]);
  });

  it('refuses a baseline that claims a commit instead of a working tree', () => {
    const errors = validateDuplicationProvenance(
      provenanced({ generatedFrom: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }),
    );
    expect(errors.join('\n')).toContain('generatedFrom must be "working-tree"');
  });

  it('refuses a baseline with no provenance at all', () => {
    expect(validateDuplicationProvenance(baseline())).not.toEqual([]);
  });

  it('catches a hand-edited ceiling, which is the laundering this exists to stop', () => {
    // Raising a limit by hand leaves the fingerprint describing the limits that
    // were actually measured, so the mismatch is the tell.
    const honest = provenanced();
    const laundered = { ...honest, limits: { ...honest.limits, clones: 999 } };
    const errors = validateDuplicationProvenance(laundered);
    expect(errors.join('\n')).toContain('configFingerprint');
  });

  it('catches a widened detector scope smuggled in under an unchanged fingerprint', () => {
    const honest = provenanced();
    const widened = { ...honest, scope: { paths: ['src', 'scripts'] } };
    expect(validateDuplicationProvenance(widened)).not.toEqual([]);
  });

  it('fingerprints the configuration, not the sources', () => {
    // A fingerprint that changed with every edit would be regenerated on every
    // commit without ever being read, which is worse than not having one.
    const first = duplicationConfigFingerprint(provenanced());
    const second = duplicationConfigFingerprint(provenanced());
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('the fingerprint set has to match the report in both directions', () => {
  it('fails on a baseline entry no clone in the report produces', () => {
    // The laundering hole this closes: without it, a re-cut could append a new
    // clone quietly among dozens of stale entries nobody checks. Now every
    // entry must correspond to a clone that actually exists.
    const evidence = report();
    const errors = validateDuplicationReport(
      evidence,
      baseline({ knownCloneFingerprints: ['known-clone', 'a-clone-that-no-longer-exists'] }),
      ['known-clone'],
      evidence.duplicates,
    );
    expect(errors.join('\n')).toContain('matches no clone in the report');
  });

  it('still fails on a clone the baseline does not know about', () => {
    const evidence = report();
    const errors = validateDuplicationReport(
      evidence,
      baseline({ knownCloneFingerprints: [] }),
      ['a-brand-new-clone'],
      evidence.duplicates,
    );
    expect(errors.join('\n')).toContain('New duplicate detected');
  });

  it('refuses to call a report green when two clones fingerprint the same', () => {
    const twoDuplicates = {
      ...report(),
      duplicates: [...report().duplicates, ...report().duplicates],
      statistics: { total: { ...report().statistics.total, clones: 2 } },
    };
    const errors = validateDuplicationReport(
      twoDuplicates,
      baseline({ knownCloneFingerprints: ['known-clone'] }),
      ['known-clone', 'known-clone'],
      twoDuplicates.duplicates,
    );
    expect(errors.join('\n')).toContain('ambiguous');
  });
});

/**
 * `rebaselineDuplication` may only ratchet ceilings down. These pin the two
 * guards it runs before writing anything — migrated from the retired
 * `scripts/update-duplication-baseline.mjs` (Tool B), whose only merit over
 * `rebaselineDuplication` was this guard. Exercised directly against the
 * extracted `assertRatchetableBaseline` because `rebaselineDuplication`
 * itself shells out to a real jscpd run.
 */
describe('the ratchet-only guard on a baseline re-cut', () => {
  const ratchetBaseline = {
    limits: { clones: 68, duplicatedLines: 687, percentage: 2.2 },
  };

  it('allows totals that lower or hold both ceilings', () => {
    expect(() =>
      assertRatchetableBaseline(ratchetBaseline, {
        fingerprints: ['b-new', 'a-new'],
        totals: { clones: 10, duplicatedLines: 100, percentage: 0.5 },
      }),
    ).not.toThrow();
  });

  it('refuses to ratchet up', () => {
    expect(() =>
      assertRatchetableBaseline(ratchetBaseline, {
        fingerprints: ['x'],
        totals: { clones: 69, duplicatedLines: 100, percentage: 0.5 },
      }),
    ).toThrow(/ratchet/i);
    expect(() =>
      assertRatchetableBaseline(ratchetBaseline, {
        fingerprints: ['x'],
        totals: { clones: 10, duplicatedLines: 688, percentage: 0.5 },
      }),
    ).toThrow(/ratchet/i);
  });

  it('rejects duplicate fingerprints', () => {
    expect(() =>
      assertRatchetableBaseline(ratchetBaseline, {
        fingerprints: ['x', 'x'],
        totals: { clones: 1, duplicatedLines: 5, percentage: 0.1 },
      }),
    ).toThrow(/ambiguous/i);
  });
});

describe('the shipped baseline', () => {
  const shipped = JSON.parse(
    readFileSync(path.join(process.cwd(), 'quality', 'duplication-baseline.json'), 'utf8'),
  );

  it('carries provenance that validates against itself', () => {
    expect(validateDuplicationProvenance(shipped)).toEqual([]);
  });

  it('no longer carries the self-referential commit fields', () => {
    expect(shipped).not.toHaveProperty('sourceCommit');
    expect(shipped).not.toHaveProperty('sourceNote');
  });
});

describe('cross-layer field lists', () => {
  /**
   * The three-layer standard requires each layer to declare its own record
   * shapes and forbids sharing them, so the same field list appears in the
   * persistence record, the entity, the DTO and the view model by design. No
   * helper can remove those without breaking the rule that put them there --
   * the same argument that already excludes import lists.
   */
  function fieldListRoot(name: string, body: string) {
    const root = mkdtempSync(path.join(tmpdir(), `rinkuzu-duplication-${name}-`));
    temporaryDirectories.push(root);
    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src', 'a.ts'), `${body}\n`);
    writeFileSync(path.join(root, 'src', 'b.ts'), `${body}\n`);
    return root;
  }

  const duplicate = (lines: number) => ({
    format: 'typescript',
    firstFile: { name: 'a.ts', start: 1, end: lines },
    secondFile: { name: 'b.ts', start: 1, end: lines },
    lines,
  });

  it('treats a bare list of property signatures as mandated', () => {
    const body = [
      '  quizId: string;',
      '  quizTitle: string;',
      '  questionId?: string;',
      '  createdAt: Date;',
      '}',
    ].join('\n');

    expect(isFieldListOnlyDuplicate(fieldListRoot('fields', body), duplicate(5))).toBe(true);
  });

  it('treats the declaration with its header as mandated too', () => {
    const body = [
      'export interface Thing {',
      '  id: string;',
      '  amount: number;',
      '  isActive: boolean;',
      '}',
    ].join('\n');

    expect(isFieldListOnlyDuplicate(fieldListRoot('decl', body), duplicate(5))).toBe(true);
  });

  it('does not excuse a method, which is logic and could be shared', () => {
    const body = [
      '  id: string;',
      '  total(): number;',
      '  createdAt: Date;',
      '  updatedAt: Date;',
      '}',
    ].join('\n');

    expect(isFieldListOnlyDuplicate(fieldListRoot('method', body), duplicate(5))).toBe(false);
  });

  it('does not excuse duplicated statements that merely look declarative', () => {
    const body = [
      '  const a = compute(1);',
      '  const b = compute(2);',
      '  const c = compute(3);',
      '  return a + b + c;',
      '}',
    ].join('\n');

    expect(isFieldListOnlyDuplicate(fieldListRoot('stmts', body), duplicate(5))).toBe(false);
  });

  it('fails closed on a fragment it cannot parse', () => {
    const body = ['  id: string;', '  broken: <<<', '  createdAt: Date;', '}'].join('\n');

    expect(isFieldListOnlyDuplicate(fieldListRoot('broken', body), duplicate(4))).toBe(false);
  });
});

describe('removableTotals', () => {
  it('counts only the clones a change could remove', () => {
    const totals = removableTotals({ statistics: { total: { sources: 700, lines: 1000 } } }, [
      { lines: 12 },
      { lines: 8 },
    ]);

    expect(totals).toEqual({
      sources: 700,
      clones: 2,
      duplicatedLines: 20,
      lines: 1000,
      percentage: 2,
    });
  });

  it('reports zero rather than dividing by zero on an empty scan', () => {
    expect(removableTotals({ statistics: { total: { sources: 0, lines: 0 } } }, [])).toMatchObject({
      clones: 0,
      duplicatedLines: 0,
      percentage: 0,
    });
  });
});
