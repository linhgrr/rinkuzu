import { describe, expect, it } from 'vitest';
import { libraryListQuerySchema } from '@/dtos/review';

describe('review DTO schemas', () => {
  it('parses library query parameters at the controller boundary', () => {
    expect(
      libraryListQuerySchema.parse({
        folder: '507f191e810c19729de860ea',
        page: '2',
        limit: '25',
      }),
    ).toEqual({
      folder: '507f191e810c19729de860ea',
      page: 2,
      limit: 25,
    });

    expect(libraryListQuerySchema.parse({})).toEqual({
      folder: undefined,
      page: 1,
      limit: 100,
    });

    expect(
      libraryListQuerySchema.parse({
        folder: 'unfiled',
      }).folder,
    ).toBeNull();
  });

  it('rejects invalid library query pagination instead of clamping silently', () => {
    expect(() => libraryListQuerySchema.parse({ page: '0' })).toThrow();
    expect(() => libraryListQuerySchema.parse({ limit: '101' })).toThrow();
  });
});
