import { describe, expect, it } from 'vitest';
import Attempt from '@/models/Attempt';
import Bookmark from '@/models/Bookmark';
import Discussion from '@/models/Discussion';
import Quiz from '@/models/Quiz';
import Report from '@/models/Report';
import Subscription from '@/models/Subscription';
import User from '@/models/User';

function hasIndex(
  model: { schema: { indexes: () => Array<[Record<string, unknown>, unknown]> } },
  spec: Record<string, unknown>,
): boolean {
  return model.schema.indexes().some(([indexSpec]) => {
    const specEntries = Object.entries(spec);
    const indexEntries = Object.entries(indexSpec);

    return (
      indexEntries.length === specEntries.length &&
      specEntries.every(([field, direction]) => indexSpec[field] === direction)
    );
  });
}

describe('query performance indexes', () => {
  it('indexes global recent attempt and attempt bucket reads', () => {
    expect(hasIndex(Attempt, { takenAt: -1 })).toBe(true);
  });

  it('indexes public quiz list filtering by visibility and recency', () => {
    expect(hasIndex(Quiz, { isPrivate: 1, createdAt: -1 })).toBe(true);
  });

  it('indexes global recent user and user bucket reads', () => {
    expect(hasIndex(User, { createdAt: -1 })).toBe(true);
  });

  it('indexes bookmark lists by stable user identity and recency', () => {
    expect(hasIndex(Bookmark, { userId: 1, createdAt: -1 })).toBe(true);
  });

  it('indexes unfiltered report and subscription admin lists by recency', () => {
    expect(hasIndex(Report, { createdAt: -1 })).toBe(true);
    expect(hasIndex(Subscription, { createdAt: -1 })).toBe(true);
  });

  it('enforces one discussion per quiz question', () => {
    expect(
      Discussion.schema
        .indexes()
        .find(
          ([indexSpec]) =>
            indexSpec['quiz'] === 1 &&
            indexSpec['questionIndex'] === 1 &&
            Object.keys(indexSpec).length === 2,
        )?.[1],
    ).toMatchObject({ unique: true });
  });
});
