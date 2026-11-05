export interface IGuestAttemptClaimService {
  /** Ids of the guest attempts now owned by `userId`; tokens that match nothing are dropped. */
  claim(userId: string, tokens: readonly string[]): Promise<string[]>;
}
