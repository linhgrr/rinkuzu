import type { IGuestAttemptClaimRepository } from '@/interfaces/repositories/IQuizAttemptProgressRepository';
import type { IGuestAttemptClaimService } from '@/interfaces/services/IGuestAttemptClaimService';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';

/** A guest attempt can be claimed for 24 hours after it was taken (RIN-912 AC4). */
const GUEST_ATTEMPT_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

type Clock = () => Date;

/**
 * Attaches the attempts a guest took before signing up to the new account.
 * Only hashes reach the repository; neither tokens nor hashes are logged.
 */
export class GuestAttemptClaimService implements IGuestAttemptClaimService {
  constructor(
    private readonly repository: IGuestAttemptClaimRepository,
    private readonly now: Clock = () => new Date(),
  ) {}

  async claim(userId: string, tokens: readonly string[]): Promise<string[]> {
    return this.claimHashed(userId, tokens.map(hashGuestClaimToken));
  }

  async claimHashed(userId: string, tokenHashes: readonly string[]): Promise<string[]> {
    const hashes = [...new Set(tokenHashes)];
    if (hashes.length === 0) return [];
    const now = this.now();
    const claimableSince = new Date(now.getTime() - GUEST_ATTEMPT_CLAIM_WINDOW_MS);
    return this.repository.claimGuestAttempts(userId, hashes, now, claimableSince);
  }
}
