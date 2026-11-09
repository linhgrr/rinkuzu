import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { IQuizAttemptProgressRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IQuizProgressRepository } from '@/interfaces/repositories/IQuizProgressRepository';
import type { IQuizRepository } from '@/interfaces/repositories/IQuizRepository';
import type { IUserRepository } from '@/interfaces/repositories/IUserRepository';
import type { Quiz } from '@/entities/Quiz';
import { assertFail, assertOk } from '../../../tests/helpers/service-result-assert';
import { QuizPlayService } from '@/services/quiz/QuizPlayService';

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
      visibility: 'public' as const,
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    }),
    findSummaryBySlug: vi.fn().mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      questions: [],
      visibility: 'public',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    }),
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
  const userRepository: Mocked<IUserRepository> = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByIdIncludingDisabled: vi.fn(),
    findPublicProfileById: vi.fn(),
    applyAdminMutation: vi.fn(),
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

describe('QuizPlayService slug aliases', () => {
  it('returns the canonical slug for a former slug', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findCanonicalSlugByAlias).mockResolvedValue('cach-ghi-nho-096007');

    await expect(service.resolveSlugAlias('cch-ghi-nh-096007')).resolves.toBe(
      'cach-ghi-nho-096007',
    );
    expect(quizRepository.findCanonicalSlugByAlias).toHaveBeenCalledWith('cch-ghi-nh-096007');
  });

  it('returns null for an unknown slug or an alias equal to the slug (no redirect loop)', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findCanonicalSlugByAlias).mockResolvedValueOnce(null);
    await expect(service.resolveSlugAlias('unknown')).resolves.toBeNull();

    vi.mocked(quizRepository.findCanonicalSlugByAlias).mockResolvedValueOnce('same-slug');
    await expect(service.resolveSlugAlias('same-slug')).resolves.toBeNull();
  });
});

