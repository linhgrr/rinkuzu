import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import { assertFail, assertOk } from '@/interfaces/services/types';
import { QuizPlayService } from '@/services/quiz/QuizPlayService';

const entitlementMocks = vi.hoisted(() => ({
  resolveEntitlements: vi.fn(),
}));

vi.mock('@/lib/entitlements', () => ({
  can: (entitlements: { tier: string }) => entitlements.tier === 'premium',
  resolveEntitlements: entitlementMocks.resolveEntitlements,
}));

const quizId = '507f191e810c19729de860ea';
const userId = '507f191e810c19729de860eb';
const savedProgress = {
  questionOrder: [1, 0],
  optionOrders: [
    [1, 0],
    [0, 1],
  ],
  userAnswers: [1, [0, 1]],
  currentQuestionIndex: 1,
  answeredCount: 2,
  totalQuestions: 2,
};

function createService() {
  const quizRepository: Mocked<IQuizRepository> = {
    findById: vi.fn(),
    findAccessById: vi.fn(),
    findBySlug: vi.fn().mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      questions: [],
      isPrivate: false,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    }),
    findSummaryBySlug: vi.fn(),
    findIdBySlug: vi.fn().mockResolvedValue(quizId),
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
  };
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findSubscriptionById: vi.fn(),
    findPublicProfileById: vi.fn(),
    updateRole: vi.fn(),
    delete: vi.fn(),
    findAll: vi.fn(),
    count: vi.fn(),
    countByCreatedAtBuckets: vi.fn(),
    countByRole: vi.fn(),
  };
  const progressRepository: Mocked<IQuizProgressRepository> = {
    findByUserAndQuiz: vi.fn(),
    upsert: vi.fn(),
    deleteByUserAndQuiz: vi.fn(),
  };
  const attemptProgressRepository: Mocked<IQuizAttemptProgressRepository> = {
    recordSubmittedAttempt: vi.fn(),
  };

  return {
    quizRepository,
    userRepository,
    progressRepository,
    attemptProgressRepository,
    service: new QuizPlayService(
      quizRepository,
      userRepository,
      progressRepository,
      attemptProgressRepository,
    ),
  };
}

describe('QuizPlayService progress operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    entitlementMocks.resolveEntitlements.mockResolvedValue({ tier: 'free' });
  });

  it('maps saved progress to the response DTO', async () => {
    const { service, progressRepository } = createService();
    vi.mocked(progressRepository.findByUserAndQuiz).mockResolvedValue({
      id: 'progress-1',
      userId,
      quiz: quizId,
      ...savedProgress,
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });

    const result = await service.getSavedQuizProgress('quiz-slug', userId);

    assertOk(result);
    expect(result.data).toEqual({ progress: savedProgress });
    expect(progressRepository.findByUserAndQuiz).toHaveBeenCalledWith(userId, quizId);
  });

  it('saves and deletes progress through the repository', async () => {
    const { service, progressRepository } = createService();
    vi.mocked(progressRepository.upsert).mockResolvedValue({
      id: 'progress-1',
      userId,
      quiz: quizId,
      ...savedProgress,
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });
    vi.mocked(progressRepository.deleteByUserAndQuiz).mockResolvedValue(true);

    const saveResult = await service.saveQuizProgress('quiz-slug', userId, savedProgress);
    const deleteResult = await service.deleteSavedQuizProgress('quiz-slug', userId);

    assertOk(saveResult);
    assertOk(deleteResult);
    expect(saveResult.data).toEqual({ saved: true });
    expect(deleteResult.data).toEqual({ deleted: true });
    expect(progressRepository.upsert).toHaveBeenCalledWith(userId, quizId, savedProgress);
    expect(progressRepository.deleteByUserAndQuiz).toHaveBeenCalledWith(userId, quizId);
  });

  it('returns 404 without touching progress storage when the quiz is missing', async () => {
    const { service, quizRepository, progressRepository } = createService();
    vi.mocked(quizRepository.findIdBySlug).mockResolvedValue(null);

    const result = await service.getSavedQuizProgress('missing', userId);

    assertFail(result);
    expect(result.statusCode).toBe(404);
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
    expect(progressRepository.findByUserAndQuiz).not.toHaveBeenCalled();
  });

  it('never exposes correct answers when a private quiz author starts playing', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findBySlug).mockResolvedValue({
      id: quizId,
      title: 'Private quiz',
      slug: 'private-quiz',
      author: userId,
      isPrivate: true,
      questions: [
        {
          id: 'question-1',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });

    const result = await service.getQuizForPlay('private-quiz', 'user', userId);

    assertOk(result);
    expect(result.data.questions[0]).not.toHaveProperty('correctIndex');
    expect(result.data.questions[0]).not.toHaveProperty('correctIndexes');
  });

  it('blocks private quiz content for a free non-owner', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findBySlug).mockResolvedValue({
      id: quizId,
      title: 'Private quiz',
      slug: 'private-quiz',
      author: '507f191e810c19729de860ec',
      isPrivate: true,
      questions: [
        {
          id: 'question-1',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });

    const result = await service.getQuizForPlay('private-quiz', 'user', userId);

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 403, code: 'premium_required' });
    expect(entitlementMocks.resolveEntitlements).toHaveBeenCalledWith(userId);
  });

  it('uses the authenticated session id when submitting attempts', async () => {
    const { service, quizRepository, userRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      isPrivate: false,
      questions: [
        {
          id: 'question-1',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });
    vi.mocked(attemptProgressRepository.recordSubmittedAttempt).mockResolvedValue({
      id: 'attempt-1',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });

    const result = await service.submitQuizAttempt(
      'quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      {
        user: {
          id: userId,
          email: 'learner@example.com',
          role: 'user',
        },
        expires: '2026-08-01T00:00:00.000Z',
      },
      undefined,
    );

    assertOk(result);
    expect(quizRepository.findForPlay).toHaveBeenCalledWith('quiz');
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(attemptProgressRepository.recordSubmittedAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        idempotencyKey: '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
        quizId,
        quizSlug: 'quiz',
        quizSnapshot: {
          integrity: 'complete',
          title: 'Quiz',
          slug: 'quiz',
          questions: [expect.objectContaining({ id: 'question-1', question: '2 + 2 = ?' })],
        },
        answers: [1],
        score: 100,
        correctAnswers: 1,
        totalQuestions: 1,
        wrongQuestions: [],
      }),
    );
  });

  it('rejects malformed answers instead of silently converting them to unanswered', async () => {
    const { service, quizRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      isPrivate: false,
      questions: [
        {
          id: 'question-1',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });

    const result = await service.submitQuizAttempt(
      'quiz',
      [2],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a1',
      null,
      'guest@example.com',
    );

    assertFail(result);
    expect(result.statusCode).toBe(400);
    expect(result.error).toContain('out of range');
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('loads flashcards through the projected quiz read path', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      isPrivate: false,
      questions: [
        {
          id: 'question-1',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single',
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });

    const result = await service.getQuizForFlashcards('quiz', null);

    assertOk(result);
    expect(result.data.questions[0]).toMatchObject({ correctIndex: 1 });
    expect(quizRepository.findForPlay).toHaveBeenCalledWith('quiz');
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
  });
});
