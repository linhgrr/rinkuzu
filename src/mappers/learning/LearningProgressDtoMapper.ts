import type {
  LibraryQuiz,
  QuestionReviewProgress,
  StreakFreezePurchaseResult,
  SubmitReviewOutcome,
} from '@/entities/LearningProgress';
import type {
  BuyStreakFreezeResponseDto,
  DueReviewQuestionDto,
  LibraryQuizDto,
  SubmitReviewResponseDto,
} from '@/dtos/review';
import { serializeDate, serializeOptionalDate } from '@/lib/date-serialization';

function optionalDateOrNull(date: Date | null | undefined, fieldName: string): string | null {
  return serializeOptionalDate(date, fieldName) ?? null;
}

export class LearningProgressDtoMapper {
  static toLibraryQuizDto(quiz: LibraryQuiz): LibraryQuizDto {
    return {
      id: quiz.id,
      title: quiz.title,
      slug: quiz.slug,
      description: quiz.description,
      author: quiz.author,
      folder: quiz.folder,
      questions: [],
      isPrivate: quiz.isPrivate,
      pdfUrl: quiz.pdfUrl,
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
      questionRef: question.questionRef,
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
      isBookmarked: question.isBookmarked,
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
