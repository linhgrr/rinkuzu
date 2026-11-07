import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { evaluateRouteBudgets } from '../../scripts/check-perf-budget.mjs';

const temporaryRoots: string[] = [];

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Missing required test fixture value: ${label}`);
  }
  return value;
};

const makeRouteFixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-policy-test-'));
  temporaryRoots.push(root);
  const chunkPath = path.join(root, '.next', 'static', 'chunks', 'route.js');
  fs.mkdirSync(path.dirname(chunkPath), { recursive: true });
  fs.writeFileSync(chunkPath, crypto.randomBytes(300 * 1024));
  const statsPath = path.join(root, '.next', 'diagnostics', 'route-bundle-stats.json');
  fs.mkdirSync(path.dirname(statsPath), { recursive: true });
  fs.writeFileSync(
    statsPath,
    JSON.stringify([
      {
        route: '/route',
        firstLoadChunkPaths: [path.relative(root, chunkPath)],
      },
    ]),
  );
  return { root, chunkPath };
};

const sizeConfig = {
  schemaVersion: 2,
  metric: 'route-first-load-js-gzip',
  source: '.next/diagnostics/route-bundle-stats.json',
  routeGroups: [{ name: 'quality-policy', limit: '128 KiB', patterns: ['^/route$'] }],
  regression: { maxIncrease: '20 KiB', maxPercent: 10, routeOverrides: {} },
};

const baselineReport = (sizeBytes: number) => ({
  schemaVersion: 2,
  buildDigest: 'a'.repeat(64),
  commitSha: 'base-sha',
  entries: [{ name: '/route', sizeBytes }],
});

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('production performance policy', () => {
  it('ratchets pre-existing absolute bundle debt without requiring it to reach zero', () => {
    const { root, chunkPath } = makeRouteFixture();
    const currentSize = zlib.gzipSync(fs.readFileSync(chunkPath), { level: 9 }).length;

    const unchangedDebt = evaluateRouteBudgets({
      rootDir: root,
      rawConfig: sizeConfig,
      baselineReport: baselineReport(currentSize),
    });
    const unchangedEntry = required(unchangedDebt.entries[0], 'unchanged debt entry');
    expect(unchangedEntry.absoluteExceeded).toBe(true);
    expect(unchangedEntry.absoluteViolation).toBe(false);
    expect(unchangedDebt.violations).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'bundle-absolute-cap' })]),
    );

    const increasedDebt = evaluateRouteBudgets({
      rootDir: root,
      rawConfig: sizeConfig,
      baselineReport: baselineReport(currentSize - 1),
    });
    const increasedEntry = required(increasedDebt.entries[0], 'increased debt entry');
    expect(increasedEntry.absoluteDebtIncreased).toBe(true);
    expect(increasedEntry.absoluteViolation).toBe(true);
    expect(increasedDebt.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'bundle-absolute-cap',
          baseline: currentSize - 1,
        }),
      ]),
    );
  });

  it('keeps the Lighthouse collection origin aligned with the build-time canonical origin', () => {
    const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
    const lighthouseConfig = fs.readFileSync('lighthouserc.cjs', 'utf8');

    expect(workflow).toContain('NEXT_PUBLIC_SITE_URL: http://127.0.0.1:3000');
    expect(workflow).toContain("LIGHTHOUSE_PORT: '3000'");
    expect(lighthouseConfig).toContain('const baseUrl = `http://127.0.0.1:${port}`');
    expect(lighthouseConfig).toContain(
      'startServerCommand: `npm run start -- --hostname 127.0.0.1 --port ${port}`',
    );
  });
});
