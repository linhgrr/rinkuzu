import { revalidateTag } from 'next/cache';
import { ADAPTIVE_CACHE_TAGS } from './cache';

const CACHE_SAFE_PATHS = new Set<string>(['/api/health', '/api/pipeline/status']);

export function isCacheSafeAdaptivePath(targetPath: string): boolean {
  return CACHE_SAFE_PATHS.has(targetPath);
}

export function invalidateAdaptiveServiceCache(): void {
  revalidateTag(ADAPTIVE_CACHE_TAGS.health);
  revalidateTag(ADAPTIVE_CACHE_TAGS.pipelineStatus);
}
