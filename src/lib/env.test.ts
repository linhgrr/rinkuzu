import { afterEach, describe, expect, it, vi } from 'vitest';

// Non-secret CI/test fixture; must match vitest/CI/e2e/perf/Docker fallbacks.
const VALID_INTERNAL_SERVICE_TOKEN = 'rinkuzu-ci-fixture-0123456789abcdef-token';
const VALID_CRON_SECRET = 'valid-subscription-cron-secret-32';

const baseEnv: Record<string, string> = {
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/rinkuzu-test',
  AUTH_SECRET: 'test-auth-secret-at-least-32-characters',
  AUTH_URL: 'http://localhost:3000',
  AUTH_TRUST_HOST: 'true',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8000',
  SESSION_MAX_AGE_SECONDS: '28800',
  SESSION_UPDATE_AGE_SECONDS: '3600',
  AUTH_LOCKOUT_MAX_ATTEMPTS: '5',
  AUTH_LOCKOUT_WINDOW_MINUTES: '15',
  AUTH_LOCKOUT_DURATION_MINUTES: '15',
  ADAPTIVE_PROXY_TIMEOUT_MS: '60000',
  INTERNAL_SERVICE_TOKEN: VALID_INTERNAL_SERVICE_TOKEN,
  OBJECT_STORAGE_ENDPOINT_EXTERNAL: 'https://example.r2.cloudflarestorage.com',
  OBJECT_STORAGE_REGION: 'auto',
  OBJECT_STORAGE_ADDRESSING_STYLE: 'path',
  OBJECT_STORAGE_ACCESS_KEY: 'test-access-key',
  OBJECT_STORAGE_SECRET_KEY: 'test-secret-key',
  OBJECT_STORAGE_BUCKET: 'test-bucket',
  MAIL_FROM: 'noreply@example.com',
  RESEND_API_KEY: 're_test_key',
  PAYOS_CLIENT_ID: 'test-payos-client-id',
  PAYOS_API_KEY: 'test-payos-api-key',
  PAYOS_CHECKSUM_KEY: 'test-payos-checksum-key',
};

const originalEnv = { ...process.env };

function replaceProcessEnv(nextEnv: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  for (const [key, value] of Object.entries(nextEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  replaceProcessEnv(originalEnv);
  vi.resetModules();
});

describe('env validation', () => {
  it('loads valid server env', async () => {
    replaceProcessEnv(baseEnv);

    const { env } = await import('@/lib/env');

    expect(env.OBJECT_STORAGE_REGION).toBe('auto');
    expect(env.AUTH_URL).toBe('http://localhost:3000');
    expect(env.AUTH_SECRET).toBe('test-auth-secret-at-least-32-characters');
    expect(env.INTERNAL_SERVICE_TOKEN).toBe(VALID_INTERNAL_SERVICE_TOKEN);
    expect(env.SUBSCRIPTION_CRON_SECRET).toBeUndefined();
  });

  it('rejects invalid object storage regions', async () => {
    replaceProcessEnv({ ...baseEnv, OBJECT_STORAGE_REGION: 'ap-southeast-1' });

    await expect(import('@/lib/env')).rejects.toThrow(/OBJECT_STORAGE_REGION must be one of/);
  });

  it('rejects partially configured Google OAuth env', async () => {
    replaceProcessEnv({ ...baseEnv, AUTH_GOOGLE_ID: 'google-client-id' });

    await expect(import('@/lib/env')).rejects.toThrow(
      /AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET must both be set, or both omitted/,
    );
  });

  it.each(['mongodb://127.0.0.1:27017', 'mongodb://127.0.0.1:27017/test'])(
    'rejects production MongoDB URI without an explicit application database: %s',
    async (mongodbUri) => {
      replaceProcessEnv({ ...baseEnv, NODE_ENV: 'production', MONGODB_URI: mongodbUri });

      await expect(import('@/lib/env')).rejects.toThrow(
        /Production MONGODB_URI must select an explicit non-test database/,
      );
    },
  );

  it('accepts an explicit production MongoDB database', async () => {
    replaceProcessEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://user:password@example.mongodb.net/rinkuzu?retryWrites=true',
    });

    const { env } = await import('@/lib/env');
    expect(env.MONGODB_URI).toContain('/rinkuzu?');
  });

  it.each([undefined, 'false'])(
    'rejects production without explicit trusted-host configuration: %s',
    async (authTrustHost) => {
      replaceProcessEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/rinkuzu',
        AUTH_TRUST_HOST: authTrustHost,
      });

      await expect(import('@/lib/env')).rejects.toThrow(
        /AUTH_TRUST_HOST must be true in production/,
      );
    },
  );

  it.each(['preview', 'development'])(
    'accepts a Vercel %s build with a test database and no trusted-host flag',
    async (vercelEnv) => {
      replaceProcessEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        VERCEL_ENV: vercelEnv,
        MONGODB_URI: 'mongodb+srv://user:password@example.mongodb.net/test?retryWrites=true',
        AUTH_TRUST_HOST: undefined,
      });

      const { env } = await import('@/lib/env');
      expect(env.VERCEL_ENV).toBe(vercelEnv);
      expect(env.AUTH_TRUST_HOST).toBe('false');
    },
  );

  it('accepts a Vercel preview build without AUTH_URL', async () => {
    replaceProcessEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      AUTH_URL: undefined,
    });

    const { env } = await import('@/lib/env');
    expect(env.AUTH_URL).toBeUndefined();
  });

  it.each([
    ['local', {}],
    ['Vercel production', { NODE_ENV: 'production', VERCEL_ENV: 'production' }],
  ])('requires AUTH_URL for a %s build', async (_label, overrides) => {
    replaceProcessEnv({
      ...baseEnv,
      MONGODB_URI: 'mongodb://127.0.0.1:27017/rinkuzu',
      ...overrides,
      AUTH_URL: undefined,
    });

    await expect(import('@/lib/env')).rejects.toThrow(/AUTH_URL is required/);
  });

  it('rejects a Vercel production build that selects the test database', async () => {
    replaceProcessEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
    });

    await expect(import('@/lib/env')).rejects.toThrow(
      /Production MONGODB_URI must select an explicit non-test database/,
    );
  });

  it.each([undefined, 'false'])(
    'rejects a Vercel production build without trusted-host configuration: %s',
    async (authTrustHost) => {
      replaceProcessEnv({
        ...baseEnv,
        NODE_ENV: 'production',
        VERCEL_ENV: 'production',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/rinkuzu',
        AUTH_TRUST_HOST: authTrustHost,
      });

      await expect(import('@/lib/env')).rejects.toThrow(
        /AUTH_TRUST_HOST must be true in production/,
      );
    },
  );

  it('keeps production checks for an unknown VERCEL_ENV value', async () => {
    replaceProcessEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      VERCEL_ENV: 'staging',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
    });

    await expect(import('@/lib/env')).rejects.toThrow(
      /Production MONGODB_URI must select an explicit non-test database/,
    );
  });
});

