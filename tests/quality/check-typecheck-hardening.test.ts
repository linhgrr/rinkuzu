import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  compareAgainstBaseline,
  evaluateHardeningRun,
  hardeningTscArgs,
  parseFailingFiles,
} from '../../scripts/check-typecheck-hardening.mjs';

const root = process.cwd();

describe('parseFailingFiles', () => {
  it('collects one entry per file, however many errors it has', () => {
    const output = [
      "src/a.ts(1,2): error TS2532: Object is possibly 'undefined'.",
      "src/a.ts(9,4): error TS2532: Object is possibly 'undefined'.",
      'src/b.tsx(3,1): error TS2375: Type is not assignable.',
    ].join('\n');

    expect(parseFailingFiles(output)).toEqual(['src/a.ts', 'src/b.tsx']);
  });

  it('ignores lines that are not tsc diagnostics', () => {
    const output = ['Starting compilation...', '', 'Found 0 errors.'].join('\n');

    expect(parseFailingFiles(output)).toEqual([]);
  });

  it('returns the files sorted, so the baseline has a stable order', () => {
    const output = [
      'src/z.ts(1,1): error TS1000: x',
      'src/a.ts(1,1): error TS1000: x',
      'src/m.ts(1,1): error TS1000: x',
    ].join('\n');

    expect(parseFailingFiles(output)).toEqual(['src/a.ts', 'src/m.ts', 'src/z.ts']);
  });
});

describe('compareAgainstBaseline', () => {
  it('reports a file that started failing', () => {
    expect(compareAgainstBaseline(['a.ts', 'b.ts'], ['a.ts'])).toEqual({
      added: ['b.ts'],
      resolved: [],
    });
  });

  it('reports a file that stopped failing, so the list cannot rot', () => {
    expect(compareAgainstBaseline(['a.ts'], ['a.ts', 'b.ts'])).toEqual({
      added: [],
      resolved: ['b.ts'],
    });
  });

  it('is quiet when the set is unchanged', () => {
    expect(compareAgainstBaseline(['a.ts', 'b.ts'], ['b.ts', 'a.ts'])).toEqual({
      added: [],
      resolved: [],
    });
  });
});

describe('hardeningTscArgs', () => {
  it('runs a full check, never from an incremental buildinfo', () => {
    const args = hardeningTscArgs('/repo');
    const flag = args.indexOf('--incremental');

    expect(flag).toBeGreaterThan(-1);
    expect(args[flag + 1]).toBe('false');
    expect(args).toContain('--noEmit');
  });
});

describe('evaluateHardeningRun', () => {
  const baseline = ['src/a.ts', 'src/b.ts'];
  const errorOutput = [
    "src/a.ts(1,2): error TS2532: Object is possibly 'undefined'.",
    "src/a.ts(4,2): error TS2532: Object is possibly 'undefined'.",
    'src/b.ts(3,1): error TS2375: Type is not assignable.',
  ].join('\n');

  it('fails as incomplete when tsc crashes without a parseable error, never claiming files pass', () => {
    const result = evaluateHardeningRun(
      {
        status: 134,
        signal: null,
        stdout: '',
        stderr: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory',
      },
      baseline,
    );

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('incomplete');
    const text = result.messages.join('\n');
    expect(text).toContain('hardening typecheck did not complete (exit 134)');
    expect(text).toContain('JavaScript heap out of memory');
    expect(text).not.toContain('now passes');
  });

  it('fails as incomplete when tsc is killed by a signal, even with error lines', () => {
    const result = evaluateHardeningRun(
      { status: null, signal: 'SIGKILL', stdout: errorOutput, stderr: '' },
      baseline,
    );

    expect(result.outcome).toBe('incomplete');
    expect(result.messages.join('\n')).toContain('did not complete (signal SIGKILL)');
  });

  it('fails as incomplete when tsc exits 1 or 2 with no parseable error line', () => {
    const result = evaluateHardeningRun(
      { status: 2, signal: null, stdout: 'error TS5083: Cannot read file.', stderr: '' },
      baseline,
    );

    expect(result.outcome).toBe('incomplete');
    expect(result.messages.join('\n')).toContain('error TS5083');
  });

  it('fails as incomplete when tsc could not be started', () => {
    const result = evaluateHardeningRun(
      { status: null, signal: null, stdout: '', stderr: '', error: new Error('spawn ENOENT') },
      baseline,
    );

    expect(result.outcome).toBe('incomplete');
    expect(result.messages.join('\n')).toContain('spawn ENOENT');
  });

  it('keeps only the last 40 lines of tsc output in the failure message', () => {
    const stdout = Array.from({ length: 100 }, (_, index) => `line ${index}`).join('\n');
    const result = evaluateHardeningRun({ status: 3, signal: null, stdout, stderr: '' }, baseline);
    const text = result.messages.join('\n');

    expect(text).toContain('line 99');
    expect(text).toContain('line 60');
    expect(text).not.toContain('line 59\n');
  });

  it('accepts a clean full run as every baseline file resolved', () => {
    const result = evaluateHardeningRun(
      { status: 0, signal: null, stdout: '', stderr: '' },
      baseline,
    );

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('drift');
    expect(result.resolved).toEqual(baseline);
  });

  it('holds on normal output that matches the baseline', () => {
    const result = evaluateHardeningRun(
      { status: 2, signal: null, stdout: errorOutput, stderr: '' },
      baseline,
    );

    expect(result).toMatchObject({ ok: true, outcome: 'holds', added: [], resolved: [] });
    expect(result.messages.join('\n')).toContain('ratchet holds at 2 file(s)');
  });

  it('reports real additions and removals as before', () => {
    const result = evaluateHardeningRun(
      {
        status: 2,
        signal: null,
        stdout: ['src/a.ts(1,2): error TS2532: x', 'src/c.ts(1,2): error TS2532: x'].join('\n'),
        stderr: '',
      },
      baseline,
    );

    expect(result).toMatchObject({
      ok: false,
      outcome: 'drift',
      added: ['src/c.ts'],
      resolved: ['src/b.ts'],
    });
    const text = result.messages.join('\n');
    expect(text).toContain('new file fails the hardening flags: src/c.ts');
    expect(text).toContain('src/b.ts now passes');
  });

  it('always reports the exit code and the parsed error-line count', () => {
    const result = evaluateHardeningRun(
      { status: 2, signal: null, stdout: errorOutput, stderr: '' },
      baseline,
    );

    expect(result.messages[0]).toBe('tsc exit 2; 3 parsed error line(s) in 2 file(s).');
  });
});

describe('the committed baseline', () => {
  it('lists real, existing files', () => {
    const baseline = JSON.parse(
      readFileSync(path.join(root, 'quality', 'typecheck-hardening-baseline.json'), 'utf8'),
    ) as { files: string[] };

    expect(baseline.files.length).toBeGreaterThan(0);
    for (const file of baseline.files) {
      expect(file).toMatch(/^(src|tests|scripts)\/.+\.(ts|tsx|mts|mjs)$/);
    }
  });

  it('is stored sorted and free of duplicates', () => {
    const baseline = JSON.parse(
      readFileSync(path.join(root, 'quality', 'typecheck-hardening-baseline.json'), 'utf8'),
    ) as { files: string[] };

    expect(baseline.files).toEqual([...new Set(baseline.files)].sort());
  });
});
