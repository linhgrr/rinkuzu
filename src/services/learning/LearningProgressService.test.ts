import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ILearningProgressRepository } from '@/interfaces/repositories/ILearningProgressRepository';
import type {
  LibraryQuiz,
  QuestionReviewProgress,
  QuestionReviewProgressDraft,
  UserLearningProgress,
} from '@/entities/LearningProgress';
import { LearningProgressService } from '@/services/learning/LearningProgressService';

const deferredTasks: Array<() => Promise<void>> = [];

vi.mock('next/server', () => ({
  after: vi.fn((task: () => Promise<void>) => {
    deferredTasks.push(task);
  }),
}));

const now = new Date('2026-06-30T10:00:00.000Z');
const userId = '507f191e810c19729de860ea';

function libraryQuiz(overrides: Partial<LibraryQuiz> = {}): LibraryQuiz {
  return {
    id: '507f1f77bcf86cd799439011',
    title: 'Algorithms',
    slug: 'algorithms',
    description: 'Practice',
    author: { id: userId },
    folder: null,
    isPrivate: false,
    questionCount: 2,
    ownedByMe: true,
    createdAt: new Date('2026-06-29T10:00:00.000Z'),
    updatedAt: new Date('2026-06-29T10:00:00.000Z'),
    lastAttemptAt: null,
    lastProgressAt: null,
    libraryStatus: 'not_started',
    displayDate: '2026-06-29T10:00:00.000Z',
    ...overrides,
  };
}

