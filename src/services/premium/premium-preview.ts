import type { PremiumPlaySession } from '@/entities/PremiumQuiz';
import { PREMIUM_PREVIEW_QUESTION_LIMIT } from '@/dtos/premium-quiz';
import { PremiumQuizError } from '@/entities/PremiumQuizError';

/** RIN-1722: how many questions a session may play: all of them, or the preview slice. */
export function playableQuestionCount(
  session: Pick<PremiumPlaySession, 'preview'>,
  questionCount: number,
): number {
  return session.preview === true
    ? Math.min(PREMIUM_PREVIEW_QUESTION_LIMIT, questionCount)
    : questionCount;
}

export function previewLockedError(): PremiumQuizError {
  return new PremiumQuizError('unlock_required', 'Premium subscription or one credit is required');
}
