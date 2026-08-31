import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain ESM gate script, checked by tsconfig.scripts.json
import { classifyChangedFiles, isProse, readChangedFiles } from '../../scripts/ci-affected.mjs';

/**
 * The filter decides whether CI may skip building, booting a database and
 * driving a browser. Getting it wrong in the permissive direction produces a
 * green pipeline that looked at nothing, so these assertions are mostly about
 * the ways it must refuse to say "skip".
 */
describe('deciding whether a change can reach a bundle', () => {
  it('skips the heavy stages only when every path is prose', () => {
    const decision = classifyChangedFiles([
      'docs/BILLING_WEBHOOK_RUNBOOK.md',
      'README.md',
      '.claude/skills/gitnexus-cli/SKILL.md',
      'LICENSE',
    ]);

    expect(decision.heavy).toBe(false);
    expect(decision.reason).toContain('all 4');
  });

  it.each([
    ['a source file', 'src/lib/password.ts'],
    ['a test', 'tests/unit/billing/settlement.test.ts'],
    ['the lockfile', 'package-lock.json'],
    ['a migration script', 'scripts/sync-performance-indexes.mjs'],
    ['a stylesheet', 'src/app/globals.css'],
    ['a message catalogue', 'messages/en/adaptiveLearning.json'],
  ])('runs everything when the change touches %s', (_label, file) => {
    expect(classifyChangedFiles(['docs/a.md', file]).heavy).toBe(true);
  });

  it.each([
    ['the workflow itself', '.github/workflows/ci.yml'],
    ['the shared setup action', '.github/actions/node-env/action.yml'],
  ])('never lets %s switch the stages off', (_label, file) => {
    // A change that decides how the stages run is the last thing allowed to
    // decide that they do not: the filter would otherwise be able to disable
    // the very jobs that would have checked it.
    expect(isProse(file)).toBe(false);
    expect(classifyChangedFiles([file]).heavy).toBe(true);
  });

  it.each([
    ['no resolvable diff', null],
    ['an empty diff', [] as string[]],
  ])('fails closed on %s', (_label, files) => {
    expect(classifyChangedFiles(files).heavy).toBe(true);
  });

  it('treats a markdown file nested under source as code, not prose', () => {
    // Only top-level markdown and the documentation trees are prose. A README
    // inside a feature can be imported and rendered.
    expect(isProse('src/features/billing/README.md')).toBe(false);
    expect(isProse('README.md')).toBe(true);
  });

  it.each([
    ['no base sha', { GITHUB_EVENT_NAME: 'pull_request' }],
    ['an all-zero base', { GITHUB_EVENT_NAME: 'push', PUSH_BEFORE_SHA: '0'.repeat(40) }],
    ['an unresolvable base', { GITHUB_EVENT_NAME: 'pull_request', PR_BASE_SHA: 'f'.repeat(40) }],
    ['an event it does not know', { GITHUB_EVENT_NAME: 'release', PR_BASE_SHA: 'HEAD' }],
  ])('reports no diff for %s rather than guessing one', (_label, env) => {
    expect(readChangedFiles(env as NodeJS.ProcessEnv)).toBeNull();
  });
});
