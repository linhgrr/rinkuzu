import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getLearningProgressService } from '@/lib/learning-progress-factory';

const learningProgressService = getLearningProgressService();

export const POST = withAuth(async (_request, { userId }) => {
  const result = await learningProgressService.buyStreakFreeze(userId);
  if (!result.success) {
    return result.statusCode === 400
      ? apiErr('validation_error', result.error, 400)
      : apiServiceErr(result);
  }
  return apiOk(result.data, 200, { meta: { message: 'Streak freeze purchased' } });
});
