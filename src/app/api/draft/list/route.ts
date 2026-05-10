// /src/app/api/draft/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { apiErr } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return apiErr('unauthorized', 'Unauthorized', 401);
    }

    await connectDB();

    const drafts = await DraftQuiz.find({
      userId,
      status: { $ne: 'expired' },
    })
      .select('title status chunks.total chunks.processed questions createdAt expiresAt')
      .sort({ createdAt: -1 })
      .limit(20);

    return NextResponse.json({
      drafts: drafts.map((d) => ({
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
    return apiErr('internal_error', 'Failed to list drafts', 500);
  }
}
