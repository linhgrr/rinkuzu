import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();

describe('pre-commit guard', () => {
  it('fails fast before running the full gate', () => {
    const hook = readFileSync(`${repositoryRoot}/.husky/pre-commit`, 'utf8');

    expect(hook).toMatch(/^#!\/usr\/bin\/env sh\nset -eu\n/);
    expect(hook.indexOf('npx lint-staged')).toBeLessThan(hook.indexOf('npm run precommit:full'));
  });

  it('keeps ratchet baselines addable while ignoring transient perf output', () => {
    const baseline = spawnSync('git', ['check-ignore', '--no-index', 'perf/fe-budget.json'], {
      cwd: repositoryRoot,
    });
    const transientOutput = spawnSync(
      'git',
      ['check-ignore', '--no-index', 'perf/local-measurement.json'],
      { cwd: repositoryRoot },
    );

    expect(baseline.status).toBe(1);
    expect(transientOutput.status).toBe(0);
  });
});
