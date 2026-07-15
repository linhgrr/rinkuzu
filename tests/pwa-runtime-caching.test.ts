import { describe, expect, it } from 'vitest';
import type { RuntimeCaching } from 'serwist';
import { runtimeCaching } from '@/service-worker/runtime-caching';

function matches(value: string) {
  const url = new URL(value);
  const request = new Request(url);
  const event = new Event('fetch') as ExtendableEvent;

  return runtimeCaching.some(({ matcher }) => {
    if (matcher instanceof RegExp) return matcher.test(value);
    if (typeof matcher === 'string') return matcher === value;

    return Boolean(
      matcher({
        url,
        request,
        event,
        sameOrigin: url.origin === 'https://rinkuzu.test',
      }),
    );
  });
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
    const handlerNames = runtimeCaching.map(({ handler }: RuntimeCaching) =>
      typeof handler === 'function' ? 'function' : handler.constructor.name,
    );

    expect(handlerNames).not.toContain('NetworkFirst');
  });
});
