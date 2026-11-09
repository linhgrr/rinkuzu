import { describe, expect, it } from 'vitest';
import { PremiumQuizError, PremiumSubmissionFailedError } from '@/entities/PremiumQuizError';
import { premiumQuizErrorResponse } from '@/lib/api/premium-quiz';

describe('premiumQuizErrorResponse premium_submission_failed (RIN-1347)', () => {
  it('answers an infrastructure cause with 502 and says the quiz is public', async () => {
    const response = premiumQuizErrorResponse(
      new PremiumSubmissionFailedError('quiz-1', new Error('storage copy failed')),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'premium_submission_failed',
        meta: { reason: 'internal_error', visibility: 'public', quizId: 'quiz-1' },
      },
    });
  });

  it('keeps the status of the Premium refusal that caused it', async () => {
    const response = premiumQuizErrorResponse(
      new PremiumSubmissionFailedError(
        'quiz-1',
        new PremiumQuizError('email_verification_required', 'Verify your email'),
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'premium_submission_failed',
        meta: { reason: 'email_verification_required' },
      },
    });
  });

  it('treats a bare premium_submission_failed error as an infrastructure failure', async () => {
    const response = premiumQuizErrorResponse(
      new PremiumQuizError('premium_submission_failed', 'failed'),
    );

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: { meta: Record<string, unknown> } };
    expect(body.error.meta).toEqual({ reason: 'internal_error', visibility: 'public' });
  });
});
