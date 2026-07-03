import { describe, expect, it } from 'vitest';
import Attempt from '@/models/Attempt';
import Quiz from '@/models/Quiz';
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
});
