import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const repository = process.env.GITHUB_REPOSITORY ?? 'linhgrr/rinkuzu';
const token = process.env.GITHUB_ADMIN_TOKEN;

if (!token) {
  throw new Error('GITHUB_ADMIN_TOKEN with Administration: write is required');
}

const policy = JSON.parse(
  await fs.readFile(path.join(root, '.github/rulesets/master-production.json'), 'utf8'),
);
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'rinkuzu-production-ruleset-applier',
  'X-GitHub-Api-Version': '2022-11-28',
};

const listResponse = await fetch(`https://api.github.com/repos/${repository}/rulesets`, {
  headers,
});
if (!listResponse.ok) throw new Error(`Unable to list rulesets: HTTP ${listResponse.status}`);
const existing = (await listResponse.json()).find((ruleset) => ruleset.name === policy.name);
const url = existing
  ? `https://api.github.com/repos/${repository}/rulesets/${existing.id}`
  : `https://api.github.com/repos/${repository}/rulesets`;
const response = await fetch(url, {
  method: existing ? 'PUT' : 'POST',
  headers,
  body: JSON.stringify(policy),
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(`Unable to apply ruleset: HTTP ${response.status}: ${detail}`);
}

const applied = await response.json();
process.stdout.write(`Applied ${applied.name} ruleset (id=${applied.id}).\n`);
