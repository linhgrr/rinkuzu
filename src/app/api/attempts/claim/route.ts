import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { parseJsonBody } from '@/lib/api/validated';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getGuestAttemptClaimService } from '@/lib/guest-attempt-claim-factory';
import { claimGuestAttemptsRequestSchema, type ClaimGuestAttemptsResponseDto } from '@/dtos/quiz';
import { ipBucketKey } from '@/lib/client-ip';
import { resolveAccountLocale } from '@/lib/auth/account-locale';
import { hashGuestClaimToken } from '@/lib/guest-claim-token';
import { optInReviewReminder } from '@/lib/communication/review-reminder';

export const dynamic = 'force-dynamic';

/**
 * Records the 2-day review opt-in for each claimed attempt whose token the card
 * ticked (RIN-1711). A failure (too old, capped, email off) drops that attempt
 * from the result and never fails the claim.
 */
async function recordReviewOptIns(
  request: NextRequest,
  userId: string,
  email: string,
  claimed: ReadonlyArray<{ attemptId: string; tokenHash: string }>,
  optInTokens: readonly string[] | undefined,
): Promise<string[]> {
  if (!optInTokens || optInTokens.length === 0) return [];
  const wanted = new Set(optInTokens.map(hashGuestClaimToken));
  const locale =
    resolveAccountLocale({
      referer: request.headers.get('referer'),
      cookies: request.cookies,
    }) === 'en'
      ? 'en'
      : 'vi';
  const { ip } = extractRequestContext(request);
  const optedIn: string[] = [];
  for (const { attemptId, tokenHash } of claimed) {
    if (!wanted.has(tokenHash)) continue;
    try {
      await optInReviewReminder({
        userId,
        email,
        attemptId,
        locale,
        ip,
        consentSource: 'guest_result_review',
      });
      optedIn.push(attemptId);
    } catch (error) {
      logger.warn(
        { errorName: error instanceof Error ? error.name : 'unknown' },
        'Guest claim review opt-in skipped',
      );
    }
  }
  return optedIn;
}

/**
 * Claims the guest attempts whose tokens the browser kept (RIN-912 part 3).
 * Always 200 with the ids claimed: a wrong, expired or used token is dropped
 * and the response never says which check failed. Never log the tokens.
 */
export const POST = withAuth(async (request: NextRequest, { userId, email }) => {
  const input = await parseJsonBody(request, claimGuestAttemptsRequestSchema);
  if (!input.ok) return input.response;

  const userRate = await checkAuthRateLimit('attempt_claim_user', userId);
  if (!userRate.allowed) return rateLimitResponse(userRate);
  const { ip } = extractRequestContext(request);
  const ipRate = await checkAuthRateLimit('attempt_claim_ip', ipBucketKey(ip));
  if (!ipRate.allowed) return rateLimitResponse(ipRate);

  try {
    const claimed = await getGuestAttemptClaimService().claimWithHashes(userId, input.data.tokens);
    const reviewOptInAttemptIds = await recordReviewOptIns(
      request,
      userId,
      email,
      claimed,
      input.data.reviewOptInTokens,
    );
    return apiOk<ClaimGuestAttemptsResponseDto>({
      claimedAttemptIds: claimed.map((claim) => claim.attemptId),
      reviewOptInAttemptIds,
    });
  } catch (error) {
    // Only the error class: a driver error can carry the filter, and with it a hash.
    logger.error(
      { errorName: error instanceof Error ? error.name : 'unknown' },
      'Guest attempt claim failed',
    );
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
