import { describe, expect, it } from 'vitest';
import { isMongoDuplicateKeyError, isMongoDuplicateKeyErrorForField } from '@/lib/mongoose-errors';

describe('isMongoDuplicateKeyError', () => {
  it('recognizes Mongo duplicate-key errors', () => {
    expect(isMongoDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isMongoDuplicateKeyError(Object.assign(new Error('duplicate'), { code: 11000 }))).toBe(
      true,
    );
  });

  it('rejects unrelated and malformed errors', () => {
    expect(isMongoDuplicateKeyError({ code: 11001 })).toBe(false);
    expect(isMongoDuplicateKeyError({ code: '11000' })).toBe(false);
    expect(isMongoDuplicateKeyError(new Error('duplicate'))).toBe(false);
    expect(isMongoDuplicateKeyError(null)).toBe(false);
  });

  it('recognizes duplicate-key errors for a specific field', () => {
    expect(
      isMongoDuplicateKeyErrorForField(
        { code: 11000, keyPattern: { slug: 1 }, keyValue: { slug: 'quiz' } },
        'slug',
      ),
    ).toBe(true);
    expect(
      isMongoDuplicateKeyErrorForField({ code: 11000, keyPattern: { sourceDraftId: 1 } }, 'slug'),
    ).toBe(false);
  });
});
