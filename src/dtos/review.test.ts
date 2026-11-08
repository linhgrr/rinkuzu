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

  it('accepts status filters and a trimmed title search of 1-80 characters', () => {
    expect(libraryListQuerySchema.parse({ status: 'in_progress', q: '  Kanji N5 ' })).toMatchObject(
      { status: 'in_progress', q: 'Kanji N5' },
    );
    expect(libraryListQuerySchema.parse({ status: 'complete' }).status).toBe('complete');
    expect(libraryListQuerySchema.parse({ q: 'a'.repeat(80) }).q).toHaveLength(80);
  });

  it('rejects unknown statuses and empty or overlong searches', () => {
    expect(() => libraryListQuerySchema.parse({ status: 'not_started' })).toThrow();
    expect(() => libraryListQuerySchema.parse({ status: 'all' })).toThrow();
    expect(() => libraryListQuerySchema.parse({ q: '   ' })).toThrow();
    expect(() => libraryListQuerySchema.parse({ q: 'a'.repeat(81) })).toThrow();
  });
});
