import { withPremiumSessionStart } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const POST = withPremiumSessionStart(
  'Start Premium flashcard session failed',
  (actor, quizId) => getPremiumQuizService().startFlashcardSession(actor, quizId),
);
