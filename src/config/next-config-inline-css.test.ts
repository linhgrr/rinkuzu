import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const requireFromTest = createRequire(import.meta.url);

/**
 * RIN-1514: the landing hero h1 is the mobile LCP element. With the stylesheet as an
 * external, render-blocking <link>, the first paint waited for it while the async JS
 * chunks finished loading and running, so Lighthouse counted all of them into LCP
 * (render delay 1.5–2.5 s after FCP). Inlining the CSS lets the hero paint from the HTML
 * alone. Turning this off brings that delay back.
 */
describe('Next.js CSS delivery', () => {
  beforeAll(() => {
    vi.stubEnv('OBJECT_STORAGE_ENDPOINT_EXTERNAL', 'https://storage.example.test');
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('inlines the CSS into the HTML so first paint does not wait for a stylesheet', async () => {
    const createNextConfig = requireFromTest('../../next.config.js') as () => Promise<{
      experimental?: { inlineCss?: boolean };
    }>;
    const nextConfig = await createNextConfig();

    expect(nextConfig.experimental?.inlineCss).toBe(true);
  });
});
