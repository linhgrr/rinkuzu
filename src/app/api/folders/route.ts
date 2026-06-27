import { NextRequest } from 'next/server';
import { isValidObjectId, Types } from 'mongoose';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import connectDB from '@/lib/mongoose';
import Folder from '@/models/Folder';
import FolderQuiz from '@/models/FolderQuiz';
import Quiz from '@/models/Quiz';
import Attempt from '@/models/Attempt';
import QuizProgress from '@/models/QuizProgress';
import { logger } from '@/lib/logger';

const normalizeName = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  try {
    if (!isValidObjectId(userId)) return apiErr('unauthorized', 'Unauthorized', 401);
    await connectDB();

    const [folders, ownedUnfiledCount, linkedCounts, attempts, progressRecords] = await Promise.all(
      [
        Folder.aggregate([
          { $match: { owner: new Types.ObjectId(userId) } },
          {
            $lookup: {
              from: 'quizzes',
              let: { folderId: '$_id', ownerId: '$owner' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [{ $eq: ['$folder', '$$folderId'] }, { $eq: ['$author', '$$ownerId'] }],
                    },
                  },
                },
                { $count: 'count' },
              ],
              as: 'quizStats',
            },
          },
          {
            $project: {
              name: 1,
              createdAt: 1,
              updatedAt: 1,
              quizCount: { $ifNull: [{ $first: '$quizStats.count' }, 0] },
            },
          },
          { $sort: { name: 1 } },
        ]),
        Quiz.countDocuments({ author: userId, folder: null }),
        FolderQuiz.aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { owner: new Types.ObjectId(userId) } },
          { $group: { _id: '$folder', count: { $sum: 1 } } },
        ]),
        Attempt.aggregate<{ _id: Types.ObjectId }>([
          { $match: { user: { $in: [userId, new Types.ObjectId(userId)] } } },
          { $group: { _id: '$quiz' } },
        ]),
        QuizProgress.aggregate<{ _id: Types.ObjectId }>([
          { $match: { userId } },
          { $group: { _id: '$quiz' } },
        ]),
      ],
    );

    const libraryQuizIds = [
      ...new Map(
        [...attempts, ...progressRecords].map((record) => [String(record._id), record._id]),
      ).values(),
    ];
    const [attemptedQuizzes, linkedQuizIds] = await Promise.all([
      Quiz.find({ _id: { $in: libraryQuizIds }, author: { $ne: userId }, status: 'published' })
        .select('_id')
        .lean(),
      FolderQuiz.find({ owner: userId }).distinct('quiz'),
    ]);
    const linkedQuizSet = new Set(linkedQuizIds.map(String));
    const externalUnfiledCount = attemptedQuizzes.filter(
      (quiz) => !linkedQuizSet.has(String(quiz._id)),
    ).length;
    const linkedCountByFolder = new Map(linkedCounts.map((item) => [String(item._id), item.count]));

    return apiOk({
      folders: folders.map((folder) => ({
        ...folder,
        quizCount: folder.quizCount + (linkedCountByFolder.get(String(folder._id)) ?? 0),
      })),
      unfiledCount: ownedUnfiledCount + externalUnfiledCount,
    });
  } catch (error) {
    logger.error({ error }, 'Get folders error');
    return apiErr('internal_error', 'Failed to get folders', 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  try {
    const name = normalizeName((await request.json())?.name);
    if (!name) return apiErr('validation_error', 'Folder name is required', 400);
    if (name.length > 100) {
      return apiErr('validation_error', 'Folder name cannot exceed 100 characters', 400);
    }

    await connectDB();
    const folder = await Folder.create({ name, owner: userId });
    return apiOk({ ...folder.toObject(), quizCount: 0 }, 201);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return apiErr('validation_error', 'A folder with this name already exists', 409);
    }
    logger.error({ error }, 'Create folder error');
    return apiErr('internal_error', 'Failed to create folder', 500);
  }
});
