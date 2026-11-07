import type { IStarterQuizReadRepository } from '@/interfaces/repositories/IStarterQuizReadRepository';
import type { AttemptOwnerIdentity } from '@/interfaces/repositories/IAttemptRepository';
import { logger } from '@/lib/logger';
import { loadStarterQuizzes } from '@/services/dashboard/starter-quizzes';

export interface NextQuizDto {
  slug: string;
  title: string;
  /** A long starter: the link opens its quick round (`?mode=quick`, RIN-1177). */
  quick: boolean;
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
 * Picks the next quiz for the result page (RIN-914): the first eligible starter quiz in the
 * learner's locale that they have not attempted. Fails open to `null`: the result page must
 * render even when this lookup breaks.
 */
export class NextQuizResolver {
  constructor(
    private readonly starters: IStarterQuizReadRepository,
    private readonly attempts: AttemptedQuizSlugLookup,
  ) {}

  async resolve({ owner, currentSlug, locale }: NextQuizRequest): Promise<NextQuizDto | null> {
    try {
      const { starterQuizzes } = await loadStarterQuizzes(this.starters);
      const options = starterQuizzes.filter(
        (quiz) => quiz.slug !== currentSlug && (locale === undefined || quiz.locale === locale),
      );
      if (options.length === 0) return null;

      const attempted = new Set(
        await this.attempts.findAttemptedQuizSlugs(
          owner,
          options.map(({ slug }) => slug),
        ),
      );
      const next = options.find((quiz) => !attempted.has(quiz.slug));
      return next ? { slug: next.slug, title: next.title, quick: next.quick } : null;
    } catch (error) {
      logger.warn({ error }, 'Failed resolving next quiz for result page');
      return null;
    }
  }
}
