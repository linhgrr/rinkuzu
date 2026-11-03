import type { StarterQuizDto } from '@/dtos/dashboard';
import type { DashboardStarterQuizCandidateRecord } from '@/interfaces/repositories/IDashboardRepository';

export interface StarterQuizAllowlistEntry {
  slug: string;
  locale: string;
}

type StarterQuizDropReason = 'missing' | 'not-public' | 'too-long' | 'premium';

interface DroppedStarterQuiz {
  slug: string;
  reason: StarterQuizDropReason;
}

export interface ResolveStarterQuizzesInput {
  allowlist: readonly StarterQuizAllowlistEntry[];
  candidates: DashboardStarterQuizCandidateRecord[];
}

export interface ResolvedStarterQuizzes {
  starterQuizzes: StarterQuizDto[];
  dropped: DroppedStarterQuiz[];
}

/**
 * Curated public quizzes shown to a new learner on /dashboard, in priority
 * order. A submitted public-quiz attempt is what counts as activation, so each
 * entry must be short, public and free. Entries that stop meeting that bar are
 * dropped at request time (see resolveStarterQuizzes), never shown.
 */
export const STARTER_QUIZ_ALLOWLIST: readonly StarterQuizAllowlistEntry[] = [
  { slug: 'cach-ghi-nho-nhung-gi-ban-hoc-quiz-khoi-dong-7-cau-096007', locale: 'vi' },
  { slug: 'how-to-remember-what-you-study-7-question-starter-quiz-093947', locale: 'en' },
  { slug: 'ktpm-chng-6-p1-219991', locale: 'vi' },
];

const STARTER_QUIZ_MAX_QUESTIONS = 15;

function getDropReason(
  candidate: DashboardStarterQuizCandidateRecord | undefined,
): StarterQuizDropReason | null {
  if (!candidate) return 'missing';
  if (candidate.visibility !== 'public') return 'not-public';
  if (candidate.questionCount < 1 || candidate.questionCount > STARTER_QUIZ_MAX_QUESTIONS) {
    return 'too-long';
  }
  if (candidate.isPremium) return 'premium';
  return null;
}

/** Keeps allowlist order; drops entries a new learner could not finish free in two minutes. */
export function resolveStarterQuizzes({
  allowlist,
  candidates,
}: ResolveStarterQuizzesInput): ResolvedStarterQuizzes {
  const candidatesBySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));
  const starterQuizzes: StarterQuizDto[] = [];
  const dropped: DroppedStarterQuiz[] = [];

  for (const entry of allowlist) {
    const candidate = candidatesBySlug.get(entry.slug);
    const reason = getDropReason(candidate);
    if (reason || !candidate) {
      dropped.push({ slug: entry.slug, reason: reason ?? 'missing' });
      continue;
    }
    starterQuizzes.push({
      slug: candidate.slug,
      title: candidate.title,
      questionCount: candidate.questionCount,
      locale: entry.locale,
    });
  }

  return { starterQuizzes, dropped };
}
