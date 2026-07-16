import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/api/auth';
import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import type { UserRole } from '@/types/next-auth';

interface AdaptiveCachedReadRouteOptions {
  targetPath: string;
  revalidateSeconds: number;
  cacheTag: string;
  infra?: boolean;
}

export function createAdaptiveCachedReadRoute(options: AdaptiveCachedReadRouteOptions) {
  return withAuth(async (request: NextRequest, { userId, session }) =>
    proxyAdaptiveRequest(
      request,
      options.targetPath,
      { userId, userRole: session.user.role as UserRole },
      {
        ...(options.infra !== undefined && { infra: options.infra }),
        cache: {
          revalidateSeconds: options.revalidateSeconds,
          tags: [options.cacheTag],
        },
      },
    ),
  );
}
