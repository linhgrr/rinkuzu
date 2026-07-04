import { describe, expect, it, vi } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { QuizCrudService } from '@/services/quiz/QuizCrudService';

const quizSummary: Quiz = {
  id: '507f191e810c19729de860ea',
  title: 'Algebra Basics',
  description: 'Linear equations',
  slug: 'algebra-basics',
  author: {
    id: '507f191e810c19729de860eb',
    email: 'teacher@example.com',
    displayName: 'Math Teacher',
  },
  questions: [],
  questionCount: 12,
  isPrivate: false,
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T01:00:00Z'),
};

function createQuizRepository(overrides: Partial<IQuizRepository> = {}): IQuizRepository {
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

describe('QuizCrudService metadata reads', () => {
  it('uses the compact summary query for quiz metadata', async () => {
    const quizRepository = createQuizRepository({
      findSummaryBySlug: vi.fn().mockResolvedValue(quizSummary),
    });
    const service = new QuizCrudService(quizRepository, {} as IUserRepository);

    await expect(service.getQuizMetadataBySlug('algebra-basics')).resolves.toMatchObject({
      id: quizSummary.id,
      title: quizSummary.title,
      questionCount: 12,
    });
    expect(quizRepository.findSummaryBySlug).toHaveBeenCalledWith('algebra-basics');
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
  });
});
