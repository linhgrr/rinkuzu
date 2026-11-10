import { after } from 'next/server';

import type {
  IIndexNowNotifier,
  IQuizIndexNowNotifier,
  QuizIndexNowChange,
} from '@/interfaces/services/IIndexNowNotifier';
import { logger } from '@/lib/logger';
import { isIndexNowEnabled, submitIndexNow } from '@/lib/seo/indexnow';
import { IndexNowQueueRepository } from '@/repositories/IndexNowQueueRepository';
import { QuizRepository } from '@/repositories/QuizRepository';
import { QuizTopicHubRepository } from '@/repositories/QuizTopicHubRepository';
import { IndexNowService } from '@/services/seo/IndexNowService';
import { QuizIndexNowService } from '@/services/seo/QuizIndexNowService';

let indexNowService: IndexNowService | undefined;

/** @public The post-deploy ping (RIN-1501) flushes through this service. */
export function getIndexNowService(): IndexNowService {
  indexNowService ??= new IndexNowService({
    queue: new IndexNowQueueRepository(),
    submit: (urls) => submitIndexNow(urls),
    enabled: isIndexNowEnabled(),
  });
  return indexNowService;
}

let quizIndexNowService: QuizIndexNowService | undefined;

function getQuizIndexNowService(): QuizIndexNowService {
  quizIndexNowService ??= new QuizIndexNowService({
    quizzes: new QuizRepository(),
    topics: new QuizTopicHubRepository(),
  });
  return quizIndexNowService;
}

async function runQuietly(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    logger.warn({ event: 'indexnow_enqueue_failed', error }, 'indexnow enqueue failed');
  }
}

/**
 * Runs the task after the response is sent (`after()`), so the user's request
 * never waits on Mongo or IndexNow and never sees an error from them. Outside
 * a request scope (scripts) the work runs detached instead.
 */
function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(() => runQuietly(task));
  } catch {
    void runQuietly(task);
  }
}

function scheduleIndexNow(urls: readonly string[]): void {
  if (urls.length === 0 || !isIndexNowEnabled()) return;
  const copy = [...urls];
  runAfterResponse(() => getIndexNowService().enqueue(copy));
}

/** Looks up the quiz and its hub after the response, then queues their URLs. */
function scheduleQuizIndexNow(change: QuizIndexNowChange): void {
  if (!isIndexNowEnabled()) return;
  const copy = { ...change };
  runAfterResponse(async () => {
    const urls = await getQuizIndexNowService().urlsFor(copy);
    if (urls.length > 0) await getIndexNowService().enqueue(urls);
  });
}

export const indexNowNotifier: IIndexNowNotifier = {
  notifyChanged: scheduleIndexNow,
};

export const quizIndexNowNotifier: IQuizIndexNowNotifier = {
  quizChanged: scheduleQuizIndexNow,
};
