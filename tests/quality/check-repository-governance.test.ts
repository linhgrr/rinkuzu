import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

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

  it('rejects status checks that do not require an up-to-date branch', async () => {
    const policy = await readPolicy();
    const rule = policy.rules.find((candidate) => candidate.type === 'required_status_checks');
    Object.assign(required(rule?.parameters, 'status check parameters'), {
      strict_required_status_checks_policy: false,
    });

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must require the branch to be up to date');
  });

  it('rejects status checks that omit the aggregating gate', async () => {
    const policy = await readPolicy();
    const rule = policy.rules.find((candidate) => candidate.type === 'required_status_checks');
    Object.assign(required(rule?.parameters, 'status check parameters'), {
      required_status_checks: [{ context: 'Lint and architecture' }],
    });

    const result = await runChecker(policy);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must include "Production Gate"');
  });

  // The context is a string in one file naming a job in another. Renaming the
  // job would leave master requiring a check that can never report, which
  // GitHub surfaces as a permanently pending merge rather than as an error, so
  // the two files are tied together here.
  it('names a job that the pipeline actually defines', async () => {
    const policy = await readPolicy();
    const rule = policy.rules.find((candidate) => candidate.type === 'required_status_checks');
    const contexts = (
      required(rule?.parameters, 'status check parameters')['required_status_checks'] as Array<{
        context: string;
      }>
    ).map((check) => check.context);
    const workflow = parseYaml(
      await readFile(path.join(root, '.github/workflows/ci.yml'), 'utf8'),
    ) as { jobs: Record<string, { name?: string }> };
    const jobNames = Object.entries(workflow.jobs).map(([id, job]) => job.name ?? id);

    expect(contexts.length).toBeGreaterThan(0);
    for (const context of contexts) {
      expect(jobNames, `no job in ci.yml reports the check context "${context}"`).toContain(
        context,
      );
    }
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
