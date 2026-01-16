// /src/app/api/draft/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import DraftQuiz from '@/models/DraftQuiz';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const drafts = await DraftQuiz.find({
      userId: session.user.id,
      status: { $ne: 'expired' },
    })
      .select('title status chunks.total chunks.processed questions createdAt expiresAt')
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json({
      drafts: drafts.map(d => ({
        _id: d._id.toString(),
        title: d.title,
        status: d.status,
        progress: {
          processed: d.chunks.processed,
          total: d.chunks.total,
        },
        questionsCount: d.questions.length,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
      })),
    });

  } catch (error) {
    console.error('List drafts error:', error);
    return NextResponse.json(
      { error: 'Failed to list drafts' },
      { status: 500 }
    );
  }
}
