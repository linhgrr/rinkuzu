import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const root = process.cwd();
const checkerPath = path.join(root, 'scripts/check-repository-governance.mjs');
const policyPath = path.join(root, '.github/rulesets/master-production.json');
const temporaryDirectories: string[] = [];

type RulesetPolicy = {
  rules: Array<{
    type: string;
    parameters?: Record<string, unknown>;
  }>;
};

async function readPolicy(): Promise<RulesetPolicy> {
  return JSON.parse(await readFile(policyPath, 'utf8')) as RulesetPolicy;
}

async function runChecker(policy: RulesetPolicy) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'rinkuzu-governance-'));
  temporaryDirectories.push(temporaryRoot);
  const temporaryPolicyDirectory = path.join(temporaryRoot, '.github/rulesets');
  await mkdir(temporaryPolicyDirectory, { recursive: true });
  await writeFile(
    path.join(temporaryPolicyDirectory, 'master-production.json'),
    `${JSON.stringify(policy)}\n`,
  );

  return spawnSync(process.execPath, [checkerPath], {
    cwd: temporaryRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: 'false', GITHUB_TOKEN: '' },
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('repository governance checker', () => {
  it('accepts the committed solo-maintainer policy', async () => {
    const result = await runChecker(await readPolicy());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Repository governance is valid (policy only).');
  });

  it.each(['pull_request', 'required_status_checks'])(
    'rejects %s because it blocks the configured direct-push workflow',
    async (type) => {
      const policy = await readPolicy();
      policy.rules.push({ type });

      const result = await runChecker(policy);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain(`${type} would block the configured direct-push workflow`);
    },
  );

  it('rejects routine bypass actors', async () => {
    const policy = await readPolicy();
    Object.assign(policy, {
      bypass_actors: [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
    });

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('routine bypass actors are forbidden');
  });

  it('rejects required signatures without a verified-history cutover', async () => {
    const policy = await readPolicy();
    policy.rules.push({ type: 'required_signatures' });

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('signed commits require a separate verified-history cutover');
  });
});
