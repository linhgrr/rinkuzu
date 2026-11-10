import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { postIndexNow, type IndexNowLogLine, type IndexNowResult } from '@/lib/seo/indexnow-core';

/**
 * The app's IndexNow entry point (RIN-1496, RIN-1500). The request itself
 * lives in `indexnow-core.ts`, which the post-deploy ping (RIN-1501) shares;
 * this module adds the production switch and the structured logger.
 */
export {
  INDEXNOW_MAX_URLS_PER_CALL,
  normalizeIndexNowUrls,
  type IndexNowResult,
} from '@/lib/seo/indexnow-core';

/** Only the production deployment pings; preview, development, test and the gate's e2e never do. */
export function isIndexNowEnabled(vercelEnv: string | undefined = env.VERCEL_ENV): boolean {
  return vercelEnv === 'production';
}

export interface IndexNowClientDeps {
  fetch?: typeof fetch;
  enabled?: boolean;
  log?: (line: IndexNowLogLine) => void;
}

function defaultLog(line: IndexNowLogLine): void {
  logger.info(line, 'indexnow');
}

/** See `postIndexNow`: never throws, one log line per call, production only by default. */
export function submitIndexNow(
  urls: readonly string[],
  deps: IndexNowClientDeps = {},
): Promise<IndexNowResult> {
  return postIndexNow(urls, {
    fetch: deps.fetch ?? fetch,
    enabled: deps.enabled ?? isIndexNowEnabled(),
    log: deps.log ?? defaultLog,
  });
}