describe('QuizPlayService progress operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(quizRepository.findSummaryBySlug).mockResolvedValue(null);

    const getResult = await service.getSavedQuizProgress('missing', userId);
    const saveResult = await service.saveQuizProgress('missing', userId, savedProgress);
    const deleteResult = await service.deleteSavedQuizProgress('missing', userId);

    assertFail(getResult);
    assertFail(saveResult);
    assertFail(deleteResult);
    expect(getResult).toMatchObject({ statusCode: 404, error: 'Quiz not found' });
    expect(saveResult).toMatchObject({ statusCode: 404, error: 'Quiz not found' });
    expect(deleteResult).toMatchObject({ statusCode: 404, error: 'Quiz not found' });
    expect(quizRepository.findSummaryBySlug).toHaveBeenCalledTimes(3);
    expect(quizRepository.findIdBySlug).not.toHaveBeenCalled();
    expect(quizRepository.findBySlug).not.toHaveBeenCalled();
    expect(progressRepository.findByUserAndQuiz).not.toHaveBeenCalled();
    expect(progressRepository.upsert).not.toHaveBeenCalled();
    expect(progressRepository.deleteByUserAndQuiz).not.toHaveBeenCalled();
  });

  it('blocks non-owners from all progress operations on personal quiz sources', async () => {
    const { service, quizRepository, progressRepository } = createService();
    vi.mocked(quizRepository.findSummaryBySlug).mockResolvedValue({
      id: quizId,
      title: 'Personal quiz source',
      slug: 'private-quiz',
      author: 'another-user',
      questions: [],
      visibility: 'personal',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });

    const [getResult, saveResult, deleteResult] = await Promise.all([
      service.getSavedQuizProgress('private-quiz', userId, 'user'),
      service.saveQuizProgress('private-quiz', userId, savedProgress, 'user'),
      service.deleteSavedQuizProgress('private-quiz', userId, 'user'),
    ]);

    assertFail(getResult);
    assertFail(saveResult);
    assertFail(deleteResult);
    expect(getResult).toMatchObject({ statusCode: 403 });
    expect(saveResult).toMatchObject({ statusCode: 403 });
    expect(deleteResult).toMatchObject({ statusCode: 403 });
    expect(progressRepository.findByUserAndQuiz).not.toHaveBeenCalled();
    expect(progressRepository.upsert).not.toHaveBeenCalled();
    expect(progressRepository.deleteByUserAndQuiz).not.toHaveBeenCalled();
  });

  it('allows admins to manage personal source progress', async () => {
    const { service, quizRepository, progressRepository } = createService();
    vi.mocked(quizRepository.findSummaryBySlug).mockResolvedValue({
      id: quizId,
      title: 'Personal quiz source',
      slug: 'private-quiz',
      author: 'another-user',
      questions: [],
      visibility: 'personal',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });
    vi.mocked(progressRepository.findByUserAndQuiz).mockResolvedValue(null);

    const result = await service.getSavedQuizProgress('private-quiz', userId, 'admin');

    assertOk(result);
    expect(result.data).toEqual({ progress: null });
    expect(progressRepository.findByUserAndQuiz).toHaveBeenCalledWith(userId, quizId);
  });

  it('never exposes correct answers when a personal source author starts playing', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findBySlug).mockResolvedValue({
      id: quizId,
      title: 'Personal quiz source',
      slug: 'private-quiz',
      author: userId,
      visibility: 'personal',
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

  it('blocks personal source content for a non-owner', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findBySlug).mockResolvedValue({
      id: quizId,
      title: 'Personal quiz source',
      slug: 'private-quiz',
      author: '507f191e810c19729de860ec',
      visibility: 'personal',
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
    expect(result).toMatchObject({ statusCode: 403 });
  });

  it('uses the authenticated session id when submitting attempts', async () => {
    const { service, quizRepository, userRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      visibility: 'public',
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
      visibility: 'public',
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
      undefined,
      'T'.repeat(43),
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
      visibility: 'public',
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

  it('rejects a guest submit without a claim token (RIN-921)', async () => {
    const { service, quizRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      visibility: 'public',
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
      id: 'attempt-2',
      score: 0,
      correctAnswers: 0,
      totalQuestions: 1,
    });

    const missing = await service.submitQuizAttempt(
      'quiz',
      [0],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a3',
      null,
    );
    assertFail(missing);
    expect(missing).toMatchObject({ statusCode: 400, error: 'User identification required' });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('stores only the claim-token hash for a guest token submit (RIN-912)', async () => {
    const { service, quizRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      visibility: 'public',
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
      id: 'attempt-3',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    const token = 'T'.repeat(43);

    const result = await service.submitQuizAttempt(
      'quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a4',
      null,
      undefined,
      token,
    );

    assertOk(result);
    const recorded = vi.mocked(attemptProgressRepository.recordSubmittedAttempt).mock.calls[0]?.[0];
    expect(recorded).toMatchObject({
      guestClaimTokenHash: createHash('sha256').update(token).digest('hex'),
    });
    expect(recorded).not.toHaveProperty('guestEmail');
    expect(recorded).not.toHaveProperty('userId');
    expect(JSON.stringify(recorded)).not.toContain(token);
  });

  it('stores the entry point on guest and signed-in attempts, and nothing without one (RIN-1256)', async () => {
    const { service, quizRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      visibility: 'public',
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
      id: 'attempt-4',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });
    const session = {
      user: { id: userId, email: 'learner@example.com', role: 'user' as const },
      expires: '2026-08-01T00:00:00.000Z',
    };
    const key = '018f7494-8bd8-7b8a-a387-3bc5a14f22a5';
    const blog = { entry: 'blog', post: 'on-thi-toeic' };

    assertOk(
      await service.submitQuizAttempt(
        'quiz',
        [1],
        key,
        null,
        undefined,
        'T'.repeat(43),
        undefined,
        blog,
      ),
    );
    assertOk(
      await service.submitQuizAttempt('quiz', [1], key, session, undefined, undefined, undefined, {
        entry: 'landing',
      }),
    );
    assertOk(await service.submitQuizAttempt('quiz', [1], key, session));
    assertOk(
      await service.submitQuizAttempt('quiz', [1], key, session, undefined, undefined, undefined, {
        entry: 'hub',
        topic: 'tieng-anh-lop-10',
      }),
    );

    const recorded = vi
      .mocked(attemptProgressRepository.recordSubmittedAttempt)
      .mock.calls.map(([data]) => data);
    expect(recorded[0]).toMatchObject({ guestClaimTokenHash: expect.any(String), ...blog });
    expect(recorded[1]).toMatchObject({ userId, entry: 'landing' });
    expect(recorded[1]).not.toHaveProperty('post');
    expect(recorded[2]).not.toHaveProperty('entry');
    expect(recorded[2]).not.toHaveProperty('post');
    expect(recorded[2]).not.toHaveProperty('topic');
    // RIN-1417: a hub card's topic slug rides along; nothing about the learner.
    expect(recorded[3]).toMatchObject({ userId, entry: 'hub', topic: 'tieng-anh-lop-10' });
    expect(recorded[3]).not.toHaveProperty('post');
  });

  it('resolves session email to a user id and returns 404 when unknown', async () => {
    const { service, quizRepository, userRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      visibility: 'public',
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
    vi.mocked(userRepository.findByEmail)
      .mockResolvedValueOnce({
        id: userId,
        email: 'learner@example.com',
        role: 'user',
        disable: 0,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
      .mockResolvedValueOnce(null);
    vi.mocked(attemptProgressRepository.recordSubmittedAttempt).mockResolvedValue({
      id: 'attempt-3',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });

    const resolved = await service.submitQuizAttempt(
      'quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a4',
      {
        user: { id: '', email: 'learner@example.com', role: 'user' },
        expires: '2026-08-01T00:00:00.000Z',
      },
      undefined,
    );
    assertOk(resolved);
    expect(attemptProgressRepository.recordSubmittedAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ userId }),
    );

    const missingUser = await service.submitQuizAttempt(
      'quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a5',
      {
        user: { id: '', email: 'missing@example.com', role: 'user' },
        expires: '2026-08-01T00:00:00.000Z',
      },
      undefined,
    );
    assertFail(missingUser);
    expect(missingUser).toMatchObject({ statusCode: 404, error: 'User not found' });
  });

  it('maps progress and flashcard unexpected failures to 500 responses', async () => {
    const { service, quizRepository, progressRepository } = createService();
    vi.mocked(quizRepository.findSummaryBySlug).mockRejectedValueOnce(new Error('db down'));
    await expect(service.getSavedQuizProgress('quiz', userId)).resolves.toMatchObject({
      success: false,
      statusCode: 500,
      error: 'Failed to get quiz progress',
    });

    vi.mocked(quizRepository.findSummaryBySlug).mockResolvedValue({
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      questions: [],
      visibility: 'public',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    });
    vi.mocked(progressRepository.upsert).mockRejectedValue(new Error('db down'));
    vi.mocked(progressRepository.deleteByUserAndQuiz).mockRejectedValue(new Error('db down'));
    vi.mocked(quizRepository.findForPlay).mockRejectedValue(new Error('db down'));
    vi.mocked(quizRepository.findBySlug).mockRejectedValue(new Error('db down'));

    await expect(service.saveQuizProgress('quiz', userId, savedProgress)).resolves.toMatchObject({
      success: false,
      statusCode: 500,
      error: 'Failed to save quiz progress',
    });
    await expect(service.deleteSavedQuizProgress('quiz', userId)).resolves.toMatchObject({
      success: false,
      statusCode: 500,
      error: 'Failed to delete quiz progress',
    });
    await expect(service.getQuizForFlashcards('quiz', null)).resolves.toMatchObject({
      success: false,
      statusCode: 500,
      error: 'Failed to get quiz for flashcards',
    });
    await expect(service.getQuizFlashcards('quiz', null)).resolves.toMatchObject({
      success: false,
      statusCode: 500,
      error: 'Failed to get quiz flashcards',
    });
    await expect(service.getQuizForPlay('quiz', 'user', userId)).resolves.toMatchObject({
      success: false,
      statusCode: 500,
      error: 'Internal server error',
    });
  });

  it('returns 404 when submit cannot load a playable quiz', async () => {
    const { service, quizRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue(null);

    const result = await service.submitQuizAttempt(
      'missing',
      [0],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a6',
      null,
      undefined,
      'T'.repeat(43),
    );

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 404, error: 'Quiz not found' });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();
  });

  it('blocks personal source submissions for non-owners and includes optional description snapshots', async () => {
    const { service, quizRepository, attemptProgressRepository } = createService();
    vi.mocked(quizRepository.findForPlay)
      .mockResolvedValueOnce({
        id: quizId,
        title: 'Personal quiz source',
        slug: 'private-quiz',
        author: '507f191e810c19729de860ec',
        visibility: 'personal',
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
      })
      .mockResolvedValueOnce({
        id: quizId,
        title: 'Public quiz',
        slug: 'public-quiz',
        description: 'Snapshot me',
        author: userId,
        visibility: 'public',
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
      id: 'attempt-4',
      score: 100,
      correctAnswers: 1,
      totalQuestions: 1,
    });

    const blocked = await service.submitQuizAttempt(
      'private-quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a7',
      {
        user: { id: userId, email: 'learner@example.com', role: 'user' },
        expires: '2026-08-01T00:00:00.000Z',
      },
    );
    assertFail(blocked);
    expect(blocked).toMatchObject({ statusCode: 403 });
    expect(attemptProgressRepository.recordSubmittedAttempt).not.toHaveBeenCalled();

    const withDescription = await service.submitQuizAttempt(
      'public-quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a8',
      {
        user: { id: userId, email: 'learner@example.com', role: 'user' },
        expires: '2026-08-01T00:00:00.000Z',
      },
    );
    assertOk(withDescription);
    expect(attemptProgressRepository.recordSubmittedAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        quizSnapshot: expect.objectContaining({
          description: 'Snapshot me',
          integrity: 'complete',
        }),
      }),
    );
  });

  it('maps idempotency conflicts to 409 and unexpected submit failures to 500', async () => {
    const { service, quizRepository, attemptProgressRepository } = createService();
    const playable: Quiz = {
      id: quizId,
      title: 'Quiz',
      slug: 'quiz',
      author: userId,
      visibility: 'public',
      questions: [
        {
          id: 'question-1',
          question: '2 + 2 = ?',
          options: ['3', '4'],
          correctIndex: 1,
          type: 'single' as const,
        },
      ],
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    };
    vi.mocked(quizRepository.findForPlay).mockResolvedValue(playable);

    const { QuizAttemptIdempotencyConflictError } = await import('@/errors/quiz-attempt');
    vi.mocked(attemptProgressRepository.recordSubmittedAttempt)
      .mockRejectedValueOnce(new QuizAttemptIdempotencyConflictError())
      .mockRejectedValueOnce(new Error('write failed'));

    const conflict = await service.submitQuizAttempt(
      'quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22a9',
      {
        user: { id: userId, email: 'learner@example.com', role: 'user' },
        expires: '2026-08-01T00:00:00.000Z',
      },
    );
    assertFail(conflict);
    expect(conflict).toMatchObject({
      statusCode: 409,
      error: 'Idempotency key was already used for a different quiz submission',
    });

    const unexpected = await service.submitQuizAttempt(
      'quiz',
      [1],
      '018f7494-8bd8-7b8a-a387-3bc5a14f22aa',
      {
        user: { id: userId, email: 'learner@example.com', role: 'user' },
        expires: '2026-08-01T00:00:00.000Z',
      },
    );
    assertFail(unexpected);
    expect(unexpected).toMatchObject({
      statusCode: 500,
      error: 'Failed to submit quiz attempt',
    });
  });

  it('returns access failures from flashcard reads without rewriting the message', async () => {
    const { service, quizRepository } = createService();
    vi.mocked(quizRepository.findForPlay).mockResolvedValue({
      id: quizId,
      title: 'Personal quiz source',
      slug: 'private-quiz',
      author: '507f191e810c19729de860ec',
      visibility: 'personal',
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

    const result = await service.getQuizFlashcards('private-quiz', {
      user: { id: userId, email: 'learner@example.com', role: 'user' },
      expires: '2026-08-01T00:00:00.000Z',
    });

    assertFail(result);
    expect(result).toMatchObject({ statusCode: 403 });
  });
});
