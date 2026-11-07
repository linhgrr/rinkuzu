#!/usr/bin/env node
// Vercel "Ignored Build Step" (RIN-1153). Exit 0 = skip the build, exit 1 = build.
//
// Hobby allows 100 deployments per rolling 24 h. Previews are only looked at for
// `type:ui` PRs (QA), so every other preview is wasted quota. Production is never
// skipped. Any doubt (no token, API error, timeout) builds: a broken check must
// never cost QA a preview.
import { pathToFileURL } from 'node:url';

const REPO = 'linhgrr/rinkuzu';
const UI_LABEL = 'type:ui';
const TIMEOUT_MS = 5000;

/**
 * Pure decision. `labels` is an array of label names, or null when it could not
 * be read (missing token, API error, timeout).
 * @param {{ vercelEnv?: string, branch?: string, pullRequestId?: string, labels: string[] | null }} input
 * @returns {{ build: boolean, reason: string }}
 */
export function decideBuild({ vercelEnv, branch, pullRequestId, labels }) {
  if (vercelEnv === 'production') return { build: true, reason: 'production deployment' };
  if (typeof branch === 'string' && branch.startsWith('dependabot/')) {
    return { build: false, reason: 'dependabot branch' };
  }
  if (!pullRequestId) return { build: false, reason: 'branch push without a pull request' };
  if (labels === null) return { build: true, reason: 'PR labels unavailable, failing open' };
  return labels.includes(UI_LABEL)
    ? { build: true, reason: `PR #${pullRequestId} has ${UI_LABEL}` }
    : { build: false, reason: `PR #${pullRequestId} has no ${UI_LABEL} label` };
}

/**
 * @param {string} pullRequestId
 * @param {string | undefined} token
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<string[] | null>} label names, or null on any failure
 */
export async function fetchLabels(pullRequestId, token, fetchImpl = fetch) {
  if (!token) return null;
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${REPO}/issues/${encodeURIComponent(pullRequestId)}/labels?per_page=100`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const body = await response.json();
    if (!Array.isArray(body)) return null;
    return body.map((label) => label?.name).filter((name) => typeof name === 'string');
  } catch {
    return null;
  }
}

async function main() {
  const env = process.env;
  const pullRequestId = env.VERCEL_GIT_PULL_REQUEST_ID;
  const needLabels =
    env.VERCEL_ENV !== 'production' &&
    !(env.VERCEL_GIT_COMMIT_REF ?? '').startsWith('dependabot/') &&
    Boolean(pullRequestId);
  const labels = needLabels ? await fetchLabels(pullRequestId, env.GITHUB_PR_READ_TOKEN) : null;
  const { build, reason } = decideBuild({
    vercelEnv: env.VERCEL_ENV,
    branch: env.VERCEL_GIT_COMMIT_REF,
    pullRequestId,
    labels,
  });
  console.log(`vercel-ignore-build: ${build ? 'BUILD' : 'SKIP'}: ${reason}`);
  process.exit(build ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
