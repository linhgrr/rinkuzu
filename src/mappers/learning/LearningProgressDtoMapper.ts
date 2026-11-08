import type {
  LibraryQuiz,
  LibraryQuizCounts,
  QuestionReviewProgress,
  StreakFreezePurchaseResult,
  SubmitReviewOutcome,
} from '@/entities/LearningProgress';
import type {
  BuyStreakFreezeResponseDto,
  DueReviewListDto,
  DueReviewQuestionDto,
  LibraryListDto,
  LibraryQuizDto,
  SubmitReviewResponseDto,
} from '@/dtos/review';
import type { PaginationMeta } from '@/dtos/common';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function optionalDateOrNull(date: Date | null | undefined, fieldName: string): string | null {
  return serializeOptionalDate(date, fieldName) ?? null;
}

export class LearningProgressDtoMapper {
  static toLibraryListDto(
    quizzes: LibraryQuiz[],
    pagination: PaginationMeta,
    counts: LibraryQuizCounts,
  ): LibraryListDto {
    return {
      quizzes: quizzes.map(LearningProgressDtoMapper.toLibraryQuizDto),
      pagination,
      counts: { all: counts.all, inProgress: counts.inProgress, complete: counts.complete },
    };
  }

  static toDueReviewListDto(questions: QuestionReviewProgress[]): DueReviewListDto {
    return {
      questions: questions.map(LearningProgressDtoMapper.toDueQuestionDto),
      count: questions.length,
    };
  }

  static toLibraryQuizDto(quiz: LibraryQuiz): LibraryQuizDto {
    const author =
      quiz.author == null
        ? null
        : {
            id: quiz.author.id,
            ...(quiz.author.name !== undefined && { name: quiz.author.name }),
            ...(quiz.author.displayName !== undefined && {
              displayName: quiz.author.displayName,
            }),
            ...(quiz.author.avatar !== undefined && { avatar: quiz.author.avatar }),
          };

    return {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      ...(quiz.description !== undefined && { description: quiz.description }),
      author,
      folder: quiz.folder,
      questions: [],
      visibility: quiz.visibility,
      ...(quiz.pdfUrl !== undefined && { pdfUrl: quiz.pdfUrl }),
      questionCount: quiz.questionCount,
      ownedByMe: quiz.ownedByMe,
      createdAt: serializeDate(quiz.createdAt, 'quiz.createdAt'),
      updatedAt: serializeDate(quiz.updatedAt, 'quiz.updatedAt'),
      lastAttemptAt: optionalDateOrNull(quiz.lastAttemptAt, 'quiz.lastAttemptAt'),
      lastProgressAt: optionalDateOrNull(quiz.lastProgressAt, 'quiz.lastProgressAt'),
      libraryStatus: quiz.libraryStatus,
      displayDate: quiz.displayDate,
    };
  }

  static toDueQuestionDto(question: QuestionReviewProgress): DueReviewQuestionDto {
    return {
      id: question.id,
      userId: question.userId,
      quizSlug: question.quizSlug,
      questionId: question.questionId,
      ...(question.questionRef !== undefined && { questionRef: question.questionRef }),
      srsLevel: question.srsLevel,
      nextReviewDate: serializeDate(question.nextReviewDate, 'question.nextReviewDate'),
      lastReviewDate: optionalDateOrNull(question.lastReviewDate, 'question.lastReviewDate'),
      interval: question.interval,
      easeFactor: question.easeFactor,
      correctStreak: question.correctStreak,
      totalReviews: question.totalReviews,
      totalCorrect: question.totalCorrect,
      history: question.history.map((entry) => ({
        date: serializeDate(entry.date, 'question.history.date'),
        rating: entry.rating,
      })),
      notes: question.notes,
      createdAt: serializeDate(question.createdAt, 'question.createdAt'),
      updatedAt: serializeDate(question.updatedAt, 'question.updatedAt'),
    };
  }

  static toSubmitReviewResponse(outcome: SubmitReviewOutcome): SubmitReviewResponseDto {
    return {
      questionProgress: this.toDueQuestionDto(outcome.questionProgress),
      userProgress: outcome.userProgress,
    };
  }

  static toBuyStreakFreezeResponse(
    result: Extract<StreakFreezePurchaseResult, { status: 'purchased' }>,
  ): BuyStreakFreezeResponseDto {
    return {
      xp: result.xp,
      streakFreezeCount: result.streakFreezeCount,
    };
  }
}
