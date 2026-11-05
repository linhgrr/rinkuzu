import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { parseJsonBody } from '@/lib/api/validated';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getGuestAttemptClaimService } from '@/lib/guest-attempt-claim-factory';
import { claimGuestAttemptsRequestSchema, type ClaimGuestAttemptsResponseDto } from '@/dtos/quiz';

export const dynamic = 'force-dynamic';

/**
 * Claims the guest attempts whose tokens the browser kept (RIN-912 part 3).
 * Always 200 with the ids claimed: a wrong, expired or used token is dropped
 * and the response never says which check failed. Never log the tokens.
 */
export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const input = await parseJsonBody(request, claimGuestAttemptsRequestSchema);
  if (!input.ok) return input.response;

  const userRate = await checkAuthRateLimit('attempt_claim_user', userId);
  if (!userRate.allowed) return rateLimitResponse(userRate);
  const { ip } = extractRequestContext(request);
  const ipRate = await checkAuthRateLimit('attempt_claim_ip', ip ?? 'unknown');
  if (!ipRate.allowed) return rateLimitResponse(ipRate);

  try {
    const claimedAttemptIds = await getGuestAttemptClaimService().claim(userId, input.data.tokens);
    return apiOk<ClaimGuestAttemptsResponseDto>({ claimedAttemptIds });
  } catch (error) {
    // Only the error class: a driver error can carry the filter, and with it a hash.
    logger.error(
      { errorName: error instanceof Error ? error.name : 'unknown' },
      'Guest attempt claim failed',
    );
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
