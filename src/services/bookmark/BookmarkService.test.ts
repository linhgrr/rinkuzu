import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Bookmark } from '@/entities/Bookmark';
import type { IBookmarkRepository } from '@/interfaces/repositories/IBookmarkRepository';
import { BookmarkService } from '@/services/bookmark/BookmarkService';

const now = new Date('2026-07-04T00:00:00.000Z');
const owner = {
  userId: '507f191e810c19729de860ea',
  userEmail: 'learner@example.com',
};
const input = {
  quiz: {
    slug: 'algorithms',
    title: 'Algorithms',
  },
  question: {
    text: 'What is O(n)?',
    options: ['Linear', 'Constant'],
    type: 'single' as const,
    correctIndex: 0,
  },
  questionIndex: 2,
};

function bookmark(): Bookmark {
  return {
    id: '507f191e810c19729de860eb',
    ...owner,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

function createRepository(): Mocked<IBookmarkRepository> {
  return {
    findByUserId: vi.fn(),
    create: vi.fn(),
    deleteByIdAndUser: vi.fn(),
  };
}

describe('BookmarkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists bookmarks directly by authenticated user id', async () => {
    const repository = createRepository();
    repository.findByUserId.mockResolvedValue({
      items: [bookmark()],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 10,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
    const service = new BookmarkService(repository);

    const result = await service.getBookmarksByUser(owner.userId, { page: 1, limit: 10 });

    expect(result.bookmarks).toHaveLength(1);
    expect(repository.findByUserId).toHaveBeenCalledWith(owner.userId, {
      page: 1,
      limit: 10,
    });
  });

  it('passes quiz slug filters through for result page bookmark lookups', async () => {
    const repository = createRepository();
    repository.findByUserId.mockResolvedValue({
      items: [bookmark()],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
    const service = new BookmarkService(repository);

    await service.getBookmarksByUser(owner.userId, {
      page: 1,
      limit: 20,
      quizSlug: 'algorithms',
    });

    expect(repository.findByUserId).toHaveBeenCalledWith(owner.userId, {
      page: 1,
      limit: 20,
      quizSlug: 'algorithms',
    });
  });

  it('creates once with stable user identity and no preflight read', async () => {
    const repository = createRepository();
    repository.create.mockResolvedValue(bookmark());
    const service = new BookmarkService(repository);

    const result = await service.createBookmark(owner, input);

    expect(result.id).toBe('507f191e810c19729de860eb');
    expect(repository.create).toHaveBeenCalledWith({
      ...owner,
      ...input,
    });
  });

  it('maps the unique index conflict to the existing API error', async () => {
    const repository = createRepository();
    repository.create.mockRejectedValue({
      code: 11000,
      keyPattern: { userId: 1, 'quiz.slug': 1, questionIndex: 1 },
    });
    const service = new BookmarkService(repository);

    await expect(service.createBookmark(owner, input)).rejects.toThrow(
      'Question already bookmarked',
    );
  });

  it('deletes bookmarks using authenticated user id ownership', async () => {
    const repository = createRepository();
    repository.deleteByIdAndUser.mockResolvedValue(true);
    const service = new BookmarkService(repository);

    await expect(
      service.deleteBookmarkByUser('507f191e810c19729de860eb', owner.userId),
    ).resolves.toEqual({
      id: '507f191e810c19729de860eb',
      deleted: true,
    });
    expect(repository.deleteByIdAndUser).toHaveBeenCalledWith(
      '507f191e810c19729de860eb',
      owner.userId,
    );
  });
});
