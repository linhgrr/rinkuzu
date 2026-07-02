import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { readAndValidateJson } from '@/lib/api/request';
import { submitReviewRequestSchema } from '@/dtos/review';
import { getLearningProgressService } from '@/lib/learning-progress-factory';

const learningProgressService = getLearningProgressService();

export const POST = withAuth(async (request, { userId }) => {
  const input = await readAndValidateJson(request, submitReviewRequestSchema);
  if (!input.success) {
    return apiErr('validation_error', input.error, 400, { fields: input.fields });
  }

  const result = await learningProgressService.submitReview(userId, input.data);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Review submitted' } })
    : apiServiceErr(result);
});
