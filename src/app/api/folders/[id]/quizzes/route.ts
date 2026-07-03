import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { assignQuizRequestSchema, folderTargetRouteParamsSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';

const folderService = getFolderService();

export const POST = withAuth(async (request: NextRequest, { params, userId }) => {
  const body = await readAndValidateJson(request, assignQuizRequestSchema);
  if (!body.success) {
    return apiErr('validation_error', body.error, 400, body.fields);
  }

  const parsedParams = readAndValidateRouteParams(params, folderTargetRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  const result = await folderService.assignQuiz(parsedParams.data.id, body.data.quizId, userId);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Quiz added to folder' } })
    : apiServiceErr(result);
});
