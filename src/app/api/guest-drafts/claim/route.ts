import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { parseJsonBody } from '@/lib/api/validated';
import { extractRequestContext } from '@/lib/audit';
import { checkAuthRateLimit, rateLimitResponse } from '@/lib/auth-rate-limit';
import { getGuestDraftClaimService } from '@/lib/guest-draft-claim-factory';
import {
  claimGuestDraftsRequestSchema,
  type ClaimGuestDraftsResponseDto,
} from '@/dtos/guest-draft';

export const dynamic = 'force-dynamic';

/**
 * Claims the guest drafts whose tokens the browser kept (RIN-1447): each becomes a
 * public quiz in the account. Always 200 with the quizzes made: a wrong, expired or
 * used token is dropped and the response never says which check failed. Never log
 * the tokens.
 */
export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const input = await parseJsonBody(request, claimGuestDraftsRequestSchema);
  if (!input.ok) return input.response;

  const userRate = await checkAuthRateLimit('guest_draft_claim_user', userId);
  if (!userRate.allowed) return rateLimitResponse(userRate);
  const { ip } = extractRequestContext(request);
  const ipRate = await checkAuthRateLimit('guest_draft_claim_ip', ip ?? 'unknown');
  if (!ipRate.allowed) return rateLimitResponse(ipRate);

  try {
    const claimedQuizSlugs = await getGuestDraftClaimService().claim(userId, input.data.tokens);
    return apiOk<ClaimGuestDraftsResponseDto>({ claimedQuizSlugs });
  } catch (error) {
    // Only the error class: a driver error can carry the filter, and with it a hash.
    logger.error(
      { errorName: error instanceof Error ? error.name : 'unknown' },
      'Guest draft claim failed',
    );
    return apiErr('internal_error', 'Internal server error', 500);
  }
});
