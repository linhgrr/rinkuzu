import { z } from 'zod';

import { withAdmin } from '@/lib/api/auth';
import { apiErr, apiOk } from '@/lib/api/response';
import { backfillActivationNudges } from '@/lib/communication/activation-nudge';
import {
  assertCommunicationMutationRequest,
  communicationHttpError,
} from '@/lib/communication/http';
import { logger } from '@/lib/logger';

const bodySchema = z.object({ mode: z.enum(['dry-run', 'apply']) });

/**
 * One-time activation-nudge backfill (RIN-1002), driven by
 * `scripts/activation-nudge-backfill.mjs`. Answers with counts only.
 */
export const POST = withAdmin(async (request) => {
  try {
    assertCommunicationMutationRequest(request);
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiErr('validation_error', 'mode must be dry-run or apply', 400);
    const report = await backfillActivationNudges(body.data.mode);
    logger.info({ event: 'activation_nudge_backfill', ...report }, 'Backfill run');
    return apiOk(report);
  } catch (error) {
    return communicationHttpError(error, 'activation-nudge-backfill');
  }
});
