import { withAuth } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { getLearningProgressService } from '@/lib/learning-progress-factory';

export const dynamic = 'force-dynamic';

const learningProgressService = getLearningProgressService();

export const GET = withAuth(async (_request, { userId }) => {
  const result = await learningProgressService.listDueReviews(userId);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
