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

  // RIN-1644 AC 4: crawler-facing files, images and assets never run the proxy.
  it.each([
    '/robots.txt',
    '/sitemap.xml',
    '/vi/sitemap.xml',
    '/en/sitemap.xml',
    '/vi/blog/rss.xml',
    '/en/blog/intro-to-ai/og.png',
    '/llms.txt',
    '/icon.png',
    '/favicon.ico',
    '/apple-icon.png',
    '/manifest.webmanifest',
    '/serwist/sw.js',
    '/_next/static/x.js',
    '/_next/image?url=%2Fimages%2Fhero.png&w=640&q=75',
    '/_vercel/insights/script.js',
  ])('skips static and metadata file %s', (path) => {
    expect(matches(path)).toBe(false);
  });

  it.each([
    '/',
    '/dashboard',
    '/vi/dashboard',
    '/en',
    '/vi/',
    '/en/blog/intro-to-ai',
    '/vi/quiz/on-tap-sinh-hoc-000001',
    '/vi/quiz/v1.2-release-notes',
    '/vi/explore?q=sinh',
    '/api/quizzes',
    '/ogre',
    '/og-guide',
    '/blog/og',
  ])('still runs the proxy for %s', (path) => {
    expect(matches(path)).toBe(true);
  });
});
