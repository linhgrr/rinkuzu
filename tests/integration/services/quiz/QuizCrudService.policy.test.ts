import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { Quiz } from '@/entities/Quiz';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import { QuizCrudService } from '@/services/quiz/QuizCrudService';

describe('QuizCrudService Premium source publication policy', () => {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn(),
    findSummaryBySlug: vi.fn(),
    findIdBySlug: vi.fn(),
    findCanonicalSlugByAlias: vi.fn(),
    findBySourceDraftId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    findForPlay: vi.fn(),
    findUserQuizzes: vi.fn(),
    findPublicByAuthor: vi.fn(),
    findMetadataBySlug: vi.fn(),
    findNonIndexableOwnerCandidates: vi.fn(),
    findPublicSitemapEntries: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    findTopCreators: vi.fn(),
  };

  const request = {
    title: 'Published immediately',
    folderId: null,
    questions: [
      {
        question: 'Question?',
        options: ['A', 'B'],
        type: 'single' as const,
        correctIndex: 0,
      },
    ],
    submitToPremium: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    quizRepository.findBySourceDraftId.mockResolvedValue(null);
    quizRepository.create.mockImplementation(
      async (quizData): Promise<Quiz> => ({
        id: 'quiz-1',
        title: quizData.title,
        slug: quizData.slug,
        author: quizData.author,
        questions: quizData.questions.map((question, index) => ({
          ...question,
          id: `question-${index + 1}`,
        })),
        visibility: quizData.visibility,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      }),
    );
  });

  it('creates an ordinary quiz as public', async () => {
    await new QuizCrudService(quizRepository).createQuiz('user-1', request);

    expect(quizRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public' }),
    );
  });

  it('creates a Premium contribution as a personal source without a subscription gate', async () => {
    await new QuizCrudService(quizRepository).createQuiz('user-1', {
      ...request,
      submitToPremium: true,
      rightsAttested: true,
    });

    expect(quizRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'personal' }),
    );
  });

  it('records a personal visibility update when submitting an edited source', async () => {
    quizRepository.findAccessById.mockResolvedValue({
      id: 'quiz-1',
      author: 'user-1',
      visibility: 'public',
    });
    quizRepository.update.mockResolvedValue({
      id: 'quiz-1',
      title: 'Updated',
      slug: 'updated',
      author: 'user-1',
      questions: [],
      visibility: 'personal',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-02T00:00:00Z'),
    });

    await new QuizCrudService(quizRepository).updateQuiz(
      'quiz-1',
      { submitToPremium: true, rightsAttested: true },
      'user-1',
    );

    expect(quizRepository.update).toHaveBeenCalledWith('quiz-1', {
      visibility: 'personal',
    });
  });
});