describe('INTERNAL_SERVICE_TOKEN validation', () => {
  it('rejects missing INTERNAL_SERVICE_TOKEN', async () => {
    const { INTERNAL_SERVICE_TOKEN: _removed, ...withoutToken } = baseEnv;
    void _removed;
    replaceProcessEnv(withoutToken);

    await expect(import('@/lib/env')).rejects.toThrow(/INTERNAL_SERVICE_TOKEN/);
  });

  it('rejects blank or whitespace-only INTERNAL_SERVICE_TOKEN', async () => {
    replaceProcessEnv({ ...baseEnv, INTERNAL_SERVICE_TOKEN: '   ' });

    await expect(import('@/lib/env')).rejects.toThrow(/INTERNAL_SERVICE_TOKEN/);
  });

  it('rejects short INTERNAL_SERVICE_TOKEN', async () => {
    replaceProcessEnv({ ...baseEnv, INTERNAL_SERVICE_TOKEN: 'too-short-token' });

    await expect(import('@/lib/env')).rejects.toThrow(
      /INTERNAL_SERVICE_TOKEN must be at least 32 chars/,
    );
  });

  it('rejects long obvious placeholder INTERNAL_SERVICE_TOKEN', async () => {
    replaceProcessEnv({
      ...baseEnv,
      INTERNAL_SERVICE_TOKEN: 'replace-me-replace-me-replace-me-xx',
    });

    await expect(import('@/lib/env')).rejects.toThrow(
      /INTERNAL_SERVICE_TOKEN must not use a placeholder or default value/,
    );
  });

  it('accepts a trimmed valid INTERNAL_SERVICE_TOKEN', async () => {
    replaceProcessEnv({
      ...baseEnv,
      INTERNAL_SERVICE_TOKEN: `  ${VALID_INTERNAL_SERVICE_TOKEN}  `,
    });

    const { env } = await import('@/lib/env');
    expect(env.INTERNAL_SERVICE_TOKEN).toBe(VALID_INTERNAL_SERVICE_TOKEN);
  });
});

describe('SUBSCRIPTION_CRON_SECRET validation', () => {
  it('allows absent SUBSCRIPTION_CRON_SECRET', async () => {
    replaceProcessEnv(baseEnv);

    const { env } = await import('@/lib/env');
    expect(env.SUBSCRIPTION_CRON_SECRET).toBeUndefined();
  });

  it('rejects blank or whitespace-only SUBSCRIPTION_CRON_SECRET', async () => {
    replaceProcessEnv({ ...baseEnv, SUBSCRIPTION_CRON_SECRET: '   ' });

    await expect(import('@/lib/env')).rejects.toThrow(/SUBSCRIPTION_CRON_SECRET/);
  });

  it('rejects short SUBSCRIPTION_CRON_SECRET', async () => {
    replaceProcessEnv({ ...baseEnv, SUBSCRIPTION_CRON_SECRET: 'short-cron-secret' });

    await expect(import('@/lib/env')).rejects.toThrow(
      /SUBSCRIPTION_CRON_SECRET must be at least 32 chars/,
    );
  });

  it('rejects long obvious placeholder SUBSCRIPTION_CRON_SECRET', async () => {
    replaceProcessEnv({
      ...baseEnv,
      SUBSCRIPTION_CRON_SECRET: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    });

    await expect(import('@/lib/env')).rejects.toThrow(
      /SUBSCRIPTION_CRON_SECRET must not use a placeholder or default value/,
    );
  });

  it('accepts a trimmed valid SUBSCRIPTION_CRON_SECRET', async () => {
    replaceProcessEnv({
      ...baseEnv,
      SUBSCRIPTION_CRON_SECRET: `  ${VALID_CRON_SECRET}  `,
    });

    const { env } = await import('@/lib/env');
    expect(env.SUBSCRIPTION_CRON_SECRET).toBe(VALID_CRON_SECRET);
  });
});

describe('public env validation', () => {
  it('rejects invalid public URLs', async () => {
    replaceProcessEnv({ ...baseEnv, NEXT_PUBLIC_API_URL: 'not-a-url' });

    await expect(import('@/lib/public-env')).rejects.toThrow(
      /NEXT_PUBLIC_API_URL must be a valid URL/,
    );
  });
});
