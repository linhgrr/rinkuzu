import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { adminQuizIdParamsSchema } from '@/dtos/admin-quiz';
import { getAdminQuizService } from '@/lib/admin-quiz-factory';

const adminQuizService = getAdminQuizService();

export const GET = withAdmin<{ id: string }>(async (_request, { params }) => {
  const input = adminQuizIdParamsSchema.safeParse(params);
  if (!input.success) {
    return apiErr('validation_error', input.error.issues[0]?.message ?? 'Invalid quiz ID', 400);
  }

  const result = await adminQuizService.getAdminQuiz(input.data.id);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

export const DELETE = withAdmin<{ id: string }>(async (_request, { params }) => {
  const input = adminQuizIdParamsSchema.safeParse(params);
  if (!input.success) {
    return apiErr('validation_error', input.error.issues[0]?.message ?? 'Invalid quiz ID', 400);
  }

  const result = await adminQuizService.deleteAdminQuiz(input.data.id);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Quiz deleted successfully' } })
    : apiServiceErr(result);
});
