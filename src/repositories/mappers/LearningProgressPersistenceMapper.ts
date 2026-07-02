import type {
  DailyLearningActivity,
  LibraryQuiz,
  LibraryQuizAuthor,
  QuestionReviewProgress,
  UserLearningProgress,
} from '@/entities/LearningProgress';
import { resolveQuizLibraryActivity } from '@/lib/quiz/library';
import { serializeId } from '@/lib/mongo-id';
import type {
  LibraryQuizAuthorPersistenceRecord,
  LibraryQuizMappingContext,
  LibraryQuizPersistenceRecord,
  QuestionProgressPersistenceRecord,
  UserProgressPersistenceRecord,
} from '@/repositories/types/LearningProgressPersistence';
import type { MongoIdLike } from '@/types/mongo';

function mapAuthor(
  author: MongoIdLike | LibraryQuizAuthorPersistenceRecord | null,
): LibraryQuizAuthor | null {
  if (!author) return null;
  if (typeof author === 'object' && '_id' in author) {
    return {
      id: serializeId(author._id, 'quiz.author._id'),
      email: author.email,
      name: author.name,
      displayName: author.displayName,
      avatar: author.avatar,
    };
  }
  return { id: serializeId(author, 'quiz.author') };
}

function mapWeeklyActivity(
  value: UserProgressPersistenceRecord['weeklyActivity'],
): Map<string, DailyLearningActivity> {
  if (value instanceof Map) return new Map(value);
  return new Map(Object.entries(value));
}

function requirePositiveFiniteNumber(value: number, field: string): number {
  if (Number.isFinite(value) && value > 0) return value;
  throw new TypeError(`${field} must be a positive finite number`);
}

export class LearningProgressPersistenceMapper {
  static toLibraryQuiz(
    record: LibraryQuizPersistenceRecord,
    context: LibraryQuizMappingContext,
  ): LibraryQuiz {
    const id = serializeId(record._id, 'quiz._id');
    const author = mapAuthor(record.author);
    const ownedByMe = author?.id === context.userId;
    const folder = ownedByMe
      ? record.folder
        ? String(record.folder)
        : null
      : context.linkedFolderId;
    const activity = resolveQuizLibraryActivity(
      record.createdAt,
      context.lastAttemptAt ?? undefined,
      context.lastProgressAt ?? undefined,
    );

    return {
      id,
      title: record.title,
      slug: record.slug,
      description: record.description,
      author,
      folder,
      isPrivate: record.isPrivate,
      pdfUrl: record.pdfUrl,
      questionCount: record.questions.length,
      ownedByMe,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAttemptAt: context.lastAttemptAt,
      lastProgressAt: context.lastProgressAt,
      ...activity,
    };
  }

  static toQuestionProgress(record: QuestionProgressPersistenceRecord): QuestionReviewProgress {
    return {
      id: serializeId(record._id, 'questionProgress._id'),
      userId: record.userId,
      quizSlug: record.quizSlug,
      questionId: record.questionId,
      questionRef: record.questionRef,
      srsLevel: record.srsLevel,
      nextReviewDate: record.nextReviewDate,
      lastReviewDate: record.lastReviewDate,
      interval: record.interval,
      easeFactor: requirePositiveFiniteNumber(record.easeFactor, 'questionProgress.easeFactor'),
      correctStreak: record.correctStreak,
      totalReviews: record.totalReviews,
      totalCorrect: record.totalCorrect,
      history: record.history,
      isBookmarked: record.isBookmarked,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toUserProgress(record: UserProgressPersistenceRecord): UserLearningProgress {
    return {
      userId: record.userId,
      currentStreak: record.currentStreak,
      longestStreak: record.longestStreak,
      lastActiveDate: record.lastActiveDate,
      streakFreezeCount: record.streakFreezeCount,
      totalXp: record.totalXp,
      totalQuestionsLearned: record.totalQuestionsLearned,
      totalQuizzesTaken: record.totalQuizzesTaken,
      totalReviewSessions: record.totalReviewSessions,
      lastSessionDate: record.lastSessionDate,
      averageAccuracy: record.averageAccuracy,
      weeklyActivity: mapWeeklyActivity(record.weeklyActivity),
    };
  }
}
