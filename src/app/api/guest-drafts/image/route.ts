import type { NextRequest } from 'next/server';

import { createGuestDraftFieldsSchema } from '@/dtos/guest-draft';
import { apiErr } from '@/lib/api/response';
import { extractRequestContext } from '@/lib/audit';
import { getGuestDraftService } from '@/lib/guest-draft-factory';
import { guestDraftResponse } from '@/lib/guest-draft/response';
import { countImageRejection, readImageUploadForm } from '@/lib/quiz/image-source-request';
import { GUEST_DRAFT_TOKEN_HEADER } from '@/shared/constants/guest-draft';

export const dynamic = 'force-dynamic';
/** The API runs OCR on every page before it answers (RIN-1782); the upstream call waits 50 s. */
export const maxDuration = 60;

/**
 * Guest quiz from 1-5 photos (RIN-1792), no account. The photos are checked here (JPEG,
 * count, size) before the caps, and the caps before any OCR. Same token header, locale,
 * entry and caps as the text route (one budget for all sources); a 422 `too_little_text`
 * or a 503 from the API gives the visitor's cap back. Photos are forwarded only: never
 * stored, logged or put in an event.
 */
export async function POST(request: NextRequest) {
  const upload = await readImageUploadForm(request, 'try_photo');
  if (!upload.ok) return upload.response;

  const fields = createGuestDraftFieldsSchema.safeParse({
    token: request.headers.get(GUEST_DRAFT_TOKEN_HEADER),
    locale: upload.form.get('locale'),
    entry: upload.form.get('entry'),
  });
  if (!fields.success) return apiErr('validation_error', 'Invalid guest draft request', 400);

  const result = await getGuestDraftService().createFromImages({
    ...fields.data,
    images: upload.images,
    ip: extractRequestContext(request).ip,
  });
  if (!result.ok && result.error === 'upstream' && result.code === 'too_little_text') {
    const bytes = upload.images.reduce((sum, image) => sum + image.size, 0);
    await countImageRejection('try_photo', 'too_little_text', bytes);
  }
  return guestDraftResponse(result, 201);
}
