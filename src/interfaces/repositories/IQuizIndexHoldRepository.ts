/**
 * Writes the quiz's `indexHold` (RIN-1343). Its own port so the report flow
 * does not widen IQuizRepository and every fake of it.
 */
export interface IQuizIndexHoldRepository {
  /**
   * Sets `indexHold: { reason: 'reported', since }` unless a hold is already
   * set. True when this call set it (RIN-1500 pings only on a real change).
   */
  holdForReport(quizId: string, since: Date): Promise<boolean>;

  /** Removes a `reported` hold; a no-op when the quiz has none. True when removed. */
  releaseReportHold(quizId: string): Promise<boolean>;
}
