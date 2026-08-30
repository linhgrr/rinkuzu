import { premiumSessionBatchRequestSchema } from '@/dtos/premium-quiz';
import { withPremiumSessionAction } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const POST = withPremiumSessionAction(
  premiumSessionBatchRequestSchema,
  'Get Premium flashcard failed',
  (actor, sessionId, body) =>
    getPremiumQuizService().getFlashcard(actor.userId, sessionId, body.cursor),
);
