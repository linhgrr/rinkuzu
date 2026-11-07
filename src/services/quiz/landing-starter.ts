import type { IDashboardRepository } from '@/interfaces/repositories/IDashboardRepository';
import { logger } from '@/lib/logger';
import {
  STARTER_QUIZ_ALLOWLIST,
  resolveStarterQuizzes,
  type StarterQuizAllowlistEntry,
} from '@/services/dashboard/starter-quizzes';

/**
 * Picks the starter quiz behind the homepage's play-first button (RIN-1178): the first
 * allowlisted starter in the page locale that is still public, short and free, the same
 * bar as the /dashboard starter block. Fails open to `null` so `/try` can fall back to
 * the public quiz list.
 */
export class LandingStarterResolver {
  constructor(
    private readonly candidates: Pick<IDashboardRepository, 'findStarterQuizCandidates'>,
    private readonly allowlist: readonly StarterQuizAllowlistEntry[] = STARTER_QUIZ_ALLOWLIST,
  ) {}

  async resolve(locale: string): Promise<string | null> {
    const entries = this.allowlist.filter((entry) => entry.locale === locale);
    if (entries.length === 0) return null;

    try {
      const candidates = await this.candidates.findStarterQuizCandidates(
        entries.map(({ slug }) => slug),
      );
      const { starterQuizzes } = resolveStarterQuizzes({ allowlist: entries, candidates });
      return starterQuizzes[0]?.slug ?? null;
    } catch (error) {
      logger.warn({ error, locale }, 'Failed resolving landing starter quiz');
      return null;
    }
  }
}
