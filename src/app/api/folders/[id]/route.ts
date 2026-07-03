import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { folderIdRouteParamsSchema, renameFolderRequestSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { readAndValidateJson, readAndValidateRouteParams } from '@/lib/api/request';

const folderService = getFolderService();

export const PATCH = withAuth(async (request: NextRequest, { params, userId }) => {
  const parsedParams = readAndValidateRouteParams(params, folderIdRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  const body = await readAndValidateJson(request, renameFolderRequestSchema);
  if (!body.success) {
    return apiErr('validation_error', body.error, 400, body.fields);
  }

  const result = await folderService.renameFolder(parsedParams.data.id, userId, body.data.name);
  if (!result.success) {
    return result.statusCode === 409
      ? apiErr('validation_error', result.error, 409)
      : apiServiceErr(result);
  }
  return apiOk(result.data);
});

export const DELETE = withAuth(async (_request: NextRequest, { params, userId }) => {
  const parsedParams = readAndValidateRouteParams(params, folderIdRouteParamsSchema);
  if (!parsedParams.success) {
    return apiErr('validation_error', parsedParams.error, 400, { fields: parsedParams.fields });
  }

  const result = await folderService.deleteFolder(parsedParams.data.id, userId);
  return result.success
    ? apiOk(result.data, 200, { meta: { message: 'Folder deleted' } })
    : apiServiceErr(result);
});
