import { NextRequest } from 'next/server';
import { libraryListQuerySchema } from '@/dtos/review';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { getLearningProgressService } from '@/lib/learning-progress-factory';

const learningProgressService = getLearningProgressService();

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const url = new URL(request.url);

  const query = libraryListQuerySchema.safeParse({
    folder: url.searchParams.get('folder') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!query.success) {
    return apiErr('validation_error', 'Invalid library query parameters', 400, {
      issues: query.error.flatten().fieldErrors,
    });
  }

  const result = await learningProgressService.listLibrary(userId, query.data);

  return result.success ? apiOk(result.data) : apiServiceErr(result);
});
