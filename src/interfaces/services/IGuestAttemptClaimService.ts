import type { ClaimedGuestAttemptRef } from '@/interfaces/repositories/IQuizAttemptProgressRepository';

export interface IGuestAttemptClaimService {
  /** Ids of the guest attempts now owned by `userId`; tokens that match nothing are dropped. */
  claim(userId: string, tokens: readonly string[]): Promise<string[]>;

  /** Same as `claim`, with the hash of the token behind each claimed attempt (RIN-1711). */
  claimWithHashes(userId: string, tokens: readonly string[]): Promise<ClaimedGuestAttemptRef[]>;

  /** Same as `claim`, for token hashes stored server-side at sign-up (RIN-1310). */
  claimHashed(userId: string, hashes: readonly string[]): Promise<string[]>;
}
