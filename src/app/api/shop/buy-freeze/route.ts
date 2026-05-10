import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import { authOptions } from '@/lib/auth';
import { apiErr } from '@/lib/api/response';

export async function POST(_req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    await connectDB();
    const userId = (session.user as any).id;

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

    return NextResponse.json({
      success: true,
      message: 'Streak freeze purchased',
      data: {
        xp: userProgress.totalXp,
        streakFreezeCount: userProgress.streakFreezeCount,
      },
    });
  } catch (error) {
    console.error('Error buying freeze:', error);
    return apiErr('internal_error', 'Internal Server Error', 500);
  }
}
