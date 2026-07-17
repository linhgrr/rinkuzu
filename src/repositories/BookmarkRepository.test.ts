import { beforeEach, describe, expect, it, vi } from 'vitest';

const bookmarkMocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  create: vi.fn(),
  findOneAndDelete: vi.fn(),
}));

vi.mock('@/lib/mongoose', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/models/Bookmark', () => ({
  default: {
    aggregate: bookmarkMocks.aggregate,
    create: bookmarkMocks.create,
    findOneAndDelete: bookmarkMocks.findOneAndDelete,
  },
}));

import { BookmarkRepository } from '@/repositories/BookmarkRepository';

const bookmarkRecord = {
  _id: '507f191e810c19729de860ea',
  userId: 'user-1',
  userEmail: 'user@example.com',
  quiz: { slug: 'algebra', title: 'Algebra' },
  question: {
    text: '2+2?',
    options: ['3', '4'],
    type: 'single' as const,
    correctIndex: 1,
  },
  questionIndex: 0,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

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

  it('treats a missing facet document as empty items and zero total', async () => {
    // Pins result?.items ?? [] and result?.meta optional chaining survivors.
    bookmarkMocks.aggregate.mockResolvedValueOnce([]);
    const repository = new BookmarkRepository();

    await expect(repository.findByUserId('user-1', { page: 1, limit: 10 })).resolves.toEqual({
      items: [],
      pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  });
});

describe('BookmarkRepository.create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bookmarkMocks.create.mockResolvedValue({
      toObject: () => bookmarkRecord,
    });
  });

  it('persists the bookmark and maps the created document to an entity', async () => {
    const repository = new BookmarkRepository();
    const createData = {
      userId: 'user-1',
      userEmail: 'user@example.com',
      quiz: { slug: 'algebra', title: 'Algebra' },
      question: bookmarkRecord.question,
      questionIndex: 0,
    };

    await expect(repository.create(createData)).resolves.toMatchObject({
      id: '507f191e810c19729de860ea',
      userId: 'user-1',
      userEmail: 'user@example.com',
      quiz: { slug: 'algebra', title: 'Algebra' },
      questionIndex: 0,
    });
    expect(bookmarkMocks.create).toHaveBeenCalledWith(createData);
  });
});

describe('BookmarkRepository.deleteByIdAndUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true only when an owned bookmark document is deleted', async () => {
    bookmarkMocks.findOneAndDelete.mockResolvedValueOnce(bookmarkRecord);
    const repository = new BookmarkRepository();

    await expect(repository.deleteByIdAndUser('507f191e810c19729de860ea', 'user-1')).resolves.toBe(
      true,
    );
    expect(bookmarkMocks.findOneAndDelete).toHaveBeenCalledWith({
      _id: '507f191e810c19729de860ea',
      userId: 'user-1',
    });
  });

  it('returns false when the bookmark is missing or owned by another user', async () => {
    bookmarkMocks.findOneAndDelete.mockResolvedValueOnce(null);
    const repository = new BookmarkRepository();

    await expect(repository.deleteByIdAndUser('507f191e810c19729de860ea', 'user-2')).resolves.toBe(
      false,
    );
  });
});
