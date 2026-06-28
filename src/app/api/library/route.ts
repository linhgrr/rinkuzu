import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import FolderQuiz from '@/models/FolderQuiz';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import { logger } from '@/lib/logger';
import { buildPaginationMeta } from '@/repositories/pagination';
import { matchesLibraryFolder, resolveQuizLibraryActivity } from '@/lib/quiz/library';

type AttemptSummary = { _id: Types.ObjectId; lastAttemptAt: Date };
type ProgressSummary = { _id: Types.ObjectId; lastProgressAt: Date };

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  try {
    await connectDB();
    const userObjectId = new Types.ObjectId(userId);
    const url = new URL(request.url);
    const folderParam = url.searchParams.get('folder');
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 100));

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
        };
      })
      .filter((quiz) => {
        return matchesLibraryFolder(quiz.folder, folderParam);
      })
      .toSorted(
        (left, right) =>
          new Date(right.displayDate).getTime() - new Date(left.displayDate).getTime(),
      );

    const start = (page - 1) * limit;
    return apiOk({
      quizzes: library.slice(start, start + limit),
      pagination: buildPaginationMeta(page, limit, library.length),
    });
  } catch (error) {
    logger.error({ error }, 'Get quiz library error');
    return apiErr('internal_error', 'Failed to get quiz library', 500);
  }
});
