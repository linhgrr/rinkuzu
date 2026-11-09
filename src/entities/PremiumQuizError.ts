export type PremiumQuizErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'email_verification_required'
  | 'invalid_state'
  | 'insufficient_credits'
  | 'unlock_required'
  | 'review_required'
  | 'session_expired'
  | 'invalid_cursor'
  | 'rate_limited'
  | 'conflict'
  | 'premium_submission_failed';

export class PremiumQuizError extends Error {
  constructor(
    readonly code: PremiumQuizErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PremiumQuizError';
  }
}

/**
 * RIN-1347: the quiz was saved, its Premium submission failed, and the quiz was
 * set back to public so it is not left private with nothing under review.
 * `causeCode` is the Premium refusal that caused it, or null for an
 * infrastructure failure (storage copy, database).
 */
export class PremiumSubmissionFailedError extends PremiumQuizError {
  readonly causeCode: PremiumQuizErrorCode | null;

  constructor(
    readonly quizId: string,
    cause: unknown,
  ) {
    super(
      'premium_submission_failed',
      'The quiz was saved as public, but its Premium submission failed',
    );
    this.causeCode = cause instanceof PremiumQuizError ? cause.code : null;
  }
}
