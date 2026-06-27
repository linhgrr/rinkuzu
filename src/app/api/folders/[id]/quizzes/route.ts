import { NextRequest } from 'next/server';
import { isValidObjectId, Types } from 'mongoose';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import Folder from '@/models/Folder';
import FolderQuiz from '@/models/FolderQuiz';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import { logger } from '@/lib/logger';

export const POST = withAuth<{ id: string }>(async (request: NextRequest, { params, userId }) => {
  try {
    const { quizId } = await request.json();
    if (!isValidObjectId(quizId)) {
      return apiErr('validation_error', 'Invalid quiz id', 400);
    }
    const isDefault = params.id === 'default';
    if (!isDefault && !isValidObjectId(params.id)) {
      return apiErr('validation_error', 'Invalid folder id', 400);
    }

    await connectDB();
    const [rawQuiz, rawFolder, attempted, inProgress] = await Promise.all([
      Quiz.findById(quizId).select('_id author status').lean(),
      isDefault
        ? Promise.resolve(null)
        : Folder.findOne({ _id: params.id, owner: userId }).select('_id').lean(),
      Attempt.exists({ user: { $in: [userId, new Types.ObjectId(userId)] }, quiz: quizId }),
      QuizProgress.exists({ userId, quiz: quizId }),
    ]);
    const quiz = rawQuiz as unknown as {
      _id: Types.ObjectId;
      author: Types.ObjectId;
      status: string;
    } | null;
    const folder = rawFolder as unknown as { _id: Types.ObjectId } | null;
    if (!quiz || (!folder && !isDefault)) {
      return apiErr('not_found', !quiz ? 'Quiz not found' : 'Folder not found', 404);
    }

    const ownedByMe = String(quiz.author) === userId;
    if (!ownedByMe && ((!attempted && !inProgress) || quiz.status !== 'published')) {
      return apiErr('forbidden', 'Only owned or completed quizzes can be added', 403);
    }

    if (ownedByMe) {
      await Promise.all([
        Quiz.updateOne({ _id: quizId, author: userId }, { $set: { folder: folder?._id ?? null } }),
        FolderQuiz.deleteOne({ owner: userId, quiz: quizId }),
      ]);
    } else if (isDefault) {
      await FolderQuiz.deleteOne({ owner: userId, quiz: quizId });
    } else {
      await FolderQuiz.updateOne(
        { owner: userId, quiz: quizId },
        { $set: { folder: folder?._id } },
        { upsert: true },
      );
    }

    return apiOk(null, 200, { meta: { message: 'Quiz added to folder' } });
  } catch (error) {
    logger.error({ error }, 'Add quiz to folder error');
    return apiErr('internal_error', 'Failed to add quiz to folder', 500);
  }
});
