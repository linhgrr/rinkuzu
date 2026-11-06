import type { ClaimGuestAttemptsResponseDto } from '@/dtos/quiz';
import { clearGuestClaims, readGuestClaims } from '@/features/quiz/lib/guest-claims';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { ApiResponseError, fetchApiData } from '@/lib/api/client';

let claimRun: Promise<void> | null = null;

async function postStoredGuestClaims(): Promise<void> {
  const tokens = readGuestClaims().map((claim) => claim.token);
  if (tokens.length === 0) return;
  try {
    const { claimedAttemptIds } = await fetchApiData<ClaimGuestAttemptsResponseDto>(
      '/api/attempts/claim',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      },
    );
    // The server already dropped wrong, expired or used tokens: forget them all.
    clearGuestClaims();
    if (claimedAttemptIds.length > 0) {
      // The count only: never the ids, the tokens or the email.
      captureAnalyticsEvent('guest_attempt_claimed', { count: claimedAttemptIds.length });
    }
  } catch (error) {
    // A 400 means the stored tokens can never pass; anything else (429, 5xx,
    // offline) keeps them for the next page load.
    if (error instanceof ApiResponseError && error.status === 400) clearGuestClaims();
  }
}

/**
 * Claims the guest results this browser kept, once per page load, for the
 * learner who is now signed in (RIN-912 part 4). Every caller shares the same
 * run, so the result page can wait for it before it reads the attempt. Never
 * rejects.
 */
export function claimStoredGuestAttempts(): Promise<void> {
  claimRun ??= postStoredGuestClaims();
  return claimRun;
}
