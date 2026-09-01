import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * A `check:` script that nothing invokes is worse than no script at all: it
 * reads like an enforced policy in review and in the docs, it keeps passing
 * locally when someone runs it by hand, and it never once runs in CI. Six of
 * them had drifted into that state, including `check:source-of-truth`, which
 * the architecture docs cite as a gate.
 *
 * So reachability is the property under test. An entry point is reachable when
 * something that actually executes — a workflow, a Git hook, a shell script, or
 * another npm script — invokes it by name. Importing the underlying module does
 * not count: `scripts/check-perf-budget.mjs` is imported by the Lighthouse
 * runner, which says nothing about whether `npm run check:perf-budget` is ever
 * called, and it is that entry point the reader mistakes for a gate.
 */

/** Entry points that are deliberately hand-run, each with the reason it cannot be automatic. */
const MANUAL_ENTRY_POINTS = new Map([
  [
    'check:orphaned-quiz-data',
    'Reads a live database. It is an operator inspection, not a policy over the source.',
  ],
  [
    'check:adaptive-contract:live',
    'Calls the vendor endpoint. CI gates on the vendored copy through check:adaptive-contract so the pipeline stays offline and deterministic.',
  ],
  [
    'check:perf-budget',
    'Re-scores an existing budget report by hand. The pipeline reaches the same module through perf:fe, which produces the evidence first.',
  ],
  [
    'check:mutation-report',
    'Re-scores an existing mutation report by hand. The pipeline reaches the same module through mutation:gate, which runs Stryker first.',
  ],
  [
    'check:duplication:rebaseline',
    'Rewrites the duplication baseline. Running this automatically would let any gate turn itself green.',
  ],
]);

/** Reads every file directly in `directory`; `extensions` empty means every file. */
const readTextFiles = (directory: string, extensions: string[] = []): string[] => {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        (extensions.length === 0 || extensions.some((ext) => entry.name.endsWith(ext))),
    )
    .map((entry) => fs.readFileSync(path.join(directory, entry.name), 'utf8'));
};

const scripts = (
  JSON.parse(fs.readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
).scripts;

const invocationSources = [
  ...readTextFiles('.github/workflows', ['.yml', '.yaml']),
  ...readTextFiles('.husky'),
  ...readTextFiles('scripts', ['.sh']),
];

const isInvoked = (name: string) =>
  invocationSources.some((source) => source.includes(`run ${name}`)) ||
  Object.entries(scripts).some(([other, body]) => other !== name && body.includes(`run ${name}`));

const gateEntryPoints = Object.keys(scripts).filter((name) => name.startsWith('check:'));

describe('gate entry point reachability', () => {
  it('has gate entry points to check', () => {
    expect(gateEntryPoints.length).toBeGreaterThan(20);
  });

  it.each(gateEntryPoints)('%s is invoked by something, or is a declared manual tool', (name) => {
    const reason = MANUAL_ENTRY_POINTS.get(name);
    if (reason === undefined) {
      expect(
        isInvoked(name),
        `${name} is never invoked — wire it into a gate or declare it manual`,
      ).toBe(true);
      return;
    }
    // Declared manual, so it must stay manual: once something invokes it the
    // reason above is stale and the entry belongs out of this list.
    expect(isInvoked(name), `${name} is now invoked, so its manual-tool reason is stale`).toBe(
      false,
    );
    expect(reason.length).toBeGreaterThan(30);
  });

  it('carries no allowlist entry for a script that no longer exists', () => {
    const stale = [...MANUAL_ENTRY_POINTS.keys()].filter((name) => !(name in scripts));
    expect(stale).toEqual([]);
  });
});
