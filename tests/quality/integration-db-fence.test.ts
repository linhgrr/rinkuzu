import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertIsolatedTestDatabase } from '../setup/integration-db';

/**
 * The integration suite creates orders, takes leases, revokes entitlements and
 * deletes what it made. Pointed once at a production URI it is unrecoverable,
 * so the fence is three independent checks and every one of them has to hold.
 *
 * Each check exists because one of the others can be passed by something that
 * is not a local test database: a local proxy to a managed cluster is on
 * loopback, a staging database on localhost has the plain scheme, and a
 * production database can perfectly well be reached at a name containing
 * "test". The tests below are the record of that reasoning.
 */
const SAFE = 'mongodb://127.0.0.1:27017/rinkuzu-test';

describe('the integration database fence', () => {
  it('admits a local replica set whose database is named as a test one', () => {
    expect(assertIsolatedTestDatabase(SAFE)).toBe('rinkuzu-test');
    expect(assertIsolatedTestDatabase('mongodb://localhost:27017/ci_billing')).toBe('ci_billing');
    expect(
      assertIsolatedTestDatabase('mongodb://127.0.0.1:27017,127.0.0.1:27018/rinkuzu-test?rs=rs0'),
    ).toBe('rinkuzu-test');
  });

  it('refuses a managed-cluster scheme even on a loopback host', () => {
    // `mongodb+srv://` is what a hosted cluster hands out. A local resolver can
    // still answer for it, so the host check alone would let it through.
    expect(() => assertIsolatedTestDatabase('mongodb+srv://127.0.0.1/rinkuzu-test')).toThrow(
      /not a local MongoDB connection/,
    );
  });

  it('refuses a remote host even under the plain scheme', () => {
    expect(() =>
      assertIsolatedTestDatabase('mongodb://db.internal.example:27017/rinkuzu-test'),
    ).toThrow(/not loopback/);
  });

  it('refuses a replica-set list where any member is remote', () => {
    // The host list arrives as one string, so checking only the first member
    // would admit a set whose secondaries are somewhere else entirely.
    expect(() =>
      assertIsolatedTestDatabase('mongodb://127.0.0.1:27017,db.example:27017/rinkuzu-test'),
    ).toThrow(/host "db.example" is not loopback/);
  });

  it('refuses a database whose name does not say it is a test database', () => {
    expect(() => assertIsolatedTestDatabase('mongodb://127.0.0.1:27017/rinkuzu')).toThrow(
      /is not named as a test database/,
    );
    expect(() => assertIsolatedTestDatabase('mongodb://127.0.0.1:27017/')).toThrow(/<empty>/);
    // "latest" contains "test" as a substring and is not a test database.
    expect(() => assertIsolatedTestDatabase('mongodb://127.0.0.1:27017/latest')).toThrow(
      /is not named as a test database/,
    );
  });

  it('refuses a missing or unparseable URI rather than defaulting to anything', () => {
    expect(() => assertIsolatedTestDatabase(undefined)).toThrow(/MONGODB_URI is not set/);
    expect(() => assertIsolatedTestDatabase('not a uri')).toThrow(/not a URL/);
  });

  it('throws rather than skipping, so a suite can never be green having run nothing', () => {
    // A silent skip is the failure mode this guard exists to avoid: the run
    // goes green, the regressions it was meant to catch ship, and nobody
    // notices for months.
    expect(() => assertIsolatedTestDatabase('mongodb://127.0.0.1:27017/rinkuzu')).toThrow(Error);
  });
});

describe('how the fence is wired in', () => {
  const config = readFileSync(join(process.cwd(), 'vitest.integration.config.ts'), 'utf8');

  it('runs as a setup file, before any suite can connect', () => {
    expect(config).toContain('tests/setup/integration-db.ts');
    const setupIndex = config.indexOf('tests/setup/integration-db.ts');
    const includeIndex = config.indexOf('tests/integration/**');
    expect(setupIndex).toBeGreaterThan(-1);
    expect(includeIndex).toBeGreaterThan(-1);
  });

  it('bounds every hook and test, so a stalled lease fails instead of hanging CI', () => {
    expect(config).toMatch(/testTimeout:\s*30_000/);
    expect(config).toMatch(/hookTimeout:\s*30_000/);
    expect(config).toMatch(/teardownTimeout:\s*15_000/);
  });

  it('refuses to pass with no tests, so a bad glob is a failure not a green run', () => {
    expect(config).toMatch(/passWithNoTests:\s*false/);
  });
});

describe('the gates that have to run the integration suite', () => {
  const scripts = (
    JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    }
  ).scripts;

  it('runs it in the pre-push gate and in the full verification gate', () => {
    // A suite nothing runs is a suite that rots. These two are the gates that
    // stand between a change and a deploy.
    expect(scripts['prepush:full']).toContain('test:integration');
    expect(scripts['verify:full']).toContain('test:integration');
  });

  it('points the suite at its own config rather than the default project', () => {
    expect(scripts['test:integration']).toBe('vitest run --config vitest.integration.config.ts');
  });
});
