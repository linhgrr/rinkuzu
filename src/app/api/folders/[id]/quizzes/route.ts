import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { assignQuizRequestSchema, folderTargetSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { readAndValidateJson } from '@/lib/api/request';

const folderService = getFolderService();

export const POST = withAuth<{ id: string }>(async (request: NextRequest, { params, userId }) => {
  const body = await readAndValidateJson(request, assignQuizRequestSchema);
  if (!body.success) {
    return apiErr('validation_error', body.error, 400, body.fields);
  }
  const folderTarget = folderTargetSchema.safeParse(params.id);
  if (!folderTarget.success) {
    return apiErr('validation_error', 'Invalid folder id', 400);
  }

  const result = await folderService.assignQuiz(folderTarget.data, body.data.quizId, userId);
  return result.success
    ? apiOk(null, 200, { meta: { message: 'Quiz added to folder' } })
    : apiServiceErr(result);
});
