import type { GuestDraftStatusDto } from '@/dtos/guest-draft';
import type {
  GuestDraftProgress,
  GuestDraftRefusal,
} from '@/features/guest-draft/types/guest-draft-view-model';
import { ApiResponseError, fetchApiData } from '@/lib/api/client';
import {
  GUEST_DRAFT_LIMIT_REASON,
  GUEST_DRAFT_TOKEN_HEADER,
  type GuestDraftEntry,
} from '@/shared/constants/guest-draft';

interface CreateGuestDraftInput {
  file: File;
  token: string;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
}

function toProgress(dto: GuestDraftStatusDto): GuestDraftProgress {
  return {
    status: dto.status,
    percent: Math.max(0, Math.min(100, Math.round(dto.progressPercent))),
    questionCount: dto.questionCount,
    title: dto.title,
  };
}

function metaReason(meta: unknown): Record<string, unknown> {
  return typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>) : {};
}

/**
 * Why the server refused an upload, in the words the page shows. The cap copy is the same
 * whichever cap fired; a too-large or too-long PDF gets the trial-limit alert.
 */
export function classifyGuestDraftError(error: unknown): GuestDraftRefusal {
  if (!(error instanceof ApiResponseError)) return 'upload_error';
  const meta = metaReason(error.meta);
  if (error.status === 429 && meta['reason'] === GUEST_DRAFT_LIMIT_REASON) return 'cap';
  if (error.status === 413 || meta['limit_pages'] !== undefined) return 'too_large';
  if (error.status === 415) return 'not_pdf';
  return 'upload_error';
}

/** `POST /api/guest-drafts` (RIN-1446): the token rides in a header, never in the URL. */
export async function createGuestDraft({
  file,
  token,
  locale,
  entry,
}: CreateGuestDraftInput): Promise<GuestDraftProgress> {
  const body = new FormData();
  body.append('file', file);
  body.append('locale', locale);
  body.append('entry', entry);
  const dto = await fetchApiData<GuestDraftStatusDto>('/api/guest-drafts', {
    method: 'POST',
    headers: { [GUEST_DRAFT_TOKEN_HEADER]: token },
    body,
  });
  return toProgress(dto);
}

/** `POST /api/guest-drafts/status`: the token in the body, never in a URL. */
export async function fetchGuestDraftProgress(token: string): Promise<GuestDraftProgress> {
  const dto = await fetchApiData<GuestDraftStatusDto>('/api/guest-drafts/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return toProgress(dto);
}
