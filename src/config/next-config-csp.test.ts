import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const requireFromTest = createRequire(import.meta.url);
const POSTHOG_ASSETS_ORIGIN = 'https://us-assets.i.posthog.com';

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function contentSecurityPolicy(): Promise<Map<string, string[]>> {
  const createNextConfig = requireFromTest('../../next.config.js') as () => Promise<{
    headers: () => Promise<HeaderRule[]>;
  }>;
  const nextConfig = await createNextConfig();
  const rules = await nextConfig.headers();
  const csp = rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value;
  if (!csp) throw new Error('Content-Security-Policy header missing');

  return new Map(
    csp.split(';').map((directive) => {
      const [name = '', ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
}

describe('Next.js Content-Security-Policy', () => {
  beforeAll(() => {
    vi.stubEnv('OBJECT_STORAGE_ENDPOINT_EXTERNAL', 'https://storage.example.test');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('lets posthog-js load its remote config from the assets origin', async () => {
    const policy = await contentSecurityPolicy();

    expect(policy.get('script-src')).toContain(POSTHOG_ASSETS_ORIGIN);
    expect(policy.get('connect-src')).toContain(POSTHOG_ASSETS_ORIGIN);
  });

  it('keeps the PostHog assets origin out of every other directive', async () => {
    const policy = await contentSecurityPolicy();

    const directivesWithAssets = [...policy]
      .filter(([, sources]) => sources.includes(POSTHOG_ASSETS_ORIGIN))
      .map(([name]) => name);
    expect(directivesWithAssets).toEqual(['script-src', 'connect-src']);
    expect(policy.get('default-src')).toEqual(["'self'"]);
  });
});
