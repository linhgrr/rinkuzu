import { premiumSessionBatchRequestSchema } from '@/dtos/premium-quiz';
import { withPremiumSessionAction } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

export const POST = withPremiumSessionAction(
  premiumSessionBatchRequestSchema,
  'Get Premium quiz batch failed',
  (actor, sessionId, body) => getPremiumQuizService().getBatch(actor, sessionId, body.cursor),
);
