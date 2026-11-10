import type { NextRequest } from 'next/server';

import { createGuestDraftFieldsSchema } from '@/dtos/guest-draft';
import { apiErr } from '@/lib/api/response';
import { extractRequestContext } from '@/lib/audit';
import { getGuestDraftService } from '@/lib/guest-draft-factory';
import { guestDraftResponse } from '@/lib/guest-draft/response';
import {
  GUEST_DRAFT_MAX_PDF_BYTES,
  GUEST_DRAFT_TOKEN_HEADER,
} from '@/shared/constants/guest-draft';

export const dynamic = 'force-dynamic';

/** Multipart overhead allowed on top of the PDF before the body is read at all. */
const MULTIPART_SLACK_BYTES = 64 * 1024;
const PDF_MAGIC = '%PDF-';

function tooLarge() {
  return apiErr('validation_error', 'PDF is larger than the guest limit', 413, {
    reason: 'guest_pdf_too_large',
    limit_mb: GUEST_DRAFT_MAX_PDF_BYTES / (1024 * 1024),
  });
}

async function isPdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, PDF_MAGIC.length).arrayBuffer());
  return new TextDecoder().decode(head) === PDF_MAGIC;
}

async function readForm(request: NextRequest): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/**
 * Guest quiz from the visitor's own PDF (RIN-1446), no account. The file is checked
 * here (type, ≤ 10 MB) before the caps, and the caps before any OCR or LLM call.
 * The token arrives in a header and only its hash is stored; nothing here is logged.
 */
export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > GUEST_DRAFT_MAX_PDF_BYTES + MULTIPART_SLACK_BYTES) return tooLarge();

  const form = await readForm(request);
  const fields = createGuestDraftFieldsSchema.safeParse({
    token: request.headers.get(GUEST_DRAFT_TOKEN_HEADER),
    locale: form?.get('locale'),
    entry: form?.get('entry'),
  });
  if (!fields.success) return apiErr('validation_error', 'Invalid guest draft request', 400);

  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0)
    return apiErr('validation_error', 'A PDF file is required', 400);
  if (file.size > GUEST_DRAFT_MAX_PDF_BYTES) return tooLarge();
  if (file.type !== 'application/pdf' || !(await isPdf(file))) {
    return apiErr('unsupported_media_type', 'Only PDF files are accepted', 415);
  }

  const result = await getGuestDraftService().create({
    ...fields.data,
    pdf: file,
    ip: extractRequestContext(request).ip,
  });
  return guestDraftResponse(result, 201);
}
