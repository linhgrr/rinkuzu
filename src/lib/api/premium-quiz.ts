import { apiErr } from '@/lib/api/response';
import { PremiumQuizError } from '@/entities/PremiumQuizError';

export const PREMIUM_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex',
} as const;

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
    }
  }
  for (const [name, value] of Object.entries(PREMIUM_PRIVATE_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
