import { describe, expect, it, vi } from 'vitest';

import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { GuestAttemptClaimService } from '@/services/quiz/GuestAttemptClaimService';

const NOW = new Date('2026-11-05T12:00:00.000Z');
const TOKEN = 'A'.repeat(43);
const OTHER = 'b'.repeat(43);

function service() {
  const repository = { claimGuestAttempts: vi.fn().mockResolvedValue(['attempt-1']) };
  return { repository, claims: new GuestAttemptClaimService(repository, () => NOW) };
}

describe('GuestAttemptClaimService', () => {
  it('passes only deduplicated hashes and a 24 h window to the repository', async () => {
    const { repository, claims } = service();

    await expect(claims.claim('user-1', [TOKEN, OTHER, TOKEN])).resolves.toEqual(['attempt-1']);

    expect(repository.claimGuestAttempts).toHaveBeenCalledWith(
      'user-1',
      [hashGuestClaimToken(TOKEN), hashGuestClaimToken(OTHER)],
      NOW,
      new Date('2026-11-04T12:00:00.000Z'),
    );
    expect(JSON.stringify(repository.claimGuestAttempts.mock.calls)).not.toContain(TOKEN);
  });

  it('does not touch the repository for an empty list', async () => {
    const { repository, claims } = service();
    await expect(claims.claim('user-1', [])).resolves.toEqual([]);
    expect(repository.claimGuestAttempts).not.toHaveBeenCalled();
  });
});
