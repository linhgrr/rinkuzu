import mongoose, { Types } from 'mongoose';
import connectDB from '@/lib/mongoose';
import Attempt from '@/models/Attempt';
import FolderModel from '@/models/Folder';
import FolderQuiz from '@/models/FolderQuiz';
import Quiz from '@/models/Quiz';
import QuizProgress from '@/models/QuizProgress';
import { isMongoDuplicateKeyError } from '@/lib/mongoose-errors';
import { FolderNameConflictError, type Folder, type QuizFolderAccess } from '@/entities/Folder';
import type {
  CreateFolderData,
  FolderOverviewResult,
  IFolderRepository,
} from '@/interfaces/repositories/IFolderRepository';
import { FolderPersistenceMapper } from '@/repositories/mappers/FolderPersistenceMapper';
import type {
  FolderOverviewPersistenceRecord,
  FolderPersistenceRecord,
} from '@/repositories/types/FolderPersistence';

export class FolderRepository implements IFolderRepository {
  async listOverviewByOwner(ownerId: string): Promise<FolderOverviewResult> {
    await connectDB();
    const ownerObjectId = new Types.ObjectId(ownerId);
    const [folders, linkedCounts, unfiledCounts] = await Promise.all([
      FolderModel.aggregate<FolderOverviewPersistenceRecord>([
        { $match: { owner: ownerObjectId } },
        {
          $project: {
            name: 1,
            owner: 1,
            createdAt: 1,
            updatedAt: 1,
            quizCount: { $literal: 0 },
          },
        },
        { $sort: { name: 1 } },
      ]),
      FolderQuiz.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { owner: ownerObjectId } },
        { $group: { _id: '$folder', count: { $sum: 1 } } },
      ]),
      Attempt.aggregate<{ count: number }>([
        { $match: { user: ownerObjectId } },
        { $group: { _id: '$quiz' } },
        {
          $unionWith: {
            coll: 'quizzes',
            pipeline: [{ $match: { author: ownerObjectId } }, { $project: { _id: 1 } }],
          },
        },
        {
          $unionWith: {
            coll: 'quizprogresses',
            pipeline: [{ $match: { userId: ownerObjectId } }, { $group: { _id: '$quiz' } }],
          },
        },
        { $group: { _id: '$_id' } },
        {
          $lookup: {
            from: 'folderquizzes',
            let: { quizId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ['$quiz', '$$quizId'] }, { $eq: ['$owner', ownerObjectId] }],
                  },
                },
              },
              { $limit: 1 },
            ],
            as: 'folderLinks',
          },
        },
        { $match: { folderLinks: { $eq: [] } } },
        { $count: 'count' },
      ]),
    ]);
    const unfiledCount = unfiledCounts[0]?.count ?? 0;
    const linkedCountByFolder = new Map(linkedCounts.map((item) => [String(item._id), item.count]));

    return {
      folders: folders.map((folder) =>
        FolderPersistenceMapper.toOverview({
          ...folder,
          quizCount: linkedCountByFolder.get(String(folder._id)) ?? 0,
        }),
      ),
      unfiledCount,
    };
  }

  async create(data: CreateFolderData): Promise<Folder> {
    await connectDB();
    try {
      const folder = await FolderModel.create({
        name: data.name,
        owner: new Types.ObjectId(data.ownerId),
      });
      return FolderPersistenceMapper.toEntity({
        _id: folder._id,
        name: folder.name,
        owner: folder.owner,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      });
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) throw new FolderNameConflictError();
      throw error;
    }
  }

  async findOwnedById(folderId: string, ownerId: string): Promise<Folder | null> {
    await connectDB();
    if (!Types.ObjectId.isValid(folderId) || !Types.ObjectId.isValid(ownerId)) return null;
    const folder = await FolderModel.findOne({
      _id: new Types.ObjectId(folderId),
      owner: new Types.ObjectId(ownerId),
    }).lean<FolderPersistenceRecord>();
    return folder ? FolderPersistenceMapper.toEntity(folder) : null;
  }

  async existsOwnedById(folderId: string, ownerId: string): Promise<boolean> {
    await connectDB();
    if (!Types.ObjectId.isValid(folderId) || !Types.ObjectId.isValid(ownerId)) return false;
    const folder = await FolderModel.exists({
      _id: new Types.ObjectId(folderId),
      owner: new Types.ObjectId(ownerId),
    });
    return Boolean(folder);
  }

  async rename(folderId: string, ownerId: string, name: string): Promise<Folder | null> {
    await connectDB();
    try {
      const folder = await FolderModel.findOneAndUpdate(
        { _id: new Types.ObjectId(folderId), owner: new Types.ObjectId(ownerId) },
        { $set: { name } },
        { new: true, runValidators: true },
      ).lean<FolderPersistenceRecord>();
      return folder ? FolderPersistenceMapper.toEntity(folder) : null;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) throw new FolderNameConflictError();
      throw error;
    }
  }

  async deleteOwned(folderId: string, ownerId: string): Promise<boolean> {
    await connectDB();
    const folderObjectId = new Types.ObjectId(folderId);
    const ownerObjectId = new Types.ObjectId(ownerId);
    const session = await mongoose.startSession();

    try {
      // Return the callback's result: withTransaction retries on a transient
      // error, and a captured outer variable keeps the losing attempt's value.
      // Here that mattered -- an attempt that set deleted = true and then
      // aborted, followed by a retry taking the `if (!folder) return` path,
      // reported a deletion that never happened.
      return await session.withTransaction(async () => {
        const folder = await FolderModel.findOne({
          _id: folderObjectId,
          owner: ownerObjectId,
        })
          .select('_id')
          .session(session)
          .lean<{ _id: Types.ObjectId }>();
        if (!folder) return false;

        await FolderQuiz.deleteMany({ owner: ownerObjectId, folder: folderObjectId }).session(
          session,
        );
        const result = await FolderModel.deleteOne({
          _id: folderObjectId,
          owner: ownerObjectId,
        }).session(session);
        return result.deletedCount === 1;
      });
    } finally {
      await session.endSession();
    }
  }

  async findQuizAccess(userId: string, quizId: string): Promise<QuizFolderAccess | null> {
    await connectDB();
    const userObjectId = new Types.ObjectId(userId);
    const quizObjectId = new Types.ObjectId(quizId);
    const [quiz, attempted, inProgress] = await Promise.all([
      Quiz.findById(quizObjectId).select('_id author').lean<{
        _id: Types.ObjectId;
        author: Types.ObjectId;
      }>(),
      Attempt.exists({ user: { $in: [userId, userObjectId] }, quiz: quizObjectId }),
      QuizProgress.exists({ userId: userObjectId, quiz: quizObjectId }),
    ]);
    if (!quiz) return null;
    return {
      quizId: String(quiz._id),
      quizOwnerId: String(quiz.author),
      hasAttempt: Boolean(attempted),
      hasProgress: Boolean(inProgress),
    };
  }

  async saveQuizPlacement(
    userId: string,
    quizId: string,
    _quizOwnerId: string,
    folderId: string | null,
  ): Promise<void> {
    await connectDB();
    const ownerObjectId = new Types.ObjectId(userId);
    const quizObjectId = new Types.ObjectId(quizId);
    const folderObjectId = folderId ? new Types.ObjectId(folderId) : null;

    if (!folderObjectId) {
      await FolderQuiz.deleteOne({ owner: ownerObjectId, quiz: quizObjectId });
      return;
    }

    await FolderQuiz.updateOne(
      { owner: ownerObjectId, quiz: quizObjectId },
      { $set: { folder: folderObjectId } },
      { upsert: true },
    );
  }
}
