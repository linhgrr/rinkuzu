import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { adminQuizListQuerySchema } from '@/dtos/admin-quiz';
import { getAdminQuizService } from '@/lib/admin-quiz-factory';
import { parseSearchParams } from '@/lib/api/validated';

const adminQuizService = getAdminQuizService();

export const GET = withAdmin(async (request: NextRequest) => {
  const query = parseSearchParams(request, adminQuizListQuerySchema);
  if (!query.ok) return query.response;

  const result = await adminQuizService.listAdminQuizzes(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
