import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const runtimeCaching = require('../config/pwa-runtime-caching.cjs') as Array<{
  urlPattern: RegExp | ((context: { url: URL; sameOrigin: boolean }) => boolean);
  handler: string;
}>;

function matches(value: string) {
  const url = new URL(value);
  return runtimeCaching.some(({ urlPattern }) =>
    urlPattern instanceof RegExp
      ? urlPattern.test(value)
      : urlPattern({ url, sameOrigin: url.origin === 'https://rinkuzu.test' }),
  );
}

describe('PWA runtime caching', () => {
  it.each([
    'https://rinkuzu.test/api/user/profile',
    'https://rinkuzu.test/api/auth/session',
    'https://rinkuzu.test/en/dashboard',
    'https://rinkuzu.test/en/quiz/private-quiz',
    'https://rinkuzu.test/_next/image?url=%2Fapi%2Fuser%2Favatar',
  ])('does not cache authenticated or request-specific URL %s', (url) => {
    expect(matches(url)).toBe(false);
  });

  it.each([
    'https://rinkuzu.test/_next/static/chunks/app.js',
    'https://rinkuzu.test/images/navbar_logo.png',
    'https://rinkuzu.test/icons/icon-192.png',
    'https://fonts.googleapis.com/css2?family=Inter',
    'https://fonts.gstatic.com/s/inter/font.woff2',
  ])('caches public static URL %s', (url) => {
    expect(matches(url)).toBe(true);
  });

  it('does not use network-response caching for runtime routes', () => {
    expect(runtimeCaching.map((entry) => entry.handler)).not.toContain('NetworkFirst');
  });
});
