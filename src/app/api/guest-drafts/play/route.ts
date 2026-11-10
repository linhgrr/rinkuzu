import type { NextRequest } from 'next/server';

import { guestDraftPlayRequestSchema } from '@/dtos/guest-draft';
import { apiOk, apiServiceErr } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validated';
import { getGuestDraftAttemptService } from '@/lib/guest-draft-factory';

export const dynamic = 'force-dynamic';

/**
 * The questions of a ready guest draft (RIN-1446), without correct answers. POST so the
 * token rides in the body, never in a URL. 404 until the draft is ready.
 */
export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, guestDraftPlayRequestSchema);
  if (!input.ok) return input.response;
  const result = await getGuestDraftAttemptService().play(input.data.token);
  return result.success ? apiOk(result.data) : apiServiceErr(result);
}
