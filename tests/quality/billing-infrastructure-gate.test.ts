import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const SCRIPT = path.join(process.cwd(), 'scripts', 'validate-billing-infrastructure.mjs');
const LONG_SECRET = 'a-secret-that-is-at-least-thirty-two-chars';
const QUOTE_KEYS = JSON.stringify([{ kid: 'v1', secret: LONG_SECRET }]);

/**
 * Run in a directory with no `.env`, so the verdict depends on the variables
 * the case sets and not on whatever the developer happens to have configured.
 * The script loads `dotenv/config`, which reads the working directory.
 */
const sandbox = mkdtempSync(path.join(tmpdir(), 'rinkuzu-billing-gate-'));

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

interface GateResult {
  ok: boolean;
  output: string;
}

function runGate(env: Record<string, string>): GateResult {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: sandbox,
    encoding: 'utf8',
    // A bounded run: this gate is part of `vercel-build`, and one that can hang
    // is one that takes the deploy with it.
    timeout: 30_000,
    // Only what the case declares, plus the two variables Node itself needs to
    // start on either platform. Inheriting the parent environment would make
    // the verdict depend on whoever ran the suite.
    env: {
      ...env,
      PATH: process.env['PATH'] ?? '',
      SystemRoot: process.env['SystemRoot'] ?? '',
      NODE_ENV: env['NODE_ENV'] === 'production' ? 'production' : 'test',
    },
  });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** Everything a live payments deployment needs, before a case breaks one thing. */
function liveEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    PAYOS_CREATE_ENABLED: 'true',
    ENTITLEMENT_AUTO_ACTIVATION_ENABLED: 'true',
    EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED: 'true',
    PAYOS_CLIENT_ID: 'client-id',
    PAYOS_API_KEY: 'api-key',
    PAYOS_CHECKSUM_KEY: 'a-payos-checksum-key-copied-verbatim',
    BILLING_QUOTE_SIGNING_KEYS: QUOTE_KEYS,
    BILLING_INTERNAL_HMAC_SECRET: LONG_SECRET,
    BILLING_TERMS_VERSION: '2026-07-23',
    ABUSE_SIGNAL_HASH_SECRET: LONG_SECRET,
    // Somewhere to send an alert. A live deployment that takes money with no
    // way to report that fulfilment stopped is one of the configurations this
    // gate exists to refuse.
    BILLING_ALERT_EMAIL: 'ops@rinkuzu.app',
    MAIL_FROM: 'no-reply@rinkuzu.app',
    AUTH_URL: 'https://rinkuzu.app',
    ...overrides,
  };
}

/**
 * This gate is the only thing standing between a deploy and the two
 * configurations that lose money silently: taking payments without being able
 * to grant Premium, and accepting webhook traffic with no per-source ceiling.
 * It runs inside `vercel-build`, so what it refuses is what cannot ship.
 */
describe('a live payments configuration', () => {
  it('passes when every required variable is present', () => {
    const result = runGate(liveEnv());
    expect(result.output).toContain('payments are enabled');
    expect(result.ok).toBe(true);
  });

  it('refuses to collect money it cannot turn into Premium', () => {
    // The failure the whole script exists to prevent.
    const result = runGate(liveEnv({ ENTITLEMENT_AUTO_ACTIVATION_ENABLED: 'false' }));
    expect(result.ok).toBe(false);
    expect(result.output).toContain('ENTITLEMENT_AUTO_ACTIVATION_ENABLED');
  });

  it('refuses a deployment that has not stated its clawback policy', () => {
    const env = liveEnv();
    delete env['EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED'];
    const result = runGate(env);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('EXTERNAL_REFUND_AUTO_REVOCATION_ENABLED');
  });

  it('refuses to take money with nowhere to report that fulfilment stopped', () => {
    // The alerts are raised and queued either way, so nothing is lost — but a
    // queue nobody is subscribed to is how a paid-but-unfulfilled order sits
    // unnoticed for as long as it takes someone to open the admin page.
    const env = liveEnv();
    delete env['BILLING_ALERT_EMAIL'];
    const result = runGate(env);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('BILLING_ALERT_EMAIL');
  });

  it('refuses a deployment with an alert recipient but no sender', () => {
    const env = liveEnv();
    delete env['MAIL_FROM'];
    const result = runGate(env);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('MAIL_FROM');
  });
});

