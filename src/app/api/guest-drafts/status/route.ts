import type { NextRequest } from 'next/server';

import { guestDraftTokenRequestSchema } from '@/dtos/guest-draft';
import { parseJsonBody } from '@/lib/api/validated';
import { extractRequestContext } from '@/lib/audit';
import { getGuestDraftService } from '@/lib/guest-draft-factory';
import { guestDraftResponse } from '@/lib/guest-draft/response';

export const dynamic = 'force-dynamic';

/**
 * Progress of a guest draft (RIN-1446). POST so the token rides in the body, never in
 * a URL. The first `ready` copies the questions here and deletes the API draft.
 */
export async function POST(request: NextRequest) {
  const input = await parseJsonBody(request, guestDraftTokenRequestSchema);
  if (!input.ok) return input.response;
  const result = await getGuestDraftService().status(
    input.data.token,
    extractRequestContext(request).ip,
  );
  return guestDraftResponse(result);
}
