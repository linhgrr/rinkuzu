import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { describe, expect, it, vi } from 'vitest';

// Only the exported matcher is under test; stub the runtime middleware deps.
vi.mock('next-intl/middleware', () => ({ default: () => () => undefined }));
vi.mock('next-auth', () => ({
  default: () => ({ auth: (handler: unknown) => handler }),
}));

const { config } = await import('./proxy');

function matches(path: string): boolean {
  return unstable_doesMiddlewareMatch({ config, url: `https://www.rinkuzu.app${path}` });
}

describe('proxy matcher', () => {
  it.each(['/og', '/og?title=Test', '/og/'])(
    'lets the non-localized share-card route %s bypass the locale proxy',
    (path) => {
      expect(matches(path)).toBe(false);
    },
  );

  it.each(['/robots.txt', '/sitemap.xml', '/llms.txt', '/serwist/sw.js', '/_next/static/x.js'])(
    'skips static and metadata file %s',
    (path) => {
      expect(matches(path)).toBe(false);
    },
  );

  it.each([
    '/',
    '/dashboard',
    '/vi/dashboard',
    '/en',
    '/api/quizzes',
    '/ogre',
    '/og-guide',
    '/blog/og',
  ])('still runs the proxy for %s', (path) => {
    expect(matches(path)).toBe(true);
  });
});
