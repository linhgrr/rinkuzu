import { proxyAdaptiveRequest } from '@/lib/adaptive-learning/proxy';
import { ADAPTIVE_CACHE_TAGS, ADAPTIVE_CACHE_TTL_SECONDS } from '@/lib/adaptive-learning/cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return proxyAdaptiveRequest(req, '/api/pipeline/status', {
    cache: {
      revalidateSeconds: ADAPTIVE_CACHE_TTL_SECONDS.pipelineStatus,
      tags: [ADAPTIVE_CACHE_TAGS.pipelineStatus],
    },
  });
}
