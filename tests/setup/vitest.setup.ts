import { afterEach, vi } from 'vitest';
import { resetEntitlementsCache } from '@/lib/entitlements/cache';

// Allow tests to import modules guarded by `import 'server-only'`. Next.js
// ships a stub that throws when imported from a client bundle; in node-env
// vitest we want a no-op.
vi.mock('server-only', () => ({}));

// App runtime is intentionally fail-fast on env config. Unit tests should
// provide a stable baseline env so module imports don't explode before the
// actual behavior under test runs.
const testEnvDefaults: Record<string, string> = {
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

for (const [key, value] of Object.entries(testEnvDefaults)) {
  process.env[key] ??= value;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetEntitlementsCache();
});
