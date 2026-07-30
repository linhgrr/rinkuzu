import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();

describe('pre-commit guard', () => {
  it('keeps commits fast and moves comprehensive local checks to pre-push', () => {
    const preCommitHook = readFileSync(`${repositoryRoot}/.husky/pre-commit`, 'utf8');
    const prePushHook = readFileSync(`${repositoryRoot}/.husky/pre-push`, 'utf8');
    const packageJson = JSON.parse(readFileSync(`${repositoryRoot}/package.json`, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const preCommitGate = packageJson.scripts?.['precommit:fast'] ?? '';
    const prePushGate = packageJson.scripts?.['prepush:full'] ?? '';
    const fullVerificationGate = packageJson.scripts?.['verify:full'] ?? '';

    expect(preCommitHook).toMatch(/^#!\/usr\/bin\/env sh\nset -eu\n/);
    expect(preCommitHook.indexOf('npx lint-staged')).toBeLessThan(
      preCommitHook.indexOf('npm run precommit:fast'),
    );
    expect(preCommitGate).toBe('npm run check:node && npm run check:routes');
    expect(preCommitGate).not.toMatch(/install|typecheck|lint|test|build/u);

    expect(prePushHook).toMatch(/^#!\/usr\/bin\/env sh\nset -eu\n/);
    expect(prePushHook).toContain('npm run prepush:full');
    for (const command of [
      'npm run typecheck',
      'npm run typecheck:scripts',
      'npm run lint',
      'npm run test:node',
      'npm run test:component',
      'npm run build',
    ]) {
      expect(prePushGate).toContain(command);
    }
    expect(prePushGate).not.toContain('npm run test:unit');

    expect(fullVerificationGate).toContain('npm run check:dead-code');
    expect(fullVerificationGate).toContain('npm run test:quality');
    expect(fullVerificationGate).toContain('npm run test:unit');
  });

  it('runs the design-system ratchet once in static analysis through the lint script', () => {
    const packageJson = JSON.parse(readFileSync(`${repositoryRoot}/package.json`, 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const workflow = readFileSync(`${repositoryRoot}/.github/workflows/ci.yml`, 'utf8');

    expect(packageJson.scripts?.['lint']).toContain('npm run check:design-system');
    expect(workflow).toContain('run: npm run lint');
    expect(workflow).not.toContain('run: npm run check:design-system');
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
