import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import { apiErr, apiOk } from '@/lib/api/response';

export const POST = withAuth(async (_request, { userId }) => {
  try {
    await connectDB();

    const userProgress = await UserProgress.findOne({ userId });
    if (!userProgress) {
      return apiErr('not_found', 'User progress not found', 404);
    }

    const FREEZE_COST = 500;
    const MAX_FREEZES = 2;

    if (userProgress.streakFreezeCount >= MAX_FREEZES) {
      return apiErr('validation_error', 'You already have maximum streak freezes', 400);
    }

    if (userProgress.totalXp < FREEZE_COST) {
      return apiErr('validation_error', 'Not enough XP', 400);
    }

    userProgress.totalXp -= FREEZE_COST;
    userProgress.streakFreezeCount += 1;
    await userProgress.save();

    return apiOk(
      {
        xp: userProgress.totalXp,
        streakFreezeCount: userProgress.streakFreezeCount,
      },
      200,
      { meta: { message: 'Streak freeze purchased' } },
    );
  } catch (error) {
    console.error('Error buying freeze:', error);
    return apiErr('internal_error', 'Internal Server Error', 500);
  }
});
