import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { assignQuizRequestSchema, folderTargetRouteParamsSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { parseParamsAndBody } from '@/lib/api/validated';

const folderService = getFolderService();

export const POST = withAuth(async (request: NextRequest, { params, userId }) => {
  const parsed = await parseParamsAndBody(request, params, {
    params: folderTargetRouteParamsSchema,
    body: assignQuizRequestSchema,
  });
  if (!parsed.ok) return parsed.response;

  const result = await folderService.assignQuiz(parsed.params.id, parsed.body.quizId, userId);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Quiz added to folder' } })
    : apiServiceErr(result);
});
