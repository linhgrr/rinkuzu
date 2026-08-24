export class PremiumQuizError extends Error {
  constructor(
    readonly code:
      | 'not_found'
      | 'forbidden'
      | 'email_verification_required'
      | 'invalid_state'
      | 'insufficient_credits'
      | 'review_required'
      | 'session_expired'
      | 'invalid_cursor'
      | 'rate_limited'
      | 'conflict',
    message: string,
  ) {
    super(message);
    this.name = 'PremiumQuizError';
  }
}
