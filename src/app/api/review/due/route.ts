import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import connectDB from '@/lib/mongoose';
import QuestionProgress from '@/models/QuestionProgress';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const userId = (session.user as any).id;
        const now = new Date();

        // Find questions due for review (or new ones if we implement that logic here)
        // For now, simple strict due logic
        const dueQuestions = await QuestionProgress.find({
            userId: userId,
            nextReviewDate: { $lte: now }
        })
            .sort({ nextReviewDate: 1 }) // Most overdue first
            .limit(50);

        return NextResponse.json({
            data: dueQuestions,
            count: dueQuestions.length
        });

    } catch (error) {
        console.error('Error fetching due reviews:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
