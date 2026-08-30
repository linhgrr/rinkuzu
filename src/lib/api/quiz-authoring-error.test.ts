import { describe, expect, it } from 'vitest';

import { PremiumQuizError } from '@/entities/PremiumQuizError';
import { quizAuthoringErrorResponse } from '@/lib/api/quiz-authoring-error';
import { QuizCreationError } from '@/lib/quiz/errors';

/**
 * Creating a quiz and submitting a draft into one are the same authoring path
 * seen from two doors, and they used to state this mapping separately. The
 * split that matters is `premium_required`: the client reads 403 as "offer the
 * upgrade" and 400 as "fix the form", so a route that answered 400 here would
 * send someone to correct a draft that is already correct.
 */
describe('quizAuthoringErrorResponse', () => {
  it('answers a premium gate with the status the client upsells on', async () => {
    const response = quizAuthoringErrorResponse(
      new QuizCreationError('premium_required', 'Upgrade to publish this'),
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'premium_required' },
    });
  });

  it('answers every other authoring refusal as a validation error', async () => {
    for (const code of ['invalid_draft', 'invalid_folder', 'slug_conflict'] as const) {
      const response = quizAuthoringErrorResponse(new QuizCreationError(code, 'No good'));

      expect(response?.status).toBe(400);
      await expect(response?.json()).resolves.toMatchObject({
        error: { code: 'validation_error' },
      });
    }
  });

  it('routes a premium refusal through the premium mapper, headers and all', () => {
    const response = quizAuthoringErrorResponse(
      new PremiumQuizError('insufficient_credits', 'Not enough credits'),
    );

    expect(response?.status).toBe(403);
    expect(response?.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('recognises a premium error by name, not by identity', () => {
    // A PremiumQuizError minted against another copy of the class fails
    // `instanceof` while still being the same refusal. Both call sites matched on
    // the name before this was shared, and that behaviour is deliberate.
    const foreign = new Error('Not enough credits');
    foreign.name = 'PremiumQuizError';

    const response = quizAuthoringErrorResponse(foreign);

    expect(response).not.toBeNull();
    expect(response?.status).toBe(500);
  });

  it('returns null for anything else, leaving the caller its own tail', () => {
    expect(quizAuthoringErrorResponse(new Error('boom'))).toBeNull();
    expect(quizAuthoringErrorResponse('boom')).toBeNull();
  });
});
