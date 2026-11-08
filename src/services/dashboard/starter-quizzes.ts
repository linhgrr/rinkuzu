import type { StarterQuizDto } from '@/dtos/dashboard';
import type {
  IStarterQuizReadRepository,
  StarterQuizCandidateRecord,
  StarterQuizEntryRecord,
} from '@/interfaces/repositories/IStarterQuizReadRepository';
import { ROUTES } from '@/shared/constants/routes';
import { QUICK_ROUND_SIZE, isQuickRoundEligible } from '@/shared/constants/quick-round';

/** @public Read by the admin starter list (RIN-1177 part 2) for its warning. */
export type StarterQuizDropReason = 'missing' | 'not-public' | 'premium' | 'empty';

/** @public Read by the admin starter list (RIN-1177 part 2) for its warning. */
export interface DroppedStarterQuiz {
  quizId: string;
  reason: StarterQuizDropReason;
}

interface ResolveStarterQuizzesInput {
  entries: readonly StarterQuizEntryRecord[];
  candidates: readonly StarterQuizCandidateRecord[];
}

export interface ResolvedStarterQuizzes {
  starterQuizzes: StarterQuizDto[];
  dropped: DroppedStarterQuiz[];
}

/** Index of the starter to lead with: the first in the UI locale, else the first; -1 when empty. */
export function pickStarterQuizIndex(
  starterQuizzes: readonly Pick<StarterQuizDto, 'locale'>[],
  locale: string,
): number {
  if (starterQuizzes.length === 0) return -1;
  return Math.max(
    starterQuizzes.findIndex((quiz) => quiz.locale === locale),
    0,
  );
}

/**
 * The quiz-page href for a starter, with any extra query params; a long
 * starter opens straight into its quick round (`mode=quick`).
 */
export function starterQuizHref(
  quiz: Pick<StarterQuizDto, 'slug' | 'quick'>,
  params: Readonly<Record<string, string>> = {},
): string {
  const query = new URLSearchParams(quiz.quick ? { mode: 'quick', ...params } : params).toString();
  const path = ROUTES.QUIZ.VIEW(quiz.slug);
  return query ? `${path}?${query}` : path;
}

/** Why a learner could not take this starter free; null when it is live. Shared with the admin list. */
export function getStarterQuizDropReason(
  candidate: StarterQuizCandidateRecord | undefined,
): StarterQuizDropReason | null {
  if (!candidate) return 'missing';
  if (candidate.visibility !== 'public') return 'not-public';
  if (candidate.isPremium) return 'premium';
  if (candidate.questionCount < 1) return 'empty';
  return null;
}

/**
 * Keeps the stored order; drops starters a new learner could not take free.
 * A quiz long enough for a quick round (over 15 questions) stays, marked `quick`.
 */
function resolveStarterQuizzes({
  entries,
  candidates,
}: ResolveStarterQuizzesInput): ResolvedStarterQuizzes {
  const candidatesById = new Map(candidates.map((candidate) => [candidate.quizId, candidate]));
  const starterQuizzes: StarterQuizDto[] = [];
  const dropped: DroppedStarterQuiz[] = [];

  for (const entry of entries) {
    const candidate = candidatesById.get(entry.quizId);
    const reason = getStarterQuizDropReason(candidate);
    if (reason || !candidate) {
      dropped.push({ quizId: entry.quizId, reason: reason ?? 'missing' });
      continue;
    }
    const quick = isQuickRoundEligible(candidate.questionCount);
    starterQuizzes.push({
      slug: candidate.slug,
      title: candidate.title,
      questionCount: quick ? QUICK_ROUND_SIZE : candidate.questionCount,
      locale: entry.locale,
      quick,
    });
  }

  return { starterQuizzes, dropped };
}

/**
 * The current starters from MongoDB, uncached: a few rows on an indexed
 * collection plus one aggregation, so an admin change shows on the next request.
 */
export async function loadStarterQuizzes(
  repository: IStarterQuizReadRepository,
): Promise<ResolvedStarterQuizzes> {
  const entries = await repository.listStarterQuizEntries();
  if (entries.length === 0) return { starterQuizzes: [], dropped: [] };
  const candidates = await repository.findStarterQuizCandidates(
    entries.map(({ quizId }) => quizId),
  );
  return resolveStarterQuizzes({ entries, candidates });
}
