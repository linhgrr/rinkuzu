import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { folderIdSchema, renameFolderRequestSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { readAndValidateJson } from '@/lib/api/request';

const folderService = getFolderService();

export const PATCH = withAuth<{ id: string }>(async (request: NextRequest, { params, userId }) => {
  const folderId = folderIdSchema.safeParse(params.id);
  if (!folderId.success) {
    return apiErr('validation_error', 'Invalid folder id', 400);
  }
  const body = await readAndValidateJson(request, renameFolderRequestSchema);
  if (!body.success) {
    return apiErr('validation_error', body.error, 400, body.fields);
  }

  const result = await folderService.renameFolder(folderId.data, userId, body.data.name);
  if (!result.success) {
    return result.statusCode === 409
      ? apiErr('validation_error', result.error, 409)
      : apiServiceErr(result);
  }
  return apiOk(result.data);
});

export const DELETE = withAuth<{ id: string }>(
  async (_request: NextRequest, { params, userId }) => {
    const folderId = folderIdSchema.safeParse(params.id);
    if (!folderId.success) {
      return apiErr('validation_error', 'Invalid folder id', 400);
    }
    const result = await folderService.deleteFolder(folderId.data, userId);
    return result.success
      ? apiOk(null, 200, { meta: { message: 'Folder deleted' } })
      : apiServiceErr(result);
  },
);
