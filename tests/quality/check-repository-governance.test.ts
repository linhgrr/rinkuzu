import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const root = process.cwd();
const checkerPath = path.join(root, 'scripts/check-repository-governance.mjs');
const policyPath = path.join(root, '.github/rulesets/master-production.json');
const temporaryDirectories: string[] = [];

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`Missing required test fixture value: ${label}`);
  return value;
};

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
  it('accepts the committed policy', async () => {
    const result = await runChecker(await readPolicy());

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Repository governance is valid (policy only).');
  });

  it('rejects a policy that requires no status checks at all', async () => {
    const policy = await readPolicy();
    policy.rules = policy.rules.filter((rule) => rule.type !== 'required_status_checks');

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing required_status_checks rule');
  });

  // Statuses are per commit, so requiring an up-to-date branch would force a fresh CTO review and QA
  // pass every time master moves. The local gate re-runs CI on every new master head instead.
  it('accepts status checks that do not require an up-to-date branch', async () => {
    const policy = await readPolicy();
    const rule = policy.rules.find((candidate) => candidate.type === 'required_status_checks');
    expect(
      required(rule?.parameters, 'status check parameters')['strict_required_status_checks_policy'],
    ).toBe(false);

    const result = await runChecker(policy);

    expect(result.status).toBe(0);
  });

  it('rejects status checks that omit a required local context', async () => {
    const policy = await readPolicy();
    const rule = policy.rules.find((candidate) => candidate.type === 'required_status_checks');
    Object.assign(required(rule?.parameters, 'status check parameters'), {
      required_status_checks: [{ context: 'Lint and architecture' }],
    });

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must include "local/ci"');
  });

  // GitHub Actions is off for this repository (no minutes); the local gate in ops/local-ci reports
  // local/ci and the CTO/QA agents report review/cto and qa/preview. A context outside that set can
  // never be reported, which GitHub shows as a merge that stays pending forever.
  it('requires exactly the contexts the local gate and reviewers report', async () => {
    const policy = await readPolicy();
    const rule = policy.rules.find((candidate) => candidate.type === 'required_status_checks');
    const contexts = (
      required(rule?.parameters, 'status check parameters')['required_status_checks'] as Array<{
        context: string;
      }>
    ).map((check) => check.context);

    expect(contexts.sort()).toEqual(['local/ci', 'qa/preview', 'review/cto']);
  });

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
