import { describe, expect, it } from 'vitest';
import { BookmarkPersistenceMapper } from '@/repositories/mappers/BookmarkPersistenceMapper';
import type { BookmarkPersistenceRecord } from '@/repositories/types/BookmarkPersistence';

const record: BookmarkPersistenceRecord = {
  _id: 'bookmark-1',
  userId: 'user-1',
  userEmail: 'learner@example.com',
  quiz: { slug: 'algebra', title: 'Algebra' },
  question: {
    text: '2 + 2?',
    options: ['3', '4'],
    type: 'single',
    correctIndex: 1,
  },
  questionIndex: 0,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T01:00:00.000Z'),
};

describe('BookmarkPersistenceMapper', () => {
  it('normalizes persistence identity and timestamps', () => {
    const entity = BookmarkPersistenceMapper.toEntity(record);
    expect(entity).toMatchObject({
      id: 'bookmark-1',
      userId: 'user-1',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T01:00:00.000Z'),
    });
    expect(entity.quiz).not.toHaveProperty('description');
    expect(entity.question).not.toHaveProperty('correctIndexes');
    expect(entity.question).not.toHaveProperty('questionImage');
    expect(entity.question).not.toHaveProperty('optionImages');
  });

  it('rejects a record without persistence identity', () => {
    expect(() => BookmarkPersistenceMapper.toEntity({ ...record, _id: '' })).toThrow(
      'bookmark._id is required',
    );
  });
});
