import { revalidateTag } from 'next/cache';
import { ADAPTIVE_CACHE_TAGS } from './cache';

// Version-relative paths (as passed to proxyAdaptiveRequest, without the
// /api prefix that buildAdaptiveUrl adds).
const CACHE_SAFE_PATHS = new Set<string>(['/ready', '/pipeline/status']);

export function isCacheSafeAdaptivePath(targetPath: string): boolean {
  return CACHE_SAFE_PATHS.has(targetPath);
}

export function invalidateAdaptiveServiceCache(): void {
  revalidateTag(ADAPTIVE_CACHE_TAGS.health, 'max');
  revalidateTag(ADAPTIVE_CACHE_TAGS.pipelineStatus, 'max');
}
