export interface IGuestDraftClaimService {
  /**
   * Turns each ready, unexpired guest draft whose token the learner holds into a public
   * quiz they own (RIN-1447). Returns the new quizzes' slugs; tokens that match
   * nothing are dropped without saying why.
   */
  claim(userId: string, tokens: readonly string[]): Promise<string[]>;

  /** Same as `claim`, for token hashes stored server-side at sign-up (RIN-1310). */
  claimHashed(userId: string, hashes: readonly string[]): Promise<string[]>;
}
