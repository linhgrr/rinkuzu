import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createPerformanceSizeBaseline } from '../scripts/create-performance-size-baseline.mjs';

const temporaryRoots: string[] = [];

const required = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) {
    throw new Error(`Missing required test fixture value: ${label}`);
  }
  return value;
};

const writeFile = (root: string, relativePath: string, contents: string) => {
  const targetPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, contents);
  return targetPath;
};

const createFixture = () => {
  const root = fs.mkdtempSync(path.join(process.cwd(), '.perf-baseline-test-'));
  temporaryRoots.push(root);
  for (const requiredPath of [
    '.next/BUILD_ID',
    '.next/build-manifest.json',
    '.next/routes-manifest.json',
    '.next/prerender-manifest.json',
    '.next/required-server-files.json',
  ]) {
    writeFile(root, requiredPath, requiredPath.endsWith('BUILD_ID') ? 'build-id' : '{}');
  }
  const chunkPath = writeFile(root, '.next/static/chunks/app.js', 'console.log("route")');
  writeFile(root, '.next/server/app.js', 'export default {}');
  writeFile(root, 'public/asset.txt', 'asset');
  writeFile(
    root,
    '.next/diagnostics/route-bundle-stats.json',
    JSON.stringify([
      {
        route: '/route',
        firstLoadChunkPaths: [path.relative(root, chunkPath)],
      },
    ]),
  );
  const configPath = writeFile(
    root,
    '.size-limit.json',
    JSON.stringify({
      schemaVersion: 2,
      metric: 'route-first-load-js-gzip',
      source: '.next/diagnostics/route-bundle-stats.json',
      routeGroups: [{ name: 'fixture', limit: '1 MiB', patterns: ['^/route$'] }],
      regression: { maxIncrease: '8 KiB', maxPercent: 4 },
    }),
  );
  return { root, configPath };
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('performance size baseline writer', () => {
  it('binds route-size evidence to the immutable base commit and build digest', () => {
    const { root, configPath } = createFixture();
    const outputPath = path.join(root, 'evidence', 'route-sizes.json');
    const commitSha = 'a'.repeat(40);

    const report = createPerformanceSizeBaseline({
      rootDir: root,
      configPath,
      outputPath,
      commitSha,
      now: Date.parse('2026-07-15T00:00:00.000Z'),
    });

    expect(report).toMatchObject({
      schemaVersion: 2,
      generatedAt: '2026-07-15T00:00:00.000Z',
      commitSha,
      entries: [{ name: '/route' }],
    });
    expect(report.buildDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(required(report.entries[0], 'route-size baseline entry').sizeBytes).toBeGreaterThan(0);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual(report);
  });

  it('rejects a mutable or malformed base identifier', () => {
    const { root, configPath } = createFixture();
    expect(() =>
      createPerformanceSizeBaseline({
        rootDir: root,
        configPath,
        outputPath: path.join(root, 'evidence.json'),
        commitSha: 'master',
      }),
    ).toThrow(/Git object ID/);
  });
});
