import { ADAPTIVE_CACHE_TAGS, ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive/cache';
import { createAdaptiveCachedReadRoute } from '@/app/api/adaptive/cached-read-route';

export const dynamic = 'force-dynamic';

export const GET = createAdaptiveCachedReadRoute({
  targetPath: '/pipeline/status',
  revalidateSeconds: ADAPTIVE_CACHE_TTL_SECONDS.pipelineStatus,
  cacheTag: ADAPTIVE_CACHE_TAGS.pipelineStatus,
});
