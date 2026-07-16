import { ADAPTIVE_CACHE_TAGS, ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive/cache';
import { createAdaptiveCachedReadRoute } from '@/app/api/adaptive/cached-read-route';

export const dynamic = 'force-dynamic';

export const GET = createAdaptiveCachedReadRoute({
  targetPath: '/health',
  infra: true,
  revalidateSeconds: ADAPTIVE_CACHE_TTL_SECONDS.health,
  cacheTag: ADAPTIVE_CACHE_TAGS.health,
});
