import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { checkRouteSizeCaps } from '../scripts/check-route-size-caps.mjs';

const roots: string[] = [];

const makeRoot = (chunkBytes: number) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'route-caps-test-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, '.next/static/chunks'), { recursive: true });
  fs.mkdirSync(path.join(root, '.next/diagnostics'), { recursive: true });
  // Random bytes do not compress, so gzip size is about the raw size.
  fs.writeFileSync(path.join(root, '.next/static/chunks/a.js'), crypto.randomBytes(chunkBytes));
  fs.writeFileSync(
    path.join(root, '.next/diagnostics/route-bundle-stats.json'),
    JSON.stringify([
      { route: '/[locale]/about', firstLoadChunkPaths: ['.next/static/chunks/a.js'] },
    ]),
  );
  fs.writeFileSync(
    path.join(root, '.size-limit.json'),
    JSON.stringify({
      schemaVersion: 2,
      metric: 'route-first-load-js-gzip',
      source: '.next/diagnostics/route-bundle-stats.json',
      routeGroups: [{ name: 'marketing', limit: '1 KiB', patterns: ['^/.locale./about$'] }],
      regression: { maxIncrease: '1 KiB', maxPercent: 1 },
    }),
  );
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('checkRouteSizeCaps', () => {
  it('passes a route under its absolute cap', () => {
    expect(checkRouteSizeCaps(makeRoot(512)).violations).toEqual([]);
  });

  it('fails a route over its absolute cap, without any baseline', () => {
    const { violations } = checkRouteSizeCaps(makeRoot(4096));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ code: 'bundle-absolute-cap', route: '/[locale]/about' });
  });
});
