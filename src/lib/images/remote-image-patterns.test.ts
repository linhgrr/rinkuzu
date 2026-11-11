import { matchRemotePattern } from 'next/dist/shared/lib/match-remote-pattern';
import { describe, expect, it } from 'vitest';

import { canOptimizeImageSrc } from '@/lib/images/remote-image-patterns';
import remotePatterns from '@/lib/images/remote-patterns.json';

const ALLOWED = [
  'https://cdn.rinkuzu.app/images/migrated/a.png',
  'https://cdn.rinkuzu.app/images',
  'https://CDN.rinkuzu.app/images/a.png',
  'https://res.cloudinary.com/demo/image/upload/a.jpg',
  'https://bucket.s3.amazonaws.com/a.png',
  'https://a.b.s3.amazonaws.com/a.png',
  'https://acct.blob.core.windows.net/c/a.png',
  'https://images.unsplash.com/photo-1?w=200',
  'http://localhost/a.png',
];

const REFUSED = [
  'https://lh3.googleusercontent.com/a/photo=s96-c',
  'https://cdn.rinkuzu.app/files/a.png',
  'https://cdn.rinkuzu.app/imagesx/a.png',
  'http://cdn.rinkuzu.app/images/a.png',
  'https://cdn.rinkuzu.app:8443/images/a.png',
  'http://localhost:3000/a.png',
  'https://amazonaws.com/a.png',
  'https://evil.example.com/cdn.rinkuzu.app/images/a.png',
  'https://cdn.rinkuzu.app.example.com/images/a.png',
];

describe('canOptimizeImageSrc', () => {
  it.each(ALLOWED)('accepts %s, as next/image does', (src) => {
    expect(canOptimizeImageSrc(src)).toBe(true);
  });

  it.each(REFUSED)('refuses %s, as next/image does', (src) => {
    expect(canOptimizeImageSrc(src)).toBe(false);
  });

  it('agrees with the matcher next/image uses for every case', () => {
    for (const src of [...ALLOWED, ...REFUSED]) {
      const url = new URL(src);
      const nextAllows = remotePatterns.some((pattern) =>
        matchRemotePattern(
          { ...pattern, protocol: pattern.protocol === 'http' ? 'http' : 'https' },
          url,
        ),
      );
      expect(canOptimizeImageSrc(src), src).toBe(nextAllows);
    }
  });

  it('accepts same-origin paths and refuses protocol-relative, data and unparsable values', () => {
    expect(canOptimizeImageSrc('/images/avatar.png')).toBe(true);
    expect(canOptimizeImageSrc('//cdn.rinkuzu.app/images/a.png')).toBe(false);
    expect(canOptimizeImageSrc('data:image/png;base64,AAAA')).toBe(false);
    expect(canOptimizeImageSrc('not a url')).toBe(false);
  });
});
