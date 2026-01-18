import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import UserProgress from '@/models/UserProgress';
import QuestionProgress from '@/models/QuestionProgress';
import { authOptions } from '@/lib/auth';
import { calculateLevel, xpForNextLevel, levelProgress } from '@/lib/gamification';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        const userId = (session.user as any).id;

        // Get stats
        let uProgress = await UserProgress.findOne({ userId });

        if (!uProgress) {
            // Initialize if null
            uProgress = await UserProgress.create({ userId });
        }

        // Get due count
        const dueCount = await QuestionProgress.countDocuments({
            userId,
            nextReviewDate: { $lte: new Date() }
        });

        // Calculate level dynamically from XP
        const level = calculateLevel(uProgress.totalXp);
        const xpToNextLevel = xpForNextLevel(uProgress.totalXp);
        const currentLevelProgress = levelProgress(uProgress.totalXp);

        return NextResponse.json({
            streak: uProgress.currentStreak,
            longestStreak: uProgress.longestStreak,
            streakFreezeCount: uProgress.streakFreezeCount,
            xp: uProgress.totalXp,
            level: level,
            xpToNextLevel: xpToNextLevel,
            levelProgress: currentLevelProgress,
            dueCount: dueCount,
            weeklyActivity: uProgress.weeklyActivity,
            totalQuestionsLearned: uProgress.totalQuestionsLearned,
            totalReviewSessions: uProgress.totalReviewSessions,
            averageAccuracy: uProgress.averageAccuracy
        });

    } catch (error) {
        console.error('Error fetching progress stats:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
