import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();

describe('pre-commit guard', () => {
  it('fails fast before running the full gate', () => {
    const hook = readFileSync(`${repositoryRoot}/.husky/pre-commit`, 'utf8');

    expect(hook).toMatch(/^#!\/usr\/bin\/env sh\nset -eu\n/);
    expect(hook.indexOf('npx lint-staged')).toBeLessThan(hook.indexOf('npm run precommit:full'));
  });

  it('keeps ratchet baselines addable while ignoring transient perf output', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'rinkuzu-gitignore-'));

    try {
      mkdirSync(join(fixtureRoot, 'perf'), { recursive: true });
      writeFileSync(join(fixtureRoot, '.gitignore'), readFileSync(`${repositoryRoot}/.gitignore`));
      writeFileSync(join(fixtureRoot, 'perf/fe-budget.json'), '{}\n');
      writeFileSync(join(fixtureRoot, 'perf/local-measurement.json'), '{}\n');
      const init = spawnSync('git', ['init', '--quiet'], { cwd: fixtureRoot });
      expect(init.status).toBe(0);

      const baseline = spawnSync('git', ['check-ignore', '--no-index', 'perf/fe-budget.json'], {
        cwd: fixtureRoot,
      });
      const transientOutput = spawnSync(
        'git',
        ['check-ignore', '--no-index', 'perf/local-measurement.json'],
        { cwd: fixtureRoot },
      );

      expect(baseline.status).toBe(1);
      expect(transientOutput.status).toBe(0);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
