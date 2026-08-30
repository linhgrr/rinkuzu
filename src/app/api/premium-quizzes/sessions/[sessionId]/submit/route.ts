import { premiumSessionSubmitRequestSchema } from '@/dtos/premium-quiz';
import { withPremiumSessionAction } from '@/lib/api/premium-quiz-action';
import { getPremiumQuizService } from '@/lib/premium-quiz-factory';

export const dynamic = 'force-dynamic';

/** The key is echoed back so a retried submit can be recognised as the same one. */
export const POST = withPremiumSessionAction(
  premiumSessionSubmitRequestSchema,
  'Submit Premium quiz session failed',
  async (actor, sessionId, body) => {
    const result = await getPremiumQuizService().submitSession(
      actor.userId,
      sessionId,
      body.idempotencyKey,
    );
    return { ...result, idempotencyKey: body.idempotencyKey };
  },
);
