import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { assignQuizRequestSchema, folderTargetRouteParamsSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { readAndValidateJson } from '@/lib/api/request';
import { parseRouteParams } from '@/lib/api/validated';

const folderService = getFolderService();

export const POST = withAuth(async (request: NextRequest, { params, userId }) => {
  // NOTE: body is validated before params here, and its failure meta is the
  // raw field map (not wrapped under `fields`) — both are pre-existing,
  // test-pinned quirks of this route, so this handler cannot use
  // parseParamsAndBody/parseJsonBody without changing behavior.
  const body = await readAndValidateJson(request, assignQuizRequestSchema);
  if (!body.success) {
    return apiErr('validation_error', body.error, 400, body.fields);
  }

  const parsedParams = parseRouteParams(params, folderTargetRouteParamsSchema);
  if (!parsedParams.ok) return parsedParams.response;

  const result = await folderService.assignQuiz(parsedParams.data.id, body.data.quizId, userId);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Quiz added to folder' } })
    : apiServiceErr(result);
});
