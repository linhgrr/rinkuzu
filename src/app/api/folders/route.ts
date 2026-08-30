import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk, apiServiceErr } from '@/lib/api/response';
import { createFolderRequestSchema } from '@/dtos/folder';
import { getFolderService } from '@/lib/folder-factory';
import { parseJsonBody } from '@/lib/api/validated';

const folderService = getFolderService();

export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  const result = await folderService.listFolders(userId);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const parsed = await parseJsonBody(request, createFolderRequestSchema);
  if (!parsed.ok) return parsed.response;

  const result = await folderService.createFolder(userId, parsed.data.name);
  if (!result.success) {
    return result.statusCode === 409
      ? apiErr('validation_error', result.error, 409)
      : apiServiceErr(result);
  }
  return apiOk(result.data, 201);
});
