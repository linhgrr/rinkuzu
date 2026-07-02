import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { adminQuizListQuerySchema } from '@/dtos/admin-quiz';
import { getAdminQuizService } from '@/lib/admin-quiz-factory';

const adminQuizService = getAdminQuizService();

export const GET = withAdmin(async (request: NextRequest) => {
  const searchParams = new URL(request.url).searchParams;
  const query = adminQuizListQuerySchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    visibility: searchParams.get('visibility') ?? undefined,
  });

  if (!query.success) {
    return apiErr('validation_error', query.error.issues[0]?.message ?? 'Invalid query', 400);
  }

  const result = await adminQuizService.listAdminQuizzes(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
