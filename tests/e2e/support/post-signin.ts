import type { Page } from '@playwright/test';
import { STARTER_SKIPPED_COOKIE } from '../../../src/shared/constants/starter-quiz';

/**
 * Sign-in with no real destination lands on /start, which opens the starter quiz
 * for a learner with no attempt and no authored quiz (RIN-913). Flows that test
 * something else sign in as a learner who pressed Skip in this browser, so they
 * land on /dashboard whichever starter quizzes another test has seeded. Call it
 * after the first `page.goto` so the cookie gets the app's origin.
 */
export async function skipPostSignInStarter(page: Page): Promise<void> {
  await page.context().addCookies([{ name: STARTER_SKIPPED_COOKIE, value: '1', url: page.url() }]);
}