describe('the single PayOS checksum key', () => {
  it('requires it wherever payments are enabled', () => {
    const env = liveEnv();
    delete env['PAYOS_CHECKSUM_KEY'];
    const result = runGate(env);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('PAYOS_CHECKSUM_KEY is not set');
  });

  it('refuses a key short enough to have been truncated on the way in', () => {
    const result = runGate(liveEnv({ PAYOS_CHECKSUM_KEY: 'too-short' }));
    expect(result.ok).toBe(false);
    expect(result.output).toContain('shorter than 16 characters');
  });

  it('refuses a leftover rotation list outright', () => {
    // PayOS issues one key per merchant with no overlap window. A list here is
    // a second place for the two sides to disagree, and a stale one reads as
    // the key in force when it is not.
    const result = runGate(
      liveEnv({ PAYOS_CHECKSUM_KEYS: JSON.stringify([{ kid: 'v1', secret: LONG_SECRET }]) }),
    );
    expect(result.ok).toBe(false);
    expect(result.output).toContain('PAYOS_CHECKSUM_KEYS is set but no longer read');
  });

  it('refuses key material shared with the payload encryption list', () => {
    const shared = 'a-payos-checksum-key-copied-verbatim';
    const result = runGate(
      liveEnv({
        BILLING_WEBHOOK_PAYLOAD_KEYS: JSON.stringify([
          { kid: 'v1', secret: shared },
          { kid: 'v0', secret: LONG_SECRET },
        ]),
      }),
    );
    expect(result.ok).toBe(false);
    // A leaked payload key would otherwise also forge webhooks.
    expect(result.output).toContain('separate key material');
  });
});

describe('the abuse signal secret', () => {
  it('is required wherever live payment traffic is accepted', () => {
    // Without it the webhook door has no per-source budget and no payer signal,
    // and both used to fail silently to "off".
    const env = liveEnv();
    delete env['ABUSE_SIGNAL_HASH_SECRET'];
    const result = runGate(env);
    expect(result.ok).toBe(false);
    expect(result.output).toContain('ABUSE_SIGNAL_HASH_SECRET');
  });

  it('refuses one too short to key a hash with', () => {
    const result = runGate(liveEnv({ ABUSE_SIGNAL_HASH_SECRET: 'short' }));
    expect(result.ok).toBe(false);
    expect(result.output).toContain('ABUSE_SIGNAL_HASH_SECRET');
  });

  it('is only a warning while payments are off, so preview deploys still build', () => {
    const result = runGate({ PAYOS_CREATE_ENABLED: 'false' });
    expect(result.ok).toBe(true);
    expect(result.output).toContain('warning');
    expect(result.output).toContain('ABUSE_SIGNAL_HASH_SECRET');
  });
});

describe('environment isolation', () => {
  it('refuses a production deploy pointed at a database named as non-production', () => {
    const result = runGate(
      liveEnv({
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/rinkuzu-test',
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.output).toContain('Refusing to treat this as a live configuration');
  });

  it('warns about an IP allowlist the scheduler cannot satisfy', () => {
    // Cloudflare's egress address is not stable, so a non-empty list 403s every
    // cron tick and the drains simply stop running.
    const result = runGate(liveEnv({ BILLING_INTERNAL_ALLOWED_IPS: '203.0.113.5' }));
    expect(result.ok).toBe(true);
    expect(result.output).toContain('BILLING_INTERNAL_ALLOWED_IPS');
  });
});

describe('what it reports about secrets', () => {
  it('never prints key material, only shape and presence', () => {
    const result = runGate(
      liveEnv({
        PAYOS_CHECKSUM_KEYS: JSON.stringify([{ kid: 'v1', secret: LONG_SECRET }]),
        BILLING_WEBHOOK_PAYLOAD_KEYS: JSON.stringify([{ kid: 'v1', secret: LONG_SECRET }]),
      }),
    );
    expect(result.output).not.toContain(LONG_SECRET);
    expect(result.output).not.toContain('a-payos-checksum-key-copied-verbatim');
  });
});
