import type { IDashboardRepository } from '@/interfaces/repositories/IDashboardRepository';
import type { AttemptOwnerIdentity } from '@/interfaces/repositories/IAttemptRepository';
import { logger } from '@/lib/logger';
import {
  STARTER_QUIZ_ALLOWLIST,
  resolveStarterQuizzes,
  type StarterQuizAllowlistEntry,
} from '@/services/dashboard/starter-quizzes';

export interface NextQuizDto {
  slug: string;
  title: string;
}

export interface AttemptedQuizSlugLookup {
  /** The subset of `slugs` this learner has submitted an attempt for. */
  findAttemptedQuizSlugs(owner: AttemptOwnerIdentity, slugs: string[]): Promise<string[]>;
}

export interface NextQuizRequest {
  owner: AttemptOwnerIdentity;
  currentSlug: string;
  locale?: string;
}

/**
 * Picks the next quiz for the result page (RIN-914): the first allowlisted starter quiz in the
 * learner's locale that is still public, short and free, and that they have not attempted.
 * Fails open to `null`: the result page must render even when this lookup breaks.
 */
export class NextQuizResolver {
  constructor(
    private readonly candidates: Pick<IDashboardRepository, 'findStarterQuizCandidates'>,
    private readonly attempts: AttemptedQuizSlugLookup,
    private readonly allowlist: readonly StarterQuizAllowlistEntry[] = STARTER_QUIZ_ALLOWLIST,
  ) {}

  async resolve({ owner, currentSlug, locale }: NextQuizRequest): Promise<NextQuizDto | null> {
    const entries = this.allowlist.filter(
      (entry) => entry.slug !== currentSlug && (locale === undefined || entry.locale === locale),
    );
    if (entries.length === 0) return null;

    try {
      const slugs = entries.map(({ slug }) => slug);
      const [candidates, attempted] = await Promise.all([
        this.candidates.findStarterQuizCandidates(slugs),
        this.attempts.findAttemptedQuizSlugs(owner, slugs),
      ]);
      const attemptedSlugs = new Set(attempted);
      const next = resolveStarterQuizzes({ allowlist: entries, candidates }).starterQuizzes.find(
        (quiz) => !attemptedSlugs.has(quiz.slug),
      );
      return next ? { slug: next.slug, title: next.title } : null;
    } catch (error) {
      logger.warn({ error }, 'Failed resolving next quiz for result page');
      return null;
    }
  }
}
