import { premiumQuizErrorResponse } from '@/lib/api/premium-quiz';
import { apiErr } from '@/lib/api/response';
import { QuizCreationError } from '@/lib/quiz/errors';

/**
 * The two refusals both quiz-authoring entry points can raise.
 *
 * Creating a quiz outright and submitting a draft into one run the same
 * authoring path, so they fail the same two ways: a premium gate the caller has
 * not cleared, and a draft the composer will not accept. Mapping those to a
 * status is a policy decision — `premium_required` is a 403 the client uses to
 * offer an upgrade, everything else is a 400 the client shows as a field error —
 * and stating it twice is how the two entry points drift into answering the same
 * refusal differently.
 *
 * Returns null when the error is neither, so the caller keeps its own tail: the
 * two routes genuinely differ there, and swallowing an unknown error into a
 * shared 500 would hide that difference rather than share it.
 */
export function quizAuthoringErrorResponse(error: unknown): Response | null {
  // Matched by name, not by `instanceof`, exactly as both routes did before this
  // was shared: the premium path can hand back an error minted against another
  // copy of the class, where `instanceof` silently says no.
  if (error instanceof Error && error.name === 'PremiumQuizError') {
    return premiumQuizErrorResponse(error);
  }
  if (error instanceof QuizCreationError) {
    const premiumGate = error.code === 'premium_required';
    return apiErr(
      premiumGate ? 'premium_required' : 'validation_error',
      error.message,
      premiumGate ? 403 : 400,
    );
  }
  return null;
}
