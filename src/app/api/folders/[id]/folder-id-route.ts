import type { NextRequest } from 'next/server';

import { folderIdRouteParamsSchema } from '@/dtos/folder';
import { withAuth } from '@/lib/api/auth';
import { readAndValidateRouteParams } from '@/lib/api/request';
import { apiErr } from '@/lib/api/response';

interface FolderIdRouteContext {
  request: NextRequest;
  folderId: string;
  userId: string;
}

interface FolderIdRouteOptions {
  handle: (context: FolderIdRouteContext) => Promise<Response>;
}

export function createFolderIdRoute(options: FolderIdRouteOptions) {
  return withAuth(async (request: NextRequest, { params, userId }) => {
    const parsedParams = readAndValidateRouteParams(params, folderIdRouteParamsSchema);
    if (!parsedParams.success) {
      return apiErr('validation_error', parsedParams.error, 400, {
        fields: parsedParams.fields,
      });
    }

    return options.handle({ request, folderId: parsedParams.data.id, userId });
  });
}
