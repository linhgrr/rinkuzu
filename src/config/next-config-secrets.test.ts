import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const forbiddenServerEnv = ['MONGODB_URI', 'NEXTAUTH_SECRET', 'JWT_EXPIRES_IN'] as const;

describe('Next.js configuration', () => {
  beforeAll(() => {
    vi.stubEnv('OBJECT_STORAGE_ENDPOINT_EXTERNAL', 'https://storage.example.test');
    for (const name of forbiddenServerEnv) {
      vi.stubEnv(name, `server-only-${name.toLowerCase()}`);
    }
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('does not expose server-only secrets through next.config env', async () => {
    const createNextConfig = requireFromTest('../../next.config.js') as () => Promise<{
      env?: Record<string, unknown>;
    }>;
    const nextConfig = await createNextConfig();
    const exposedEnv = nextConfig.env ?? {};

    for (const name of forbiddenServerEnv) {
      expect(exposedEnv).not.toHaveProperty(name);
      expect(Object.values(exposedEnv)).not.toContain(process.env[name]);
    }
  });
});
