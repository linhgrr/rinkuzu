import { after } from 'next/server';
import type { IDeferredTaskScheduler } from '@/interfaces/services/IDeferredTaskScheduler';
import { logger } from '@/lib/logger';

export class NextDeferredTaskScheduler implements IDeferredTaskScheduler {
  schedule(task: () => Promise<void>): void {
    after(async () => {
      try {
        await task();
      } catch (error) {
        logger.error({ error }, 'Deferred task failed');
      }
    });
  }
}
