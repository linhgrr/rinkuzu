import type { NextRequest } from 'next/server';

import { guestDraftAttemptRequestSchema } from '@/dtos/guest-draft';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';
import { getGuestDraftAttemptService } from '@/lib/guest-draft-factory';

export const dynamic = 'force-dynamic';

/**
 * A signed-out attempt on a ready guest draft (RIN-1446), scored on the server. It is
 * stored as a RIN-912 guest attempt, so `GET /api/attempts/<id>` with the claim token
 * shows the result and signing up claims it.
 */
export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, guestDraftAttemptRequestSchema);
  if (!input.ok) return input.response;
  const result = await getGuestDraftAttemptService().submit(input.data);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
}
