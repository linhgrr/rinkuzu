import { proxyAdaptiveRequest } from '@/lib/adaptive/proxy';
import { withAuth } from '@/lib/api/auth';
import { ADAPTIVE_CACHE_TAGS, ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive/cache';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (req, { userId, session }) =>
  proxyAdaptiveRequest(
    req,
    '/pipeline/status',
    { userId, userRole: session.user.role },
    {
      cache: {
        revalidateSeconds: ADAPTIVE_CACHE_TTL_SECONDS.pipelineStatus,
        tags: [ADAPTIVE_CACHE_TAGS.pipelineStatus],
      },
    },
  ),
);
