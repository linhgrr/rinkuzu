import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
  evaluateRouteBudgets,
  median,
  parseHumanBytes,
  summarizeLighthouseReports,
  validateLighthouseEvidence,
} from '../scripts/check-perf-budget.mjs';
import {
  computeNextBuildDigest,
  resolveChromePath,
  sha256File,
} from '../scripts/run-lighthouse.mjs';

type WorkflowStep = { run?: string; if?: string };

const temporaryRoots: string[] = [];

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Missing required test fixture value: ${label}`);
  }
  return value;
};

const makeTemporaryRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-test-'));
  temporaryRoots.push(root);
  return root;
};

const writeFile = (root: string, relativePath: string, contents: string | Buffer) => {
  const targetPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
  return targetPath;
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

type RegressionRouteOverride = {
  maxIncrease: string;
  maxPercent: number;
  reason: string;
};

const sizeConfig = (
  patterns = ['^/route$'],
  maxPercent = 10,
  routeOverrides: Record<string, RegressionRouteOverride> = {},
) => ({
  schemaVersion: 2,
  metric: 'route-first-load-js-gzip',
  source: '.next/diagnostics/route-bundle-stats.json',
  routeGroups: [{ name: 'public-auth', limit: '1 MiB', patterns }],
  regression: { maxIncrease: '20 KiB', maxPercent, routeOverrides },
});

const baselineReport = (sizeBytes: number) => ({
  schemaVersion: 2,
  buildDigest: 'a'.repeat(64),
  commitSha: 'base-sha',
  entries: [{ name: '/route', sizeBytes }],
});

const createRouteFixture = (chunkContents: Buffer = crypto.randomBytes(300 * 1024)) => {
  const root = makeTemporaryRoot();
  const chunkPath = writeFile(root, '.next/static/chunks/route.js', chunkContents);
  writeFile(
    root,
    '.next/diagnostics/route-bundle-stats.json',
    JSON.stringify([
      {
        route: '/route',
        firstLoadChunkPaths: [path.relative(root, chunkPath), path.relative(root, chunkPath)],
      },
    ]),
  );
  return { root, chunkPath };
};

const policy = (mode: 'local' | 'pr' | 'release' = 'pr', urls = ['http://127.0.0.1:3000/en']) => ({
  schemaVersion: 1,
  mode,
  expectedRuns: mode === 'release' ? 5 : 3,
  urls,
  publicIndexableUrls: [urls[0]],
  thresholds: {
    lcpMsMax: 2500,
    tbtMsMax: 200,
    clsMax: 0.1,
    accessibilityScoreMin: 1,
    releasePerformanceScoreMin: 0.9,
    releaseBestPracticesScoreMin: 0.95,
    releaseSeoScoreMin: 0.95,
  },
  consoleErrorAllowlist: [],
  networkFailureAllowlist: [],
});

type ReportOverrides = {
  lcpMs?: number;
  tbtMs?: number;
  cls?: number;
  performanceScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  consoleErrors?: object[];
  networkRequests?: object[];
  finalUrl?: string;
  fetchTime?: string;
};

const lighthouseReport = (url: string, overrides: ReportOverrides = {}) => ({
  requestedUrl: url,
  finalUrl: overrides.finalUrl ?? url,
  fetchTime: overrides.fetchTime ?? new Date().toISOString(),
  categories: {
    performance: { score: overrides.performanceScore ?? 0.95 },
    accessibility: { score: overrides.accessibilityScore ?? 1 },
    'best-practices': { score: overrides.bestPracticesScore ?? 1 },
    seo: { score: overrides.seoScore ?? 1 },
  },
  audits: {
    'largest-contentful-paint': { numericValue: overrides.lcpMs ?? 1000 },
    'total-blocking-time': { numericValue: overrides.tbtMs ?? 100 },
    'cumulative-layout-shift': { numericValue: overrides.cls ?? 0.01 },
    'errors-in-console': {
      score: overrides.consoleErrors?.length ? 0 : 1,
      details: { items: overrides.consoleErrors ?? [] },
    },
    'network-requests': {
      score: 1,
      details: {
        items: overrides.networkRequests ?? [
          { url: `${url}/asset.js`, statusCode: 200, finished: true },
        ],
      },
    },
  },
});

const createBuildIdentityFixture = (reportCount = 3, url = 'http://127.0.0.1:3000/en') => {
  const root = makeTemporaryRoot();
  for (const requiredPath of [
    '.next/BUILD_ID',
    '.next/build-manifest.json',
    '.next/routes-manifest.json',
    '.next/prerender-manifest.json',
    '.next/required-server-files.json',
    '.next/diagnostics/route-bundle-stats.json',
  ]) {
    writeFile(root, requiredPath, requiredPath.endsWith('BUILD_ID') ? 'build-id' : '{}');
  }
  writeFile(root, '.next/static/chunks/app.js', 'console.log("app")');
  writeFile(root, '.next/server/app.js', 'export default {}');
  writeFile(root, 'public/asset.txt', 'asset');
  writeFile(root, 'lighthouserc.cjs', 'module.exports = {};\n');

  const outputDir = path.join(root, 'perf', 'lighthouse');
  fs.mkdirSync(outputDir, { recursive: true });
  const now = Date.now();
  const manifest = [];
  const descriptors = [];
  for (let index = 0; index < reportCount; index += 1) {
    const reportPath = writeFile(
      root,
      `perf/lighthouse/report-${index}.json`,
      JSON.stringify(lighthouseReport(url, { fetchTime: new Date(now - 500).toISOString() })),
    );
    manifest.push({ url, jsonPath: reportPath, isRepresentativeRun: index === 1 });
    const stat = fs.statSync(reportPath);
    descriptors.push({
      path: path.relative(root, reportPath).split(path.sep).join('/'),
      sha256: sha256File(reportPath),
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
    });
  }
  const manifestPath = writeFile(root, 'perf/lighthouse/manifest.json', JSON.stringify(manifest));
  const buildDigest = computeNextBuildDigest(root);
  const evidence = {
    schemaVersion: 1,
    mode: 'pr',
    startedAt: new Date(now - 1000).toISOString(),
    finishedAt: new Date(now).toISOString(),
    expectedRuns: 3,
    expectedUrls: [url],
    buildDigestBefore: buildDigest,
    buildDigestAfter: buildDigest,
    configSha256: sha256File(path.join(root, 'lighthouserc.cjs')),
    manifestSha256: sha256File(manifestPath),
    rawReports: descriptors,
    lhciExitCode: 0,
    lhciSignal: null,
    errors: [],
    ok: true,
  };
  const evidencePath = writeFile(root, 'perf/lighthouse/evidence.json', JSON.stringify(evidence));
  return { root, outputDir, now, evidence, evidencePath, manifestPath };
};

describe('production performance budget primitives', () => {
  it('parses binary units and rejects ambiguous decimal units', () => {
    expect(parseHumanBytes('200 KiB')).toBe(200 * 1024);
    expect(parseHumanBytes('1 MiB')).toBe(1024 * 1024);
    expect(() => parseHumanBytes('200 kB')).toThrow(/KiB/);
  });

  it('uses a true median and rejects non-finite evidence', () => {
    expect(median([100, 5000, 100])).toBe(100);
    expect(() => median([100, Number.NaN, 100])).toThrow(/finite/);
  });

  it('deduplicates route chunks and applies regression only when both thresholds are exceeded', () => {
    const { root, chunkPath } = createRouteFixture();
    const currentSize = zlib.gzipSync(fs.readFileSync(chunkPath), { level: 9 }).length;

    const belowPercent = evaluateRouteBudgets({
      rootDir: root,
      rawConfig: sizeConfig(['^/route$'], 10),
      baselineReport: baselineReport(currentSize - 21 * 1024),
    });
    expect(required(belowPercent.entries[0], 'below-percent route entry').chunkCount).toBe(1);
    expect(required(belowPercent.entries[0], 'below-percent route entry').regressionExceeded).toBe(
      false,
    );

    const overBoth = evaluateRouteBudgets({
      rootDir: root,
      rawConfig: sizeConfig(['^/route$'], 1),
      baselineReport: baselineReport(currentSize - 21 * 1024),
    });
    expect(required(overBoth.entries[0], 'over-budget route entry').regressionExceeded).toBe(true);
    expect(overBoth.violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'bundle-regression' })]),
    );
  });

  it('fails closed for missing chunks and ambiguous route classification', () => {
    const { root, chunkPath } = createRouteFixture();
    fs.rmSync(chunkPath);
    expect(() => evaluateRouteBudgets({ rootDir: root, rawConfig: sizeConfig() })).toThrow(
      /chunk is missing/,
    );

    const second = createRouteFixture();
    const overlapping = sizeConfig();
    overlapping.routeGroups.push({ name: 'other-group', limit: '1 MiB', patterns: ['^/route$'] });
    expect(() => evaluateRouteBudgets({ rootDir: second.root, rawConfig: overlapping })).toThrow(
      /exactly one/,
    );
  });

  it('allows only explicit reviewed route regressions and rejects stale exceptions', () => {
    const { root, chunkPath } = createRouteFixture();
    const currentSize = zlib.gzipSync(fs.readFileSync(chunkPath), { level: 9 }).length;
    const reason = 'Reviewed product motion requirement with an absolute cap still enforced.';
    const config = sizeConfig(['^/route$'], 1, {
      '/route': { maxIncrease: '24 KiB', maxPercent: 10, reason },
    });

    const result = evaluateRouteBudgets({
      rootDir: root,
      rawConfig: config,
      baselineReport: baselineReport(currentSize - 21 * 1024),
    });
    const entry = required(result.entries[0], 'route override entry');
    expect(entry.regressionExceeded).toBe(false);
    expect(entry.regressionOverrideReason).toBe(reason);

    const staleConfig = sizeConfig(['^/route$'], 1, {
      '/missing': { maxIncrease: '24 KiB', maxPercent: 10, reason },
    });
    expect(() =>
      evaluateRouteBudgets({
        rootDir: root,
        rawConfig: staleConfig,
        baselineReport: baselineReport(currentSize - 21 * 1024),
      }),
    ).toThrow(/do not match build evidence/);
  });
});

describe('production performance workflow contract', () => {
  it('builds an immutable base and enables release-only assertions outside PR checks', () => {
    const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

    expect(workflow).toContain("github.event_name == 'merge_group') && 'pr' || 'release'");
    expect(workflow).toContain('base_sha="$(git rev-parse "${GITHUB_SHA}^1")"');
    expect(workflow).toContain('npm run perf:size-baseline --');
    expect(workflow).toContain('PERF_BASELINE_SIZE_REPORT: .performance-baseline/route-sizes.json');
    expect(workflow).toContain('PERF_BASE_SHA: ${{ steps.performance-base.outputs.sha }}');
    const productionBuildDownloads = [
      ...workflow.matchAll(
        /uses: actions\/download-artifact@[^\n]+\n\s+with:\n\s+name: next-production-\$\{\{ github\.sha \}\}\n\s+path: ([^\n]+)/g,
      ),
    ];
    // One consumer, not two. The artifact is the bundle that ships, and the
    // performance job is the only one that may measure it. The E2E suite needs
    // the DevTools-detector waiver inlined at build time — without it Playwright
    // is read as an open DevTools panel and every flow dies at its first input
    // — and a shipped bundle must never carry that, so the suite builds its own.
    expect(productionBuildDownloads).toHaveLength(1);
    expect(productionBuildDownloads.map((match) => match[1]?.trim())).toEqual(['.next']);
    expect(workflow).toContain('run: npm run build:e2e');
    expect(workflow).toContain("steps.production_e2e.outcome != 'skipped'");
    expect(workflow).toContain("steps.performance_gate.outcome != 'skipped'");
    expect(workflow).toContain('if-no-files-found: error');
    // Parsed, not counted. A count of the `start` lines only says how many jobs
    // needed a database on the day it was written, so it goes red every time the
    // job topology changes and says nothing about the property that matters:
    // a job that starts the replica set must also stop it, unconditionally, or a
    // failing step strands the container and the next job on that runner inherits
    // a dirty database.
    const jobs = Object.entries(
      (parseYaml(workflow) as { jobs: Record<string, { steps?: WorkflowStep[] }> }).jobs,
    );
    const runsMongo = (step: WorkflowStep, verb: 'start' | 'stop') =>
      step.run?.includes(`bash scripts/ci-mongodb.sh ${verb}`) ?? false;
    const starters = jobs.filter(([, job]) => job.steps?.some((step) => runsMongo(step, 'start')));

    expect(starters.length).toBeGreaterThan(0);
    for (const [name, job] of starters) {
      const stops = (job.steps ?? []).filter((step) => runsMongo(step, 'stop'));
      expect(stops, `${name} starts MongoDB without stopping it`).toHaveLength(1);
      expect(
        required(stops[0], `${name} stop step`).if,
        `${name} leaks MongoDB when a step fails`,
      ).toBe('${{ always() }}');
    }
  });
});

describe('Lighthouse result semantics', () => {
  it('requires exactly three PR runs and finite metrics', () => {
    const url = required(policy().urls[0], 'PR Lighthouse URL');
    expect(() =>
      summarizeLighthouseReports([lighthouseReport(url), lighthouseReport(url)], policy()),
    ).toThrow(/exactly 3/);
    const malformed = [
      lighthouseReport(url),
      lighthouseReport(url, { lcpMs: Number.NaN }),
      lighthouseReport(url),
    ];
    expect(() => summarizeLighthouseReports(malformed, policy())).toThrow(/finite/);
  });

  it('uses medians for timing without allowing network or console failures', () => {
    const url = required(policy().urls[0], 'PR Lighthouse URL');
    const timing = summarizeLighthouseReports(
      [
        lighthouseReport(url, { lcpMs: 1000 }),
        lighthouseReport(url, { lcpMs: 1000 }),
        lighthouseReport(url, { lcpMs: 9000 }),
      ],
      policy(),
    );
    expect(required(timing.summaries[0], 'Lighthouse timing summary').lcpMs).toBe(1000);
    expect(timing.violations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'lighthouse-lcp' })]),
    );

    const dirty = summarizeLighthouseReports(
      [
        lighthouseReport(url),
        lighthouseReport(url, {
          consoleErrors: [{ source: 'console-api', description: 'boom' }],
          networkRequests: [{ url: `${url}/missing.js`, statusCode: 404, finished: true }],
        }),
        lighthouseReport(url),
      ],
      policy(),
    );
    expect(dirty.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'lighthouse-console-error' }),
        expect.objectContaining({ code: 'lighthouse-network-failure' }),
      ]),
    );
  });

  it('applies release SEO only to public indexable URLs', () => {
    const urls = ['http://127.0.0.1:3000/en', 'http://127.0.0.1:3000/en/login'];
    const reports = urls.flatMap((url, urlIndex) =>
      Array.from({ length: 5 }, () =>
        lighthouseReport(url, { seoScore: urlIndex === 0 ? 0.9 : 0.5 }),
      ),
    );
    const result = summarizeLighthouseReports(reports, policy('release', urls));
    expect(
      result.violations.filter(
        (violation: { code: string }) => violation.code === 'lighthouse-seo',
      ),
    ).toHaveLength(1);
  });
});

describe('Lighthouse evidence integrity', () => {
  it('accepts only ephemeral loopback origins while preserving the exact route policy', () => {
    const ephemeral = createBuildIdentityFixture(3, 'http://127.0.0.1:45678/en');
    expect(
      validateLighthouseEvidence({
        rootDir: ephemeral.root,
        lighthouseOutputDir: ephemeral.outputDir,
        rawPolicy: policy(),
        now: ephemeral.now,
      }).policy.urls,
    ).toEqual(['http://127.0.0.1:45678/en']);

    const wrongHost = createBuildIdentityFixture(3, 'http://localhost:45678/en');
    expect(() =>
      validateLighthouseEvidence({
        rootDir: wrongHost.root,
        lighthouseOutputDir: wrongHost.outputDir,
        rawPolicy: policy(),
        now: wrongHost.now,
      }),
    ).toThrow(/127\.0\.0\.1/);

    const wrongRoute = createBuildIdentityFixture(3, 'http://127.0.0.1:45678/en/login');
    expect(() =>
      validateLighthouseEvidence({
        rootDir: wrongRoute.root,
        lighthouseOutputDir: wrongRoute.outputDir,
        rawPolicy: policy(),
        now: wrongRoute.now,
      }),
    ).toThrow(/routes do not match/);
  });

  it('accepts complete fresh evidence and rejects partial manifests', () => {
    const fixture = createBuildIdentityFixture();
    expect(
      validateLighthouseEvidence({
        rootDir: fixture.root,
        lighthouseOutputDir: fixture.outputDir,
        rawPolicy: policy(),
        now: fixture.now,
      }).reports,
    ).toHaveLength(3);

    const assertionFailure = createBuildIdentityFixture();
    fs.writeFileSync(
      assertionFailure.evidencePath,
      JSON.stringify({ ...assertionFailure.evidence, lhciExitCode: 1 }),
    );
    expect(
      validateLighthouseEvidence({
        rootDir: assertionFailure.root,
        lighthouseOutputDir: assertionFailure.outputDir,
        rawPolicy: policy(),
        now: assertionFailure.now,
      }).assertionsPassed,
    ).toBe(false);

    const partial = createBuildIdentityFixture(2);
    expect(() =>
      validateLighthouseEvidence({
        rootDir: partial.root,
        lighthouseOutputDir: partial.outputDir,
        rawPolicy: policy(),
        now: partial.now,
      }),
    ).toThrow(/exactly 3/);
  });

  it('rejects malformed, stale, and build-digest-mismatched evidence', () => {
    const malformed = createBuildIdentityFixture();
    fs.writeFileSync(malformed.manifestPath, '{');
    expect(() =>
      validateLighthouseEvidence({
        rootDir: malformed.root,
        lighthouseOutputDir: malformed.outputDir,
        rawPolicy: policy(),
        now: malformed.now,
      }),
    ).toThrow(/malformed/);

    const stale = createBuildIdentityFixture();
    const staleEvidence = {
      ...stale.evidence,
      startedAt: new Date(stale.now - 3_700_000).toISOString(),
      finishedAt: new Date(stale.now - 3_600_000).toISOString(),
    };
    fs.writeFileSync(stale.evidencePath, JSON.stringify(staleEvidence));
    expect(() =>
      validateLighthouseEvidence({
        rootDir: stale.root,
        lighthouseOutputDir: stale.outputDir,
        rawPolicy: policy(),
        now: stale.now,
      }),
    ).toThrow(/stale/);

    const mismatch = createBuildIdentityFixture();
    const mismatchedEvidence = { ...mismatch.evidence, buildDigestAfter: 'b'.repeat(64) };
    fs.writeFileSync(mismatch.evidencePath, JSON.stringify(mismatchedEvidence));
    expect(() =>
      validateLighthouseEvidence({
        rootDir: mismatch.root,
        lighthouseOutputDir: mismatch.outputDir,
        rawPolicy: policy(),
        now: mismatch.now,
      }),
    ).toThrow(/changed during the run/);
  });
});

describe('resolveChromePath', () => {
  it('keeps an explicit CHROME_PATH', () => {
    expect(
      resolveChromePath(
        { CHROME_PATH: '/x/chrome' },
        () => '/pw/chrome',
        () => true,
      ),
    ).toBe('/x/chrome');
  });

  it('falls back to the Playwright Chromium when it exists', () => {
    expect(
      resolveChromePath(
        {},
        () => '/pw/chrome',
        () => true,
      ),
    ).toBe('/pw/chrome');
  });

  it('returns undefined when the binary is missing or Playwright cannot resolve', () => {
    expect(
      resolveChromePath(
        {},
        () => '/pw/chrome',
        () => false,
      ),
    ).toBeUndefined();
    expect(
      resolveChromePath(
        {},
        () => {
          throw new Error('no playwright');
        },
        () => true,
      ),
    ).toBeUndefined();
  });
});
