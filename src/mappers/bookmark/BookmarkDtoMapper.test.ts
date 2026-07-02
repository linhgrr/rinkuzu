import { describe, expect, it } from 'vitest';
import type { Bookmark } from '@/entities/Bookmark';
import { BookmarkDtoMapper } from '@/mappers/bookmark/BookmarkDtoMapper';

const bookmark: Bookmark = {
  id: 'bookmark-1',
  userId: 'user@example.com',
  userEmail: 'user@example.com',
  quiz: {
    slug: 'algebra',
    title: 'Algebra',
    description: 'Linear equations',
  },
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

describe('BookmarkDtoMapper', () => {
  it('maps persistence identifiers and dates to the public DTO contract', () => {
    expect(BookmarkDtoMapper.toDto(bookmark)).toEqual({
      id: 'bookmark-1',
      quiz: {
        slug: 'algebra',
        title: 'Algebra',
        description: 'Linear equations',
      },
      question: bookmark.question,
      questionIndex: 0,
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T01:00:00.000Z',
    });
  });
});
