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
import { mapOptionalUserProfileFields } from '@/repositories/mappers/mapOptionalUserProfileFields';
import type { MongoIdLike } from '@/types/mongo';

function mapAuthor(
  author: MongoIdLike | LibraryQuizAuthorPersistenceRecord | null,
): LibraryQuizAuthor | null {
  if (!author) return null;
  if (typeof author === 'object' && '_id' in author) {
    return {
      id: serializeId(author._id, 'quiz.author._id'),
      ...(author.email === undefined ? {} : { email: author.email }),
      ...mapOptionalUserProfileFields(author),
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
      author,
      folder,
      isPrivate: record.isPrivate,
      questionCount: record.questionCount ?? record.questions?.length ?? 0,
      ownedByMe,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      lastAttemptAt: context.lastAttemptAt,
      lastProgressAt: context.lastProgressAt,
      ...(record.description === undefined ? {} : { description: record.description }),
      ...(record.pdfUrl === undefined ? {} : { pdfUrl: record.pdfUrl }),
      ...activity,
    };
  }

  static toQuestionProgress(record: QuestionProgressPersistenceRecord): QuestionReviewProgress {
    return {
      id: serializeId(record._id, 'questionProgress._id'),
      userId: record.userId,
      quizSlug: record.quizSlug,
      questionId: record.questionId,
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
      ...(record.questionRef === undefined ? {} : { questionRef: record.questionRef }),
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
