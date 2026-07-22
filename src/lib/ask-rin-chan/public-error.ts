export type AskRinPublicErrorKey =
  | 'errorBusy'
  | 'errorConnection'
  | 'errorContextExpired'
  | 'errorImageUnsupported'
  | 'errorInvalidRequest'
  | 'errorQuota'
  | 'errorRateLimited';

const PUBLIC_ERROR_KEY_BY_CODE: Readonly<Record<string, AskRinPublicErrorKey>> = {
  ask_rin_context_invalid: 'errorContextExpired',
  ask_rin_context_stale: 'errorContextExpired',
  ask_rin_conversation_busy: 'errorBusy',
  ask_rin_request_in_progress: 'errorBusy',
  request_in_progress: 'errorBusy',
  ask_rin_image_unsupported: 'errorImageUnsupported',
  premium_required: 'errorQuota',
  quota_exceeded: 'errorQuota',
  rate_limit_exceeded: 'errorRateLimited',
  validation_error: 'errorInvalidRequest',
};

/** Maps transport/domain failures to an allowlisted, localizable user message. */
export function getAskRinPublicErrorKey(error: unknown): AskRinPublicErrorKey {
  if (!error || typeof error !== 'object') return 'errorConnection';
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') return 'errorConnection';
  return PUBLIC_ERROR_KEY_BY_CODE[code] ?? 'errorConnection';
}
