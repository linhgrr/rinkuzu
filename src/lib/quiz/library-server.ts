import 'server-only';

import { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import FolderQuiz from '@/models/FolderQuiz';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import { matchesLibraryFolder, resolveQuizLibraryActivity } from '@/lib/quiz/library';
import { buildPaginationMeta } from '@/repositories/pagination';
import type { IQuiz, PaginationMeta } from '@/types';

type AttemptSummary = { _id: Types.ObjectId; lastAttemptAt: Date };
type ProgressSummary = { _id: Types.ObjectId; lastProgressAt: Date };

export type QuizLibraryItem = IQuiz & {
  displayDate?: string;
  lastAttemptAt?: string | null;
  lastProgressAt?: string | null;
  ownedByMe?: boolean;
  libraryStatus?: ReturnType<typeof resolveQuizLibraryActivity>['libraryStatus'];
};

export type QuizLibraryResult = {
  quizzes: QuizLibraryItem[];
  pagination: PaginationMeta;
};

export async function getQuizLibraryForUser({
  userId,
  folder,
  page = 1,
  limit = 100,
}: {
  userId: string;
  folder?: string | null;
  page?: number;
  limit?: number;
}): Promise<QuizLibraryResult> {
  await connectDB();

  const userObjectId = new Types.ObjectId(userId);
  const normalizedPage = Math.max(1, page);
  const normalizedLimit = Math.min(100, Math.max(1, limit));

  const [attempts, progressRecords] = await Promise.all([
    Attempt.aggregate<AttemptSummary>([
      { $match: { user: { $in: [userId, userObjectId] } } },
      { $group: { _id: '$quiz', lastAttemptAt: { $max: '$takenAt' } } },
    ]),
    QuizProgress.aggregate<ProgressSummary>([
      { $match: { userId } },
      { $group: { _id: '$quiz', lastProgressAt: { $max: '$updatedAt' } } },
    ]),
  ]);

  const attemptedIds = attempts.map((attempt) => attempt._id);
  const inProgressIds = progressRecords.map((progress) => progress._id);

  const [rawQuizDocuments, rawFolderLinks] = await Promise.all([
    Quiz.find({
      $or: [{ author: userObjectId }, { _id: { $in: [...attemptedIds, ...inProgressIds] } }],
    })
      .populate('author', 'email name displayName avatar')
      .lean(),
    FolderQuiz.find({ owner: userObjectId }).lean(),
  ]);

  const rawQuizzes = rawQuizDocuments as unknown as Array<Record<string, unknown>>;
  const folderLinks = rawFolderLinks as unknown as Array<{
    quiz: Types.ObjectId;
    folder: Types.ObjectId;
  }>;

  const lastAttemptByQuiz = new Map(
    attempts.map((attempt) => [String(attempt._id), attempt.lastAttemptAt]),
  );
  const lastProgressByQuiz = new Map(
    progressRecords.map((progress) => [String(progress._id), progress.lastProgressAt]),
  );
  const linkedFolderByQuiz = new Map(
    folderLinks.map((link) => [String(link.quiz), String(link.folder)]),
  );

  const library = rawQuizzes
    .map((quiz) => {
      const quizId = String(quiz['_id']);
      const author = quiz['author'] as { _id?: Types.ObjectId } | Types.ObjectId;
      const ownedByMe =
        String(typeof author === 'object' && '_id' in author ? author._id : author) === userId;
      const folderId = ownedByMe
        ? quiz['folder']
          ? String(quiz['folder'])
          : null
        : (linkedFolderByQuiz.get(quizId) ?? null);
      const lastAttemptAt = lastAttemptByQuiz.get(quizId);
      const lastProgressAt = lastProgressByQuiz.get(quizId);
      const activity = resolveQuizLibraryActivity(
        quiz['createdAt'] as Date,
        lastAttemptAt,
        lastProgressAt,
      );

      return {
        ...quiz,
        _id: quizId,
        folder: folderId,
        questions: [],
        questionCount: Array.isArray(quiz['questions']) ? quiz['questions'].length : 0,
        ownedByMe,
        lastAttemptAt: lastAttemptAt?.toISOString() ?? null,
        lastProgressAt: lastProgressAt?.toISOString() ?? null,
        ...activity,
      } as unknown as QuizLibraryItem;
    })
    .filter((quiz) => matchesLibraryFolder(quiz.folder ?? null, folder ?? null))
    .toSorted(
      (left, right) =>
        new Date(right.displayDate ?? 0).getTime() - new Date(left.displayDate ?? 0).getTime(),
    );

  const start = (normalizedPage - 1) * normalizedLimit;

  return {
    quizzes: library.slice(start, start + normalizedLimit),
    pagination: buildPaginationMeta(normalizedPage, normalizedLimit, library.length),
  };
}
