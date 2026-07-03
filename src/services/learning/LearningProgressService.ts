import { after } from 'next/server';
import type {
  BuyStreakFreezeResponseDto,
  DueReviewListDto,
  LibraryListDto,
  LibraryListQueryDto,
  SubmitReviewRequestDto,
  SubmitReviewResponseDto,
} from '@/dtos/review';
import type {
  QuestionReviewProgressDraft,
  SubmitReviewOutcome,
  UserLearningProgress,
} from '@/entities/LearningProgress';
import type { ILearningProgressRepository } from '@/interfaces/repositories/ILearningProgressRepository';
import type { ILearningProgressService } from '@/interfaces/services/ILearningProgressService';
import type { ServiceResult } from '@/interfaces/services/types';
import { buildPaginationMeta } from '@/lib/pagination';
import { matchesLibraryFolder } from '@/lib/quiz/library';
import { logger } from '@/lib/logger';
import type { SRSRating } from '@/entities/SpacedRepetition';
import { calculateNextReview } from '@/services/srs.service';
import { LearningProgressDtoMapper } from '@/mappers/learning/LearningProgressDtoMapper';
import { toUtcDateKey } from '@/lib/date-serialization';

const DUE_REVIEW_LIMIT = 50;
const STREAK_FREEZE_COST = 500;
const MAX_STREAK_FREEZES = 2;

interface ReviewActivityInput {
  now: Date;
  xpGain: number;
  answeredCorrectly: boolean;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function xpForRating(rating: SRSRating): number {
  switch (rating) {
    case 'easy':
      return 15;
    case 'good':
      return 10;
    case 'hard':
      return 5;
    case 'fail':
      return 2;
  }
}

function recomputeAverageAccuracy(progress: UserLearningProgress, now: Date): number {
  const last7Days = Array.from({ length: 7 }, (_, index) =>
    toUtcDateKey(addDays(now, index - 6), 'reviewActivity.date'),
  );
  let totalCorrect = 0;
  let totalReviews = 0;

  for (const key of last7Days) {
    const dayActivity = progress.weeklyActivity.get(key);
    if (!dayActivity) continue;
    totalCorrect += dayActivity.correctCount;
    totalReviews += dayActivity.totalCount;
  }

  return totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;
}

export class LearningProgressService implements ILearningProgressService {
  constructor(private readonly repository: ILearningProgressRepository) {}

  async listLibrary(
    userId: string,
    options: LibraryListQueryDto,
  ): Promise<ServiceResult<LibraryListDto>> {
    try {
      const library = (await this.repository.listLibraryQuizzes(userId))
        .filter((quiz) => matchesLibraryFolder(quiz.folder, options.folder))
        .toSorted(
          (left, right) =>
            new Date(right.displayDate).getTime() - new Date(left.displayDate).getTime(),
        );

      const start = (options.page - 1) * options.limit;
      return {
        success: true,
        data: LearningProgressDtoMapper.toLibraryListDto(
          library.slice(start, start + options.limit),
          buildPaginationMeta(options.page, options.limit, library.length),
        ),
      };
    } catch (error) {
      logger.error({ error, userId }, 'Get quiz library error');
      return {
        success: false,
        error: 'Failed to get quiz library',
        statusCode: 500,
      };
    }
  }

