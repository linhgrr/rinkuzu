import type { IStarterQuizReadRepository } from '@/interfaces/repositories/IStarterQuizReadRepository';
import { logger } from '@/lib/logger';
import { loadStarterQuizzes, starterQuizHref } from '@/services/dashboard/starter-quizzes';
import { LANDING_ENTRY } from '@/shared/constants/starter-quiz';

/**
 * Picks the starter quiz behind the homepage's play-first button (RIN-1178): the first
 * eligible starter (RIN-1177: public, free, not empty) in the page locale, from the same
 * MongoDB source as the /dashboard starter block. Returns its locale-unprefixed href with
 * `entry=landing` (plus `mode=quick` for a long starter). Fails open to `null` so `/try`
 * can fall back to the public quiz list.
 */
export class LandingStarterResolver {
  constructor(private readonly starters: IStarterQuizReadRepository) {}

  async resolveHref(locale: string): Promise<string | null> {
    try {
      const { starterQuizzes } = await loadStarterQuizzes(this.starters);
      const starter = starterQuizzes.find((quiz) => quiz.locale === locale);
      return starter ? starterQuizHref(starter, { entry: LANDING_ENTRY }) : null;
    } catch (error) {
      logger.warn({ error, locale }, 'Failed resolving landing starter quiz');
      return null;
    }
  }
}
