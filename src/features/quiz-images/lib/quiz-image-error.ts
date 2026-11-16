/** Why a photo (or a set of photos) was refused before upload (RIN-1782 c). */
export const QUIZ_IMAGE_ERROR_REASONS = [
  'unsupported_type',
  'too_large',
  'undecodable',
  'too_many',
  'total_too_large',
] as const;
export type QuizImageErrorReason = (typeof QUIZ_IMAGE_ERROR_REASONS)[number];

/**
 * Typed refusal from the on-device photo preparation. The message is a fixed English
 * string for logs and tests only; the learner-facing copy is chosen from `reason` by the UI.
 * It never carries a file name or any image data.
 */
export class QuizImageError extends Error {
  readonly reason: QuizImageErrorReason;
  /** Position in the files passed to `prepareQuizImages`, for per-photo reasons. */
  readonly fileIndex: number | undefined;

  constructor(reason: QuizImageErrorReason, fileIndex?: number) {
    super(`quiz image refused: ${reason}`);
    this.name = 'QuizImageError';
    this.reason = reason;
    this.fileIndex = fileIndex;
  }
}
