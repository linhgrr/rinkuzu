import { afterEach, describe, expect, it, vi } from 'vitest';

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
  INTERNAL_SERVICE_TOKEN: 'test-internal-token',
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
});

describe('public env validation', () => {
  it('rejects invalid public URLs', async () => {
    replaceProcessEnv({ ...baseEnv, NEXT_PUBLIC_API_URL: 'not-a-url' });

    await expect(import('@/lib/public-env')).rejects.toThrow(
      /NEXT_PUBLIC_API_URL must be a valid URL/,
    );
  });
});
