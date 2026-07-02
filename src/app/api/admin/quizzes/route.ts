import { NextRequest } from 'next/server';
import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { adminQuizListQuerySchema } from '@/dtos/admin-quiz';
import { getAdminQuizService } from '@/lib/admin-quiz-factory';
import { readAndValidateSearchParams } from '@/lib/api/request';

const adminQuizService = getAdminQuizService();

export const GET = withAdmin(async (request: NextRequest) => {
  const query = readAndValidateSearchParams(request, adminQuizListQuerySchema);

  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const result = await adminQuizService.listAdminQuizzes(query.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
