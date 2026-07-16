export class QuizAttemptIdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used for a different quiz submission');
    this.name = 'QuizAttemptIdempotencyConflictError';
  }
}
