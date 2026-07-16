import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { createFolderRequestSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { readAndValidateJson } from '@/lib/api/request';
import { createFolderIdRoute } from './folder-id-route';

const folderService = getFolderService();

export const PATCH = createFolderIdRoute({
  handle: async ({ request, folderId, userId }) => {
    const body = await readAndValidateJson(request, createFolderRequestSchema);
    if (!body.success) {
      return apiErr('validation_error', body.error, 400, body.fields);
    }

    const result = await folderService.renameFolder(folderId, userId, body.data.name);
    if (!result.success) {
      return result.statusCode === 409
        ? apiErr('validation_error', result.error, 409)
        : apiServiceErr(result);
    }
    return apiOk(result.data);
  },
});

export const DELETE = createFolderIdRoute({
  handle: async ({ folderId, userId }) => {
    const result = await folderService.deleteFolder(folderId, userId);
    return result.success
      ? apiOk(result.data, 200, { meta: { message: 'Folder deleted' } })
      : apiServiceErr(result);
  },
});
