import { routePathSegment } from '@/lib/routing/routeParams';
import { canonicalFor } from '@/lib/seo';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';

/** Mode of the shared link (RIN-1179): `quick` when the link opens a quick round. */
export type QuizShareMode = 'quick' | 'full';

export function quizShareMode(quizQuestionCount: number): QuizShareMode {
  return isQuickRoundEligible(quizQuestionCount) ? 'quick' : 'full';
}

interface QuizShareUrlInput {
  slug: string;
  locale: string;
  /** Questions in the live quiz, not in the attempt just played. */
  questionCount: number;
}

/**
 * "Send to a classmate" link (RIN-1179): the canonical public quiz URL plus the
 * share UTM parameters, and `mode=quick` for a quiz long enough for a quick round.
 * Never carries an attempt id, a score or anything about the learner.
 */
export function buildQuizShareUrl({ slug, locale, questionCount }: QuizShareUrlInput): string {
  const params = new URLSearchParams({
    utm_source: 'share',
    utm_medium: 'result',
    utm_campaign: 'quiz-share',
  });
  if (quizShareMode(questionCount) === 'quick') params.set('mode', 'quick');
  return `${canonicalFor(locale, `/quiz/${routePathSegment(slug)}`)}?${params.toString()}`;
}
