import { apiErr } from '@/lib/api/response';
import { PremiumQuizError, PremiumSubmissionFailedError } from '@/entities/PremiumQuizError';

export const PREMIUM_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
} as const;

/**
 * RIN-1347: keeps the status of the Premium refusal that caused the failure
 * (an infrastructure failure is a 502), under one code the client turns into
 * "saved as public, retry Premium from the edit page".
 */
function submissionFailedResponse(error: PremiumQuizError): Response {
  const causeCode = error instanceof PremiumSubmissionFailedError ? error.causeCode : null;
  const status =
    causeCode === null || causeCode === 'premium_submission_failed'
      ? 502
      : premiumQuizErrorResponse(new PremiumQuizError(causeCode, error.message)).status;
  return apiErr('premium_submission_failed', error.message, status, {
    reason: causeCode ?? 'internal_error',
    visibility: 'public',
    ...(error instanceof PremiumSubmissionFailedError ? { quizId: error.quizId } : {}),
  });
}

export function premiumQuizErrorResponse(error: unknown): Response {
  let response: Response;
  if (!(error instanceof PremiumQuizError)) {
    response = apiErr('internal_error', 'Internal server error', 500);
  } else {
    switch (error.code) {
      case 'not_found':
        response = apiErr('not_found', error.message, 404);
        break;
      case 'forbidden':
        response = apiErr('forbidden', error.message, 403);
        break;
      case 'email_verification_required':
        response = apiErr('forbidden', error.message, 403, { reason: error.code });
        break;
      case 'insufficient_credits':
      case 'unlock_required':
        response = apiErr('premium_required', error.message, 403, { reason: error.code });
        break;
      case 'session_expired':
        response = apiErr('conflict', error.message, 409, { reason: error.code });
        break;
      case 'invalid_cursor':
        response = apiErr('validation_error', error.message, 400, { reason: error.code });
        break;
      case 'rate_limited':
        response = apiErr('rate_limit_exceeded', error.message, 429, { reason: error.code });
        break;
      case 'review_required':
      case 'invalid_state':
      case 'conflict':
        response = apiErr('conflict', error.message, 409, { reason: error.code });
        break;
      case 'premium_submission_failed':
        response = submissionFailedResponse(error);
        break;
    }
  }
  for (const [name, value] of Object.entries(PREMIUM_PRIVATE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
