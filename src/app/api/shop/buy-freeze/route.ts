import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import { authOptions } from '@/lib/auth';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        const userId = (session.user as any).id;

        const userProgress = await UserProgress.findOne({ userId });
        if (!userProgress) {
            return NextResponse.json({ message: 'User progress not found' }, { status: 404 });
        }

        const FREEZE_COST = 500;
        const MAX_FREEZES = 2;

        if (userProgress.streakFreezeCount >= MAX_FREEZES) {
            return NextResponse.json({ message: 'You already have maximum streak freezes' }, { status: 400 });
        }

        if (userProgress.totalXp < FREEZE_COST) {
            return NextResponse.json({ message: 'Not enough XP' }, { status: 400 });
        }

        userProgress.totalXp -= FREEZE_COST;
        userProgress.streakFreezeCount += 1;
        await userProgress.save();

        return NextResponse.json({
            success: true,
            message: 'Streak freeze purchased',
            data: {
                xp: userProgress.totalXp,
                streakFreezeCount: userProgress.streakFreezeCount
            }
        });

    } catch (error) {
        console.error('Error buying freeze:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
