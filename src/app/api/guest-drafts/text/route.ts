import type { NextRequest } from 'next/server';

import { createGuestTextDraftRequestSchema } from '@/dtos/guest-draft';
import { apiErr } from '@/lib/api/response';
import { extractRequestContext } from '@/lib/audit';
import { getGuestDraftService } from '@/lib/guest-draft-factory';
import { guestDraftResponse } from '@/lib/guest-draft/response';
import { quizTextLengthRefusal, readQuizTextBody } from '@/lib/quiz/text-source-request';
import { GUEST_DRAFT_TOKEN_HEADER } from '@/shared/constants/guest-draft';

export const dynamic = 'force-dynamic';

/**
 * Guest quiz from pasted text (RIN-1538), no account. Same token header, locale and entry
 * as the PDF route, and the same per-IP and global caps (one budget for both sources),
 * checked before any LLM call. The text goes to the API only: it is never logged, stored
 * here or put in an event.
 */
export async function POST(request: NextRequest) {
  const read = await readQuizTextBody(request, 'guest_');
  if (!read.ok) return read.response;

  const body = typeof read.body === 'object' && read.body !== null ? read.body : {};
  const parsed = createGuestTextDraftRequestSchema.safeParse({
    ...body,
    token: request.headers.get(GUEST_DRAFT_TOKEN_HEADER),
  });
  if (!parsed.success) {
    return (
      quizTextLengthRefusal(parsed.error, 'guest_') ??
      apiErr('validation_error', 'Invalid guest draft request', 400)
    );
  }

  const result = await getGuestDraftService().createFromText({
    ...parsed.data,
    ip: extractRequestContext(request).ip,
  });
  return guestDraftResponse(result, 201);
}
