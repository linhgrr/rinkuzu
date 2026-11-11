import type { GuestDraftPlayDto, GuestDraftStatusDto } from '@/dtos/guest-draft';
import type { QuizAttemptResultDto } from '@/dtos/quiz';
import type { QuizPlayViewModel } from '@/features/quiz/types/quiz-play-view-model';
import type {
  GuestDraftAttemptInput,
  GuestDraftProgress,
  GuestDraftRefusal,
  SubmittedGuestDraftAttempt,
} from '@/features/guest-draft/types/guest-draft-view-model';
import { ApiResponseError, fetchApiData } from '@/lib/api/client';
import {
  GUEST_DRAFT_LIMIT_REASON,
  GUEST_DRAFT_PLAY_SLUG,
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

interface CreateGuestTextDraftInput {
  text: string;
  token: string;
  locale: 'vi' | 'en';
  entry: GuestDraftEntry;
}

/**
 * `POST /api/guest-drafts/text` (RIN-1538): pasted text instead of a PDF, same token header,
 * caps and progress as `createGuestDraft`. Refusals: 422 `guest_text_too_short` and 413
 * `guest_text_too_long`, each with `meta.limit_chars`.
 *
 * @public consumed by the /try/text page (RIN-1536 part C).
 */
export async function createGuestTextDraft({
  text,
  token,
  locale,
  entry,
}: CreateGuestTextDraftInput): Promise<GuestDraftProgress> {
  const dto = await fetchApiData<GuestDraftStatusDto>('/api/guest-drafts/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [GUEST_DRAFT_TOKEN_HEADER]: token },
    body: JSON.stringify({ text, locale, entry }),
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

/** The questions of a ready guest draft as the player's quiz (RIN-1448). 404: gone or not ready. */
export async function fetchGuestDraftPlay(token: string): Promise<QuizPlayViewModel> {
  const dto = await fetchApiData<GuestDraftPlayDto>('/api/guest-drafts/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const now = new Date().toISOString();
  return {
    id: GUEST_DRAFT_PLAY_SLUG,
    slug: GUEST_DRAFT_PLAY_SLUG,
    title: dto.title,
    author: null,
    folder: null,
    visibility: 'public',
    questionCount: dto.questions.length,
    createdAt: now,
    updatedAt: now,
    questions: dto.questions,
  };
}

/** `POST /api/guest-drafts/attempt`: scored on the server, stored as a RIN-912 guest attempt. */
export async function submitGuestDraftAttempt(
  token: string,
  input: GuestDraftAttemptInput,
): Promise<SubmittedGuestDraftAttempt> {
  const dto = await fetchApiData<QuizAttemptResultDto>('/api/guest-drafts/attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, ...input }),
  });
  return { attemptId: dto.attemptId, score: dto.score };
}

/** True when the draft is gone (expired, claimed, another browser): show the expired card. */
export function isGuestDraftGone(error: unknown): boolean {
  return error instanceof ApiResponseError && error.status === 404;
}
