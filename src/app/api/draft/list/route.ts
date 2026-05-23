// /src/app/api/draft/list/route.ts
import { withAuth } from '@/lib/api/auth';
import connectDB from '@/lib/mongoose';
import DraftQuiz from '@/models/DraftQuiz';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_request, { userId }) => {
  try {
    await connectDB();

    const drafts = await DraftQuiz.find({
      userId,
      status: { $ne: 'expired' },
    })
      .select('title status chunks.total chunks.processed questions createdAt expiresAt')
      .sort({ createdAt: -1 })
      .limit(20);

    return apiOk({
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
    logger.error({ error }, 'List drafts error');
    return apiErr('internal_error', 'Failed to list drafts', 500);
  }
});
