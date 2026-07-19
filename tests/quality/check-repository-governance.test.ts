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

function pullRequestParameters(policy: RulesetPolicy): Record<string, unknown> {
  const rule = policy.rules.find(({ type }) => type === 'pull_request');
  if (!rule?.parameters) throw new Error('Test policy is missing its pull_request rule');
  return rule.parameters;
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

  it.each([
    ['required approval', 'required_approving_review_count', 1, 'unavailable human approvals'],
    ['CODEOWNER approval', 'require_code_owner_review', true, 'sole CODEOWNER'],
    ['latest-push approval', 'require_last_push_approval', true, 'second maintainer'],
  ])('rejects %s that would deadlock a solo maintainer', async (_, key, value, message) => {
    const policy = await readPolicy();
    pullRequestParameters(policy)[key] = value;

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });

  it('rejects required signatures without a verified-history cutover', async () => {
    const policy = await readPolicy();
    policy.rules.push({ type: 'required_signatures' });

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('signed commits require a separate verified-history cutover');
  });
});
