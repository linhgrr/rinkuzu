/**
 * Writes the quiz's `indexHold` (RIN-1343). Its own port so the report flow
 * does not widen IQuizRepository and every fake of it.
 */
export interface IQuizIndexHoldRepository {
  /** Sets `indexHold: { reason: 'reported', since }` unless a hold is already set. */
  holdForReport(quizId: string, since: Date): Promise<void>;

  /** Removes a `reported` hold; a no-op when the quiz has none. */
  releaseReportHold(quizId: string): Promise<void>;
}
