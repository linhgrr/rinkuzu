import { beforeEach, describe, expect, it, vi } from 'vitest';

const bookmarkMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Bookmark', () => ({
  default: {
    aggregate: bookmarkMocks.aggregate,
  },
}));

import { BookmarkRepository } from '@/repositories/BookmarkRepository';

describe('BookmarkRepository.findByUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bookmarkMocks.aggregate.mockResolvedValue([{ items: [], meta: [] }]);
  });

  it('loads the page and total count in one indexed aggregation', async () => {
    const repository = new BookmarkRepository();

    await expect(
      repository.findByUserId('user-1', {
        page: 2,
        limit: 10,
        quizSlug: 'algebra',
      }),
    ).resolves.toMatchObject({
      items: [],
      pagination: {
        currentPage: 2,
        itemsPerPage: 10,
        totalItems: 0,
      },
    });

    expect(bookmarkMocks.aggregate).toHaveBeenCalledOnce();
    expect(bookmarkMocks.aggregate).toHaveBeenCalledWith([
      { $match: { userId: 'user-1', 'quiz.slug': 'algebra' } },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          items: [{ $skip: 10 }, { $limit: 10 }],
          meta: [{ $count: 'totalItems' }],
        },
      },
    ]);
  });

  it('uses the user-only filter and preserves the aggregate total', async () => {
    bookmarkMocks.aggregate.mockResolvedValueOnce([
      {
        items: [],
        meta: [{ totalItems: 21 }],
      },
    ]);
    const repository = new BookmarkRepository();

    await expect(repository.findByUserId('user-1', { page: 1, limit: 20 })).resolves.toMatchObject({
      pagination: {
        currentPage: 1,
        itemsPerPage: 20,
        totalItems: 21,
        totalPages: 2,
      },
    });

    const [pipeline] = bookmarkMocks.aggregate.mock.calls[0] ?? [];
    expect(pipeline?.[0]).toEqual({ $match: { userId: 'user-1' } });
  });
});
