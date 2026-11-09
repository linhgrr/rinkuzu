export interface IGuestAttemptClaimService {
  /** Ids of the guest attempts now owned by `userId`; tokens that match nothing are dropped. */
  claim(userId: string, tokens: readonly string[]): Promise<string[]>;

  /** Same as `claim`, for token hashes stored server-side at sign-up (RIN-1310). */
  claimHashed(userId: string, hashes: readonly string[]): Promise<string[]>;
}
