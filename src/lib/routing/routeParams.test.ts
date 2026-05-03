import { describe, expect, it } from 'vitest';
import { readRequiredRouteParam, routePathSegment } from './routeParams';

describe('route param guards', () => {
  it('reads a required single route param', () => {
    expect(readRequiredRouteParam({ slug: 'intro-to-ai' }, 'slug')).toBe('intro-to-ai');
  });

  it('reads the first value from a catch-all route param', () => {
    expect(readRequiredRouteParam({ slug: ['intro-to-ai'] }, 'slug')).toBe('intro-to-ai');
  });

  it.each([{ slug: undefined }, { slug: '' }, { slug: 'undefined' }, { slug: 'null' }])(
    'throws before unsafe route params can reach fetch URLs: %o',
    (params) => {
      expect(() => readRequiredRouteParam(params, 'slug')).toThrow('Missing required route param');
    },
  );

  it('encodes route path segments', () => {
    expect(routePathSegment('a quiz/slash')).toBe('a%20quiz%2Fslash');
  });

  it('throws before empty path segments can be interpolated into URLs', () => {
    expect(() => routePathSegment('undefined')).toThrow('empty path segment');
  });
});
