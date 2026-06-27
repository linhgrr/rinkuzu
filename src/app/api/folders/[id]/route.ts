import { NextRequest } from 'next/server';
import { isValidObjectId } from 'mongoose';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import connectDB from '@/lib/mongoose';
import Folder from '@/models/Folder';
import FolderQuiz from '@/models/FolderQuiz';
import Quiz from '@/models/Quiz';
import { logger } from '@/lib/logger';

const normalizeName = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export const PATCH = withAuth<{ id: string }>(async (request: NextRequest, { params, userId }) => {
  try {
    if (!isValidObjectId(params.id)) {
      return apiErr('validation_error', 'Invalid folder id', 400);
    }
    const name = normalizeName((await request.json())?.name);
    if (!name) return apiErr('validation_error', 'Folder name is required', 400);
    if (name.length > 100) {
      return apiErr('validation_error', 'Folder name cannot exceed 100 characters', 400);
    }

    await connectDB();
    const folder = await Folder.findOneAndUpdate(
      { _id: params.id, owner: userId },
      { $set: { name } },
      { new: true, runValidators: true },
    ).lean();
    if (!folder) return apiErr('not_found', 'Folder not found', 404);
    return apiOk(folder);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      return apiErr('validation_error', 'A folder with this name already exists', 409);
    }
    logger.error({ error }, 'Rename folder error');
    return apiErr('internal_error', 'Failed to rename folder', 500);
  }
});

export const DELETE = withAuth<{ id: string }>(
  async (_request: NextRequest, { params, userId }) => {
    try {
      if (!isValidObjectId(params.id)) {
        return apiErr('validation_error', 'Invalid folder id', 400);
      }
      await connectDB();
      const folder = await Folder.findOne({ _id: params.id, owner: userId }).select('_id');
      if (!folder) return apiErr('not_found', 'Folder not found', 404);

      await Quiz.updateMany({ author: userId, folder: folder._id }, { $set: { folder: null } });
      await FolderQuiz.deleteMany({ owner: userId, folder: folder._id });
      await Folder.deleteOne({ _id: folder._id, owner: userId });
      return apiOk(null, 200, { meta: { message: 'Folder deleted' } });
    } catch (error) {
      logger.error({ error }, 'Delete folder error');
      return apiErr('internal_error', 'Failed to delete folder', 500);
    }
  },
);
