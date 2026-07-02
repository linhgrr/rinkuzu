export type QuizCreationErrorCode =
  | 'invalid_draft'
  | 'invalid_folder'
  | 'premium_required'
  | 'slug_conflict';

export class QuizCreationError extends Error {
  constructor(
    readonly code: QuizCreationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'QuizCreationError';
  }
}

export class QuizDraftSynchronizationError extends Error {
  constructor(
    readonly draftId: string,
    readonly quizId: string,
    readonly upstreamStatus?: number,
  ) {
    super('Failed to synchronize the submitted quiz draft');
    this.name = 'QuizDraftSynchronizationError';
  }
}
