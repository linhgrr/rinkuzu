import { withAuth } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { submitReviewRequestSchema } from '@/dtos/review';
import { getLearningProgressService } from '@/lib/learning-progress-factory';
import { parseJsonBody } from '@/lib/api/validated';

const learningProgressService = getLearningProgressService();

export const POST = withAuth(async (request, { userId }) => {
  const input = await parseJsonBody(request, submitReviewRequestSchema);
  if (!input.ok) return input.response;

  const result = await learningProgressService.submitReview(userId, input.data);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Review submitted' } })
    : apiServiceErr(result);
});
