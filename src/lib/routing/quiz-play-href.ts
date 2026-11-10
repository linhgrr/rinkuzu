import { routePathSegment } from '@/lib/routing/routeParams';
import { isQuickRoundEligible } from '@/shared/constants/quick-round';

/** Where a "Chơi ngay" link comes from; `topic` only next to `entry: 'hub'`. */
interface QuizPlayAttribution {
  entry: string;
  topic?: string;
}

/**
 * The one "Chơi ngay" link for a quiz card (RIN-1249 B3, RIN-1469): a quick round on a
 * long quiz, the full quiz otherwise, plus the entry for attribution. Nothing about the
 * learner is in the link.
 */
export function quizPlayHref(
  quiz: { slug: string; questionCount: number },
  { entry, topic }: QuizPlayAttribution,
): string {
  const params = new URLSearchParams({
    mode: isQuickRoundEligible(quiz.questionCount) ? 'quick' : 'full',
    entry,
  });
  if (topic) params.set('topic', topic);
  return `/quiz/${routePathSegment(quiz.slug)}?${params.toString()}`;
}
