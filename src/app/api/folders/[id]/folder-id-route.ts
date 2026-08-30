import type { NextRequest } from 'next/server';

import { folderIdRouteParamsSchema } from '@/dtos/folder';
import { withAuth } from '@/lib/api/auth';
import { parseRouteParams } from '@/lib/api/validated';

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
    const parsedParams = parseRouteParams(params, folderIdRouteParamsSchema);
    if (!parsedParams.ok) return parsedParams.response;

    return options.handle({ request, folderId: parsedParams.data.id, userId });
  });
}
