import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { createFolderRequestSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { createFolderIdRoute } from './folder-id-route';
import { parseJsonBody } from '@/lib/api/validated';

const folderService = getFolderService();

export const PATCH = createFolderIdRoute({
  handle: async ({ request, folderId, userId }) => {
    const body = await parseJsonBody(request, createFolderRequestSchema);
    if (!body.ok) return body.response;

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
