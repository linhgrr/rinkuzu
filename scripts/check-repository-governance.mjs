import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const policyPath = path.join(root, '.github/rulesets/master-production.json');
const expectedRepository = process.env.GITHUB_REPOSITORY ?? 'linhgrr/rinkuzu';
const requiredContext = 'Production Gate';

function fail(message) {
  throw new Error(`Repository governance check failed: ${message}`);
}

function getRule(ruleset, type) {
  return ruleset.rules?.find((rule) => rule.type === type);
}

function assertRuleset(ruleset, source) {
  if (ruleset?.name !== 'master-production') fail(`${source}: unexpected ruleset name`);
  if (ruleset.target !== 'branch' || ruleset.enforcement !== 'active') {
    fail(`${source}: ruleset must target branches with active enforcement`);
  }
  if ((ruleset.bypass_actors?.length ?? 0) !== 0) {
    fail(`${source}: routine bypass actors are forbidden`);
  }

  const includes = ruleset.conditions?.ref_name?.include ?? [];
  if (!includes.includes('refs/heads/master')) fail(`${source}: master is not protected`);

  for (const type of [
    'deletion',
    'non_fast_forward',
    'required_linear_history',
    'required_signatures',
  ]) {
    if (!getRule(ruleset, type)) fail(`${source}: missing ${type} rule`);
  }

  const pullRequest = getRule(ruleset, 'pull_request')?.parameters;
  if (!pullRequest) fail(`${source}: missing pull_request rule`);
  if (pullRequest.required_approving_review_count < 1) {
    fail(`${source}: at least one approval is required`);
  }
  if (!pullRequest.require_code_owner_review) fail(`${source}: CODEOWNER review is required`);
  if (!pullRequest.require_last_push_approval) fail(`${source}: latest push approval is required`);
  if (!pullRequest.required_review_thread_resolution) {
    fail(`${source}: review conversations must be resolved`);
  }
  if (pullRequest.dismiss_stale_reviews_on_push) {
    fail(`${source}: dismiss-stale and latest-push approval must not both be enabled`);
  }

  const statusChecks = getRule(ruleset, 'required_status_checks')?.parameters;
  if (!statusChecks?.strict_required_status_checks_policy) {
    fail(`${source}: required checks must run on the latest/up-to-date branch`);
  }
  const contexts = statusChecks.required_status_checks?.map((check) => check.context) ?? [];
  if (!contexts.includes(requiredContext)) {
    fail(`${source}: ${requiredContext} is not a required check`);
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    fail(`${path.relative(root, filePath)} is missing or malformed: ${error.message}`);
  }
}

async function fetchLiveRulesets() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'rinkuzu-production-governance-check',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`https://api.github.com/repos/${expectedRepository}/rulesets`, {
    headers,
  });
  if (!response.ok) {
    fail(`GitHub rulesets API returned ${response.status}; live evidence is required`);
  }
  const summaries = await response.json();
  const summary = summaries.find((candidate) => candidate.name === 'master-production');
  if (!summary?.id) fail('active master-production ruleset is missing on GitHub');

  const detailResponse = await fetch(
    `https://api.github.com/repos/${expectedRepository}/rulesets/${summary.id}`,
    { headers },
  );
  if (!detailResponse.ok) {
    fail(`GitHub ruleset detail API returned ${detailResponse.status}`);
  }
  return detailResponse.json();
}

const policy = await readJson(policyPath);
assertRuleset(policy, 'declarative policy');

const requireLive = process.argv.includes('--live') || process.env.CI === 'true';
if (requireLive) {
  const liveRuleset = await fetchLiveRulesets();
  assertRuleset(liveRuleset, 'live GitHub ruleset');
}

process.stdout.write(
  `Repository governance is valid (${requireLive ? 'policy + live' : 'policy only'}).\n`,
);
