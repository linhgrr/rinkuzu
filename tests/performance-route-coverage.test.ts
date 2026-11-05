import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { evaluateRouteBudgets } from '../scripts/check-perf-budget.mjs';

/**
 * RIN-986: `perf:size-baseline` and the nightly performance gate require every
 * built route to match exactly one `routeGroups` entry in `.size-limit.json`.
 * PR CI does not run that gate, so a new `page.tsx` without a budget group used
 * to surface only at the nightly. This test derives every app route from the
 * source tree and runs it through the gate's own matcher (`evaluateRouteBudgets`).
 */

const repoRoot = process.cwd();
const appDir = path.join(repoRoot, 'src', 'app');
const sizeConfig: unknown = JSON.parse(
  fs.readFileSync(path.join(repoRoot, '.size-limit.json'), 'utf8'),
);
const statsSource = '.next/diagnostics/route-bundle-stats.json';
const chunkSource = '.next/static/chunks/route.js';
const groupMismatch = /must match exactly one budget group; matched .+$/;

// Next.js emits this route for its built-in not-found page; it has no page.tsx.
const BUILT_IN_ROUTES = ['/_not-found'];

/** `src/app/[locale]/(app)/start/page.tsx` -> `/[locale]/start` (route groups and slots dropped). */
const toRouteId = (pageFile: string) => {
  const segments = path
    .relative(appDir, path.dirname(pageFile))
    .split(path.sep)
    .filter((segment) => segment !== '' && !/^\(.*\)$/.test(segment) && !segment.startsWith('@'));
  return `/${segments.join('/')}`;
};

const listAppRoutes = () => {
  const pages = fs
    .readdirSync(appDir, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /^page\.(?:tsx|ts|jsx|js|mdx)$/.test(path.basename(entry)))
    .map((entry) => toRouteId(path.join(appDir, entry)));
  return [...new Set([...pages, ...BUILT_IN_ROUTES])].sort();
};

let fixtureRoot = '';

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(repoRoot, '.perf-route-coverage-test-'));
  const chunkPath = path.join(fixtureRoot, chunkSource);
  fs.mkdirSync(path.dirname(chunkPath), { recursive: true });
  fs.writeFileSync(chunkPath, 'console.log("route")');
  fs.mkdirSync(path.dirname(path.join(fixtureRoot, statsSource)), { recursive: true });
});

afterAll(() => {
  if (fixtureRoot) {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

type SizeConfig = {
  routeGroups: Array<{ name: string; patterns: string[] }>;
  regression: { routeOverrides?: Record<string, unknown> };
};

const cloneSizeConfig = () => structuredClone(sizeConfig) as SizeConfig;

/**
 * Runs each route through the gate matcher, one route per stats file, and returns one
 * message per route that matches 0 or 2+ groups. Per-route regression overrides are
 * dropped: they do not affect group matching, and the gate rejects an override whose
 * route is missing from the stats file.
 */
const findGroupMismatches = (routes: string[], config: SizeConfig) => {
  const rawConfig = { ...config, regression: { ...config.regression, routeOverrides: {} } };
  return routes.flatMap((route) => {
    fs.writeFileSync(
      path.join(fixtureRoot, statsSource),
      JSON.stringify([{ route, firstLoadChunkPaths: [chunkSource] }]),
    );
    try {
      evaluateRouteBudgets({ rootDir: fixtureRoot, rawConfig });
      return [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!groupMismatch.test(message)) {
        throw error;
      }
      return [message];
    }
  });
};

const withoutPatternToken = (token: string) => {
  const config = cloneSizeConfig();
  for (const group of config.routeGroups) {
    group.patterns = group.patterns.map((pattern) => pattern.replace(`|${token}`, ''));
  }
  return config;
};

describe('.size-limit.json route coverage', () => {
  const routes = listAppRoutes();

  it('derives route ids the way the Next.js build reports them', () => {
    expect(routes).toContain('/[locale]');
    expect(routes).toContain('/[locale]/start');
    expect(routes).toContain('/[locale]/unsubscribe');
    expect(routes).toContain('/[locale]/quiz/[slug]/result');
    expect(routes.some((route) => route.includes('('))).toBe(false);
  });

  it('assigns every app route to exactly one budget group', () => {
    expect(findGroupMismatches(routes, cloneSizeConfig())).toEqual([]);
  });

  it('reports a page that no budget group matches', () => {
    expect(findGroupMismatches(routes, withoutPatternToken('start'))).toEqual([
      'Route /[locale]/start must match exactly one budget group; matched none',
    ]);
  });

  it('reports a page that two budget groups match', () => {
    const config = cloneSizeConfig();
    config.routeGroups[0]?.patterns.push('^/\\[locale\\]/login$');
    expect(findGroupMismatches(['/[locale]/login'], config)).toEqual([
      'Route /[locale]/login must match exactly one budget group; matched marketing-static, auth-entry',
    ]);
  });
});
