import type {
  IQuizCandidateBySlugRepository,
  IStarterQuizReadRepository,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import { logger } from '@/lib/logger';
import {
  getStarterQuizDropReason,
  loadStarterQuizzes,
  starterQuizHref,
} from '@/services/dashboard/starter-quizzes';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';
import { BLOG_ENTRY, LANDING_ENTRY } from '@/shared/constants/starter-quiz';

type QueryParams = Readonly<Record<string, string>>;

/** `/try?entry=blog` input, already validated (RIN-1258): each field is dropped when malformed. */
export interface BlogTryInput {
  post?: string;
  quiz?: string;
}

/**
 * Picks the starter quiz behind the homepage's play-first button (RIN-1178): the first
 * eligible starter (RIN-1177: public, free, not empty) in the page locale, from the same
 * MongoDB source as the /dashboard starter block. Returns its locale-unprefixed href with
 * `entry=landing` (plus `mode=quick` for a long starter), or the given attribution params.
 * Fails open to `null` so `/try` can fall back to the public quiz list.
 */
export class LandingStarterResolver {
  constructor(private readonly starters: IStarterQuizReadRepository) {}

  async resolveHref(
    locale: string,
    params: QueryParams = { entry: LANDING_ENTRY },
  ): Promise<string | null> {
    try {
      const { starterQuizzes } = await loadStarterQuizzes(this.starters);
      const starter = starterQuizzes.find((quiz) => quiz.locale === locale);
      return starter ? starterQuizHref(starter, params) : null;
    } catch (error) {
      logger.warn({ error, locale }, 'Failed resolving landing starter quiz');
      return null;
    }
  }
}

/**
 * Target of a blog post's "try this quiz" card (RIN-1258, spec RIN-1242 AC 4): the
 * post's quiz when a guest can play it free (public, not premium, not empty; a quick
 * round when long, as on the homepage path) and promotable (not flagged or held,
 * RIN-1341), else the locale's starter, both with `entry=blog` and the post. `null` sends `/try` to the public quiz list. Never throws.
 */
export class BlogTryResolver {
  constructor(
    private readonly quizzes: IQuizCandidateBySlugRepository,
    private readonly starters: LandingStarterResolver,
  ) {}

  async resolveHref(locale: string, { post, quiz }: BlogTryInput): Promise<string | null> {
    const params: QueryParams = post ? { entry: BLOG_ENTRY, post } : { entry: BLOG_ENTRY };
    const quizHref = quiz ? await this.playableQuizHref(quiz, params) : null;
    return quizHref ?? this.starters.resolveHref(locale, params);
  }

  private async playableQuizHref(slug: string, params: QueryParams): Promise<string | null> {
    try {
      const candidate = await this.quizzes.findQuizCandidateBySlug(slug);
      // A drop reason also covers a flagged or held quiz: playable at its URL, never promoted (RIN-1341).
      if (!candidate || getStarterQuizDropReason(candidate)) return null;
      const quick = isQuickRoundEligible(candidate.questionCount);
      return starterQuizHref({ slug: candidate.slug, quick }, params);
    } catch (error) {
      logger.warn({ error, slug }, 'Failed resolving blog quiz');
      return null;
    }
  }
}