function questionProgress(overrides: Partial<QuestionReviewProgress> = {}): QuestionReviewProgress {
  return {
    id: '507f1f77bcf86cd799439012',
    userId,
    quizSlug: 'algorithms',
    questionId: 'q1',
    questionRef: {
      text: '2 + 2?',
      options: ['3', '4'],
      correctIndexes: [1],
    },
    srsLevel: 0,
    nextReviewDate: now,
    lastReviewDate: null,
    interval: 0,
    easeFactor: 2.5,
    correctStreak: 0,
    totalReviews: 0,
    totalCorrect: 0,
    history: [],
    isBookmarked: false,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function userProgress(overrides: Partial<UserLearningProgress> = {}): UserLearningProgress {
  return {
    userId,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: new Date('2026-06-29T10:00:00.000Z'),
    streakFreezeCount: 1,
    totalXp: 100,
    totalQuestionsLearned: 0,
    totalQuizzesTaken: 0,
    totalReviewSessions: 0,
    lastSessionDate: null,
    averageAccuracy: 0,
    weeklyActivity: new Map(),
    ...overrides,
  };
}

class LearningProgressRepositoryStub implements ILearningProgressRepository {
  listLibraryQuizzes = vi.fn<
    (
      userId: string,
      options: { folder?: string | null; page: number; limit: number },
    ) => Promise<{
      items: LibraryQuiz[];
      pagination: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    }>
  >();
  listDueQuestions =
    vi.fn<(userId: string, now: Date, limit: number) => Promise<QuestionReviewProgress[]>>();
  findQuestionProgress =
    vi.fn<
      (
        userId: string,
        quizSlug: string,
        questionId: string,
      ) => Promise<QuestionReviewProgress | null>
    >();
  saveQuestionProgress =
    vi.fn<(progress: QuestionReviewProgressDraft) => Promise<QuestionReviewProgress>>();
  findUserProgress = vi.fn<(userId: string) => Promise<UserLearningProgress | null>>();
  createDefaultUserProgress = vi.fn<(userId: string) => UserLearningProgress>();
  saveUserProgress = vi.fn<(progress: UserLearningProgress) => Promise<UserLearningProgress>>();
  buyStreakFreeze =
    vi.fn<
      (
        userId: string,
        options: { cost: number; maxFreezes: number },
      ) => Promise<
        | { status: 'not_found' }
        | { status: 'max_freezes' }
        | { status: 'not_enough_xp' }
        | { status: 'purchased'; xp: number; streakFreezeCount: number }
      >
    >();
  countLearnedQuestions = vi.fn<(userId: string) => Promise<number>>();
  updateTotalQuestionsLearned =
    vi.fn<(userId: string, totalQuestionsLearned: number) => Promise<void>>();
}

describe('LearningProgressService', () => {
  let repository: LearningProgressRepositoryStub;
  let service: LearningProgressService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    deferredTasks.length = 0;
    repository = new LearningProgressRepositoryStub();
    service = new LearningProgressService(repository);
    repository.createDefaultUserProgress.mockImplementation((id) => userProgress({ userId: id }));
    repository.countLearnedQuestions.mockResolvedValue(7);
    repository.updateTotalQuestionsLearned.mockResolvedValue();
  });

  it('filters, sorts, paginates and maps library quizzes without leaking questions', async () => {
    repository.listLibraryQuizzes.mockResolvedValue({
      items: [
        libraryQuiz({
          id: 'new',
          folder: 'folder-a',
          displayDate: '2026-06-30T10:00:00.000Z',
          lastProgressAt: now,
          libraryStatus: 'in_progress',
        }),
      ],
      pagination: {
        currentPage: 1,
        totalPages: 2,
        totalItems: 2,
        itemsPerPage: 1,
        hasNextPage: true,
        hasPrevPage: false,
      },
    });

    const result = await service.listLibrary(userId, { folder: 'folder-a', page: 1, limit: 1 });

    expect(repository.listLibraryQuizzes).toHaveBeenCalledWith(userId, {
      folder: 'folder-a',
      page: 1,
      limit: 1,
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(result.data.quizzes).toEqual([
      expect.objectContaining({
        id: 'new',
        folder: 'folder-a',
        questions: [],
        questionCount: 2,
        lastProgressAt: now.toISOString(),
      }),
    ]);
    expect(result.data.pagination).toEqual({
      currentPage: 1,
      totalPages: 2,
      totalItems: 2,
      itemsPerPage: 1,
      hasNextPage: true,
      hasPrevPage: false,
    });
  });

  it('returns due review questions as DTOs', async () => {
    repository.listDueQuestions.mockResolvedValue([questionProgress()]);

    const result = await service.listDueReviews(userId);

    expect(repository.listDueQuestions).toHaveBeenCalledWith(userId, now, 50);
    expect(result).toEqual({
      success: true,
      data: {
        questions: [
          expect.objectContaining({
            id: '507f1f77bcf86cd799439012',
            nextReviewDate: now.toISOString(),
            history: [],
          }),
        ],
        count: 1,
      },
    });
  });

  it('submits a good review, updates learning progress and defers learned count recompute', async () => {
    repository.findQuestionProgress.mockResolvedValue(questionProgress());
    repository.findUserProgress.mockResolvedValue(userProgress());
    repository.saveQuestionProgress.mockImplementation(async (progress) => ({
      ...progress,
      id: '507f1f77bcf86cd799439012',
      isBookmarked: progress.isBookmarked ?? false,
      notes: progress.notes ?? '',
      createdAt: now,
      updatedAt: now,
    }));
    repository.saveUserProgress.mockImplementation(async (progress) => progress);

    const result = await service.submitReview(userId, {
      questionId: 'q1',
      quizSlug: 'algorithms',
      rating: 'good',
      questionRef: {
        text: '2 + 2?',
        options: ['3', '4'],
        correctIndexes: [1],
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(repository.saveQuestionProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        interval: 1,
        srsLevel: 1,
        totalReviews: 1,
        totalCorrect: 1,
        correctStreak: 1,
        history: [{ date: now, rating: 'good' }],
      }),
    );
    expect(repository.saveUserProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStreak: 1,
        longestStreak: 1,
        totalXp: 110,
        totalReviewSessions: 1,
        averageAccuracy: 100,
      }),
    );
    expect(result.data.userProgress).toEqual({
      xp: 110,
      streak: 1,
      xpGained: 10,
      streakFreezeUsed: false,
    });

    expect(deferredTasks).toHaveLength(1);
    await deferredTasks[0]?.();
    expect(repository.updateTotalQuestionsLearned).toHaveBeenCalledWith(userId, 7);
  });

  it('uses streak freeze when the user missed exactly one day', async () => {
    repository.findQuestionProgress.mockResolvedValue(questionProgress());
    repository.findUserProgress.mockResolvedValue(
      userProgress({ lastActiveDate: new Date('2026-06-28T10:00:00.000Z') }),
    );
    repository.saveQuestionProgress.mockImplementation(async (progress) => ({
      ...progress,
      id: '507f1f77bcf86cd799439012',
      isBookmarked: progress.isBookmarked ?? false,
      notes: progress.notes ?? '',
      createdAt: now,
      updatedAt: now,
    }));
    repository.saveUserProgress.mockImplementation(async (progress) => progress);

    const result = await service.submitReview(userId, {
      questionId: 'q1',
      quizSlug: 'algorithms',
      rating: 'hard',
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    expect(repository.saveUserProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        currentStreak: 1,
        streakFreezeCount: 0,
        totalXp: 105,
      }),
    );
    expect(result.data.userProgress.streakFreezeUsed).toBe(true);
  });

  it('maps streak-freeze purchase outcomes to service results', async () => {
    repository.buyStreakFreeze
      .mockResolvedValueOnce({ status: 'purchased', xp: 500, streakFreezeCount: 1 })
      .mockResolvedValueOnce({ status: 'not_enough_xp' })
      .mockResolvedValueOnce({ status: 'max_freezes' })
      .mockResolvedValueOnce({ status: 'not_found' });

    await expect(service.buyStreakFreeze(userId)).resolves.toEqual({
      success: true,
      data: { xp: 500, streakFreezeCount: 1 },
    });
    await expect(service.buyStreakFreeze(userId)).resolves.toEqual({
      success: false,
      error: 'Not enough XP',
      statusCode: 400,
    });
    await expect(service.buyStreakFreeze(userId)).resolves.toEqual({
      success: false,
      error: 'You already have maximum streak freezes',
      statusCode: 400,
    });
    await expect(service.buyStreakFreeze(userId)).resolves.toEqual({
      success: false,
      error: 'User progress not found',
      statusCode: 404,
    });
  });
});
