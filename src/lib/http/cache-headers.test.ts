import { describe, expect, it } from 'vitest';
import { catalogCacheHeaders } from './cache-headers';

function parse(value: string): Map<string, string | true> {
  return new Map(
    value.split(',').map((part) => {
      const [name = '', arg] = part.trim().split('=');
      return [name, arg ?? true] as const;
    }),
  );
}

describe('catalogCacheHeaders', () => {
  it('lets the CDN share a response built without the session', () => {
    const directives = parse(catalogCacheHeaders({ readsSession: false })['Cache-Control']);

    expect(directives.get('public')).toBe(true);
    expect(Number(directives.get('s-maxage'))).toBeGreaterThanOrEqual(300);
    expect(Number(directives.get('stale-while-revalidate'))).toBeGreaterThanOrEqual(86400);
    expect(directives.has('private')).toBe(false);
  });

  it('never caches a response that may carry per-user data', () => {
    const value = catalogCacheHeaders({ readsSession: true })['Cache-Control'];

    expect(value).toBe('private, no-store');
    expect(value).not.toContain('public');
    expect(value).not.toContain('s-maxage');
  });
});
