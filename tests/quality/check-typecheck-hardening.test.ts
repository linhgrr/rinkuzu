import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  compareAgainstBaseline,
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
