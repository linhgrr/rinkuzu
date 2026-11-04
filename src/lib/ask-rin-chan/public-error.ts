import { describeApiError, type ApiErrorKind } from '@/lib/api/error-kind';

export type AskRinPublicErrorKey =
  | 'errorBusy'
  | 'errorConnection'
  | 'errorContextExpired'
  | 'errorImageUnsupported'
  | 'errorInvalidRequest'
  | 'errorQuota'
  | 'errorRateLimited'
  | 'errorRunFailed';

const PUBLIC_ERROR_KEY_BY_CODE: Readonly<Record<string, AskRinPublicErrorKey>> = {
  ask_rin_context_invalid: 'errorContextExpired',
  ask_rin_context_stale: 'errorContextExpired',
  ask_rin_conversation_busy: 'errorBusy',
  ask_rin_request_in_progress: 'errorBusy',
  request_in_progress: 'errorBusy',
  ask_rin_image_unsupported: 'errorImageUnsupported',
  ask_rin_run_failed: 'errorRunFailed',
  premium_required: 'errorQuota',
  quota_exceeded: 'errorQuota',
  rate_limit_exceeded: 'errorRateLimited',
  validation_error: 'errorInvalidRequest',
};

/** Kinds where Rin-chan's own copy reads better than the shared `errors.api.*` copy. */
const PUBLIC_ERROR_KEY_BY_KIND: Partial<Record<ApiErrorKind, AskRinPublicErrorKey>> = {
  network: 'errorConnection',
  unknown: 'errorConnection',
  rate_limited: 'errorRateLimited',
  unlock_required: 'errorQuota',
  validation: 'errorInvalidRequest',
};

/**
 * Maps an Ask Rin-chan failure to an allowlisted `adaptiveLearning.chatbot.*` key.
 * Returns null when the shared API error layer owns the copy (server, unavailable,
 * auth, conflict, aborted): render it with `useApiErrorMessage` (RIN-748).
 * Never derives text from the server message or detail.
 */
export function getAskRinPublicErrorKey(error: unknown): AskRinPublicErrorKey | null {
  const { code, kind } = describeApiError(error);
  const byCode = code ? PUBLIC_ERROR_KEY_BY_CODE[code] : undefined;
  return byCode ?? PUBLIC_ERROR_KEY_BY_KIND[kind] ?? null;
}
