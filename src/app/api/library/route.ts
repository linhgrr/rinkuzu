import { NextRequest } from 'next/server';
import { libraryListQuerySchema } from '@/dtos/review';
import { withAuth } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { getLearningProgressService } from '@/lib/learning-progress-factory';
import { parseSearchParams } from '@/lib/api/validated';

const learningProgressService = getLearningProgressService();

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const query = parseSearchParams(request, libraryListQuerySchema);
  if (!query.ok) return query.response;

  const result = await learningProgressService.listLibrary(userId, query.data);

  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
