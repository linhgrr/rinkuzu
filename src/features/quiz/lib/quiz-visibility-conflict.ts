/**
 * Thrown by a page's save handler when the API refuses to make the quiz public
 * (409: it has an active Premium publication). The editor then puts the control
 * back to Private and shows `message` under it (RIN-1275).
 */
export class QuizVisibilityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuizVisibilityConflictError';
  }
}

/** True for the 409 the quiz update API returns when a public switch is refused. */
export function isQuizVisibilityConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 409
  );
}
