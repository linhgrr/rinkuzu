import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { Quiz } from '@/entities/Quiz';
import { QuizAdminService } from '@/services/quiz/QuizAdminService';

const quiz: Quiz = {
  id: '507f191e810c19729de860ea',
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: {
    id: '507f191e810c19729de860eb',
    email: 'teacher@example.com',
    displayName: 'Math Teacher',
  },
  questions: [
    {
      id: '507f191e810c19729de860ed',
      question: '2 + 2 = ?',
      options: ['3', '4'],
      correctIndex: 1,
      type: 'single',
    },
  ],
  isPrivate: true,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

function createRepository(overrides: Partial<IQuizRepository> = {}): IQuizRepository {
  return {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn(),
    findSummaryBySlug: vi.fn(),
    findIdBySlug: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn(),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
    ...overrides,
  };
}

describe('QuizAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists admin quiz DTOs with admin visibility filtering', async () => {
    const repository = createRepository({
      findAll: vi.fn().mockResolvedValue({
        items: [quiz],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 12,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });
    const service = new QuizAdminService(repository);

    const result = await service.listAdminQuizzes({
      page: 1,
      limit: 12,
      search: 'algebra',
      visibility: 'private',
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(repository.findAll).toHaveBeenCalledWith(
      {
        isPrivate: true,
        $or: [{ title: expect.any(RegExp) }, { description: expect.any(RegExp) }],
      },
      {
        page: 1,
        limit: 12,
        sort: { createdAt: -1 },
        populate: ['author'],
        compact: true,
      },
    );
    expect(result.data.quizzes[0]).toMatchObject({
      id: '507f191e810c19729de860ea',
      author: { id: '507f191e810c19729de860eb' },
      questionCount: 1,
    });
  });

  it('uses compact repository reads for quiz list DTOs', async () => {
    const repository = createRepository({
      findAll: vi.fn().mockResolvedValue({
        items: [{ ...quiz, questionCount: 1, questions: [] }],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    });
    const service = new QuizAdminService(repository);

    const result = await service.getQuizzes({
      page: 1,
      limit: 10,
      onlyMine: false,
      compact: false,
    });

    expect(result.quizzes[0]).toMatchObject({
      id: quiz.id,
      questionCount: 1,
    });
    expect(repository.findAll).toHaveBeenCalledWith(
      {},
      {
        page: 1,
        limit: 10,
        sort: { createdAt: -1 },
        populate: ['author'],
        compact: true,
      },
    );
  });

  it('returns admin quiz detail DTOs', async () => {
    const repository = createRepository({
      findById: vi.fn().mockResolvedValue(quiz),
    });
    const service = new QuizAdminService(repository);

    const result = await service.getAdminQuiz('507f191e810c19729de860ea');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      id: '507f191e810c19729de860ea',
      questions: [
        {
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
    });
  });

  it('deletes existing quizzes through the repository cascade delete', async () => {
    const repository = createRepository({
      findAccessById: vi.fn().mockResolvedValue({
        id: quiz.id,
        author: quiz.author,
        isPrivate: quiz.isPrivate,
      }),
      delete: vi.fn().mockResolvedValue(true),
    });
    const service = new QuizAdminService(repository);

    const result = await service.deleteAdminQuiz('507f191e810c19729de860ea');

    expect(result).toEqual({
      success: true,
      data: { id: '507f191e810c19729de860ea', deleted: true },
    });
    expect(repository.findAccessById).toHaveBeenCalledWith('507f191e810c19729de860ea');
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith('507f191e810c19729de860ea');
  });
});
