import { useTranslations } from 'next-intl';
import type { QuizCardPlayAction, QuizCardQuiz } from '@/features/quiz/components/QuizCard';
import { quizPlayHref } from '@/lib/routing/quiz-play-href';

/**
 * "Chơi ngay" for list cards on a public discovery surface (RIN-1469): same copy and link
 * rule as the topic hub card. Only a public quiz gets one; a `personal` (Premium) quiz
 * cannot start in one tap.
 */
export function useQuizCardPlay(
  entry: string,
): (quiz: QuizCardQuiz) => QuizCardPlayAction | undefined {
  const t = useTranslations('explore.hub');
  return (quiz) =>
    quiz.visibility === 'public'
      ? {
          href: quizPlayHref(quiz, { entry }),
          label: t('play'),
          ariaLabel: t('playAria', { title: quiz.title }),
        }
      : undefined;
}