  async listDueReviews(userId: string): Promise<ServiceResult<DueReviewListDto>> {
    try {
      const questions = await this.repository.listDueQuestions(
        userId,
        new Date(),
        DUE_REVIEW_LIMIT,
      );
      return {
        success: true,
        data: LearningProgressDtoMapper.toDueReviewListDto(questions),
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error fetching due reviews');
      return {
        success: false,
        error: 'Internal Server Error',
        statusCode: 500,
      };
    }
  }

  async submitReview(
    userId: string,
    input: SubmitReviewRequestDto,
  ): Promise<ServiceResult<SubmitReviewResponseDto>> {
    try {
      const now = new Date();
      const [existingQuestionProgress, existingUserProgress] = await Promise.all([
        this.repository.findQuestionProgress(userId, input.quizSlug, input.questionId),
        this.repository.findUserProgress(userId),
      ]);

      const questionProgress: QuestionReviewProgressDraft = existingQuestionProgress ?? {
        userId,
        quizSlug: input.quizSlug,
        questionId: input.questionId,
        questionRef: input.questionRef,
        srsLevel: 0,
        nextReviewDate: now,
        lastReviewDate: null,
        interval: 0,
        easeFactor: 2.5,
        correctStreak: 0,
        totalReviews: 0,
        totalCorrect: 0,
        history: [],
      };

      if (input.questionRef) questionProgress.questionRef = input.questionRef;

      const srsResult = calculateNextReview(
        questionProgress.interval,
        questionProgress.easeFactor,
        input.rating,
      );

      questionProgress.interval = srsResult.interval;
      questionProgress.easeFactor = srsResult.easeFactor;
      questionProgress.nextReviewDate = srsResult.nextReviewDate;
      questionProgress.srsLevel = srsResult.srsLevel;
      questionProgress.lastReviewDate = now;
      questionProgress.totalReviews += 1;

      const answeredCorrectly = input.rating === 'good' || input.rating === 'easy';
      if (answeredCorrectly) {
        questionProgress.totalCorrect += 1;
        questionProgress.correctStreak += 1;
      } else {
        questionProgress.correctStreak = 0;
      }

      questionProgress.history.push({ date: now, rating: input.rating });

      const xpGain = xpForRating(input.rating);
      const userProgress =
        existingUserProgress ?? this.repository.createDefaultUserProgress(userId);
      const streakFreezeUsed = this.applyReviewActivity(userProgress, {
        now,
        xpGain,
        answeredCorrectly,
      });

      const [savedQuestionProgress, savedUserProgress] = await Promise.all([
        this.repository.saveQuestionProgress(questionProgress),
        this.repository.saveUserProgress(userProgress),
      ]);

      after(async () => {
        try {
          const totalQuestionsLearned = await this.repository.countLearnedQuestions(userId);
          await this.repository.updateTotalQuestionsLearned(userId, totalQuestionsLearned);
        } catch (error) {
          logger.error({ error, userId }, 'Recompute learned question count error');
        }
      });

      const outcome: SubmitReviewOutcome = {
        questionProgress: savedQuestionProgress,
        xpGained: xpGain,
        streakFreezeUsed,
        userProgress: {
          xp: savedUserProgress.totalXp,
          streak: savedUserProgress.currentStreak,
          xpGained: xpGain,
          streakFreezeUsed,
        },
      };

      return {
        success: true,
        data: LearningProgressDtoMapper.toSubmitReviewResponse(outcome),
      };
    } catch (error) {
      logger.error({ error, userId }, 'Error submitting review');
      return {
        success: false,
        error: 'Internal Server Error',
        statusCode: 500,
      };
    }
  }

  async buyStreakFreeze(userId: string): Promise<ServiceResult<BuyStreakFreezeResponseDto>> {
    try {
      const result = await this.repository.buyStreakFreeze(userId, {
        cost: STREAK_FREEZE_COST,
        maxFreezes: MAX_STREAK_FREEZES,
      });

      switch (result.status) {
        case 'purchased':
          return {
            success: true,
            data: LearningProgressDtoMapper.toBuyStreakFreezeResponse(result),
          };
        case 'not_found':
          return { success: false, error: 'User progress not found', statusCode: 404 };
        case 'max_freezes':
          return {
            success: false,
            error: 'You already have maximum streak freezes',
            statusCode: 400,
          };
        case 'not_enough_xp':
          return { success: false, error: 'Not enough XP', statusCode: 400 };
      }
    } catch (error) {
      logger.error({ error, userId }, 'Error buying freeze');
      return {
        success: false,
        error: 'Internal Server Error',
        statusCode: 500,
      };
    }
  }

  private applyReviewActivity(progress: UserLearningProgress, input: ReviewActivityInput): boolean {
    progress.totalXp += input.xpGain;

    let streakFreezeUsed = false;
    const today = toUtcDateKey(input.now, 'reviewActivity.now');
    const lastActive = toUtcDateKey(new Date(progress.lastActiveDate), 'progress.lastActiveDate');

    if (today !== lastActive) {
      const yesterday = toUtcDateKey(addDays(input.now, -1), 'yesterday');
      if (lastActive === yesterday) {
        progress.currentStreak += 1;
      } else {
        const twoDaysAgo = toUtcDateKey(addDays(input.now, -2), 'twoDaysAgo');
        if (lastActive === twoDaysAgo && progress.streakFreezeCount > 0) {
          progress.streakFreezeCount -= 1;
          progress.currentStreak += 1;
          streakFreezeUsed = true;
        } else {
          progress.currentStreak = 1;
        }
      }

      progress.lastActiveDate = input.now;
      if (progress.currentStreak > progress.longestStreak) {
        progress.longestStreak = progress.currentStreak;
      }
    } else {
      progress.lastActiveDate = input.now;
    }

    const currentActivity = progress.weeklyActivity.get(today) ?? {
      questionsReviewed: 0,
      xpEarned: 0,
      correctCount: 0,
      totalCount: 0,
    };
    currentActivity.questionsReviewed += 1;
    currentActivity.xpEarned += input.xpGain;
    currentActivity.totalCount += 1;
    if (input.answeredCorrectly) currentActivity.correctCount += 1;
    progress.weeklyActivity.set(today, currentActivity);

    progress.averageAccuracy = recomputeAverageAccuracy(progress, input.now);

    const lastSessionDate = progress.lastSessionDate
      ? toUtcDateKey(progress.lastSessionDate, 'progress.lastSessionDate')
      : null;
    if (lastSessionDate !== today) {
      progress.totalReviewSessions += 1;
      progress.lastSessionDate = input.now;
    }

    return streakFreezeUsed;
  }
}
