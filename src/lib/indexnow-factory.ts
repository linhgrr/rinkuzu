import { after } from 'next/server';

import type { IIndexNowNotifier } from '@/interfaces/services/IIndexNowNotifier';
import { logger } from '@/lib/logger';
import { isIndexNowEnabled, submitIndexNow } from '@/lib/seo/indexnow';
import { IndexNowQueueRepository } from '@/repositories/IndexNowQueueRepository';
import { IndexNowService } from '@/services/seo/IndexNowService';

let indexNowService: IndexNowService | undefined;

export function getIndexNowService(): IndexNowService {
  indexNowService ??= new IndexNowService({
    queue: new IndexNowQueueRepository(),
    submit: (urls) => submitIndexNow(urls),
    enabled: isIndexNowEnabled(),
  });
  return indexNowService;
}

async function runQuietly(urls: readonly string[]): Promise<void> {
  try {
    await getIndexNowService().enqueue(urls);
  } catch (error) {
    logger.warn({ event: 'indexnow_enqueue_failed', error }, 'indexnow enqueue failed');
  }
}

/**
 * Queues the URLs after the response is sent (`after()`), so the user's
 * request never waits on Mongo or IndexNow and never sees an error from them.
 * Outside a request scope (scripts) the work runs detached instead.
 */
export function scheduleIndexNow(urls: readonly string[]): void {
  if (urls.length === 0 || !isIndexNowEnabled()) return;
  const copy = [...urls];
  try {
    after(() => runQuietly(copy));
  } catch {
    void runQuietly(copy);
  }
}

export const indexNowNotifier: IIndexNowNotifier = {
  notifyChanged: scheduleIndexNow,
};
