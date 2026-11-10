import type { ClaimGuestDraftsResponseDto } from '@/dtos/guest-draft';
import type { ClaimGuestAttemptsResponseDto } from '@/dtos/quiz';
import { clearGuestClaims, readGuestClaims } from '@/features/quiz/lib/guest-claims';
import {
  clearGuestDraftClaims,
  readGuestDraftClaims,
} from '@/features/quiz/lib/guest-draft-claims';
import { captureAnalyticsEvent } from '@/lib/analytics/client';
import { ApiResponseError, fetchApiData } from '@/lib/api/client';

let claimRun: Promise<void> | null = null;

/**
 * The guest's own-PDF quizzes first (RIN-1447): the claim moves their attempts to the
 * new quiz and attaches them, so the attempt claim after it finds them done.
 */
async function postStoredGuestDrafts(): Promise<void> {
  const tokens = readGuestDraftClaims().map((claim) => claim.token);
  if (tokens.length === 0) return;
  try {
    await fetchApiData<ClaimGuestDraftsResponseDto>('/api/guest-drafts/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
    });
    // The server already dropped wrong, expired or used tokens: forget them all.
    clearGuestDraftClaims();
  } catch (error) {
    // Same rule as the attempts: only a 400 means the tokens can never pass.
    if (error instanceof ApiResponseError && error.status === 400) clearGuestDraftClaims();
  }
}

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
 * Claims the guest drafts and results this browser kept, once per page load, for the
 * learner who is now signed in (RIN-912 part 4). Every caller shares the same
 * run, so the result page can wait for it before it reads the attempt. Never
 * rejects.
 */
export function claimStoredGuestAttempts(): Promise<void> {
  claimRun ??= postStoredGuestDrafts().then(postStoredGuestClaims);
  return claimRun;
}
