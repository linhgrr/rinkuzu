import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { ADAPTIVE_CACHE_TAGS, ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive-learning/cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return proxyAdaptiveRequest(req, '/api/health', {
    cache: {
      revalidateSeconds: ADAPTIVE_CACHE_TTL_SECONDS.health,
      tags: [ADAPTIVE_CACHE_TAGS.health],
    },
  });
}
