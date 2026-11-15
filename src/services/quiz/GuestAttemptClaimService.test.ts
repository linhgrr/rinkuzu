import { describe, expect, it, vi } from 'vitest';

import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { GuestAttemptClaimService } from '@/services/quiz/GuestAttemptClaimService';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const TOKEN = 'A'.repeat(43);
const OTHER = 'b'.repeat(43);

function service() {
  const repository = {
    claimGuestAttempts: vi.fn().mockResolvedValue([{ attemptId: 'attempt-1', tokenHash: 'h' }]),
  };
  return { repository, claims: new GuestAttemptClaimService(repository, () => NOW) };
}

describe('GuestAttemptClaimService', () => {
  it('passes only deduplicated hashes and a 7 day window to the repository', async () => {
    const { repository, claims } = service();

    await expect(claims.claim('user-1', [TOKEN, OTHER, TOKEN])).resolves.toEqual(['attempt-1']);

    expect(repository.claimGuestAttempts).toHaveBeenCalledWith(
      'user-1',
      [hashGuestClaimToken(TOKEN), hashGuestClaimToken(OTHER)],
      NOW,
      new Date('2026-10-29T12:00:00.000Z'),
    );
    expect(JSON.stringify(repository.claimGuestAttempts.mock.calls)).not.toContain(TOKEN);
  });

  it('window includes a 6 day old attempt and excludes an 8 day old one', async () => {
    const { repository, claims } = service();
    await claims.claim('user-1', [TOKEN]);
    const since = (repository.claimGuestAttempts.mock.calls[0]?.[3] as Date).getTime();
    const day = 24 * 60 * 60 * 1000;
    expect(NOW.getTime() - 6 * day).toBeGreaterThanOrEqual(since);
    expect(NOW.getTime() - 8 * day).toBeLessThan(since);
  });

  it('does not touch the repository for an empty list', async () => {
    const { repository, claims } = service();
    await expect(claims.claim('user-1', [])).resolves.toEqual([]);
    expect(repository.claimGuestAttempts).not.toHaveBeenCalled();
  });
});
