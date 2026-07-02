import { NextRequest } from 'next/server';
import { libraryListQuerySchema } from '@/dtos/review';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getLearningProgressService } from '@/lib/learning-progress-factory';
import { readAndValidateSearchParams } from '@/lib/api/request';

const learningProgressService = getLearningProgressService();

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const query = readAndValidateSearchParams(request, libraryListQuerySchema);
  if (!query.success) {
    return apiErr('validation_error', query.error, 400, { fields: query.fields });
  }

  const result = await learningProgressService.listLibrary(userId, query.data);

  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
