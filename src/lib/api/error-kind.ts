/**
 * Client error layer (RIN-748 contract, sections 2-3).
 *
 * Classifies any thrown value from our own `/api/*` into a kind plus an i18n key.
 * Pure: no React, no server text in the result (only codes, statuses, field names).
 */
import errorCodeContract from '../../../contracts/api-error-codes.json';

const CODE_BY_STATUS: Readonly<Record<string, string>> = errorCodeContract.httpStatusToCode;

export type ApiErrorKind =
  | 'auth_required'
  | 'unlock_required'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'validation'
  | 'unavailable'
  | 'server'
  | 'network'
  | 'aborted'
  | 'unknown';

export interface DescribedApiError {
  kind: ApiErrorKind;
  code: string | null;
  status: number | null;
  /** Full next-intl key; empty for `aborted` (render nothing). */
  messageKey: string;
  messageValues?: Record<string, string | number>;
  retryable: boolean;
  retryAfterSeconds: number | null;
  fieldErrors: string[];
}

/** Codes whose server text may be shown to users. v1: empty (contract section 1). */
export const USER_SAFE_DETAIL_CODES: ReadonlySet<string> = new Set<string>();

/** Codes with their own copy under `errors.api.codes.*` (kept in sync with messages by a test). */
export const CODE_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  premium_required: 'errors.api.codes.premiumRequired',
  quota_exceeded: 'errors.api.codes.quotaExceeded',
  pipeline_stalled: 'errors.api.codes.pipelineStalled',
  pipeline_not_completed: 'errors.api.codes.pipelineNotCompleted',
  ask_rin_conversation_busy: 'errors.api.codes.askRinConversationBusy',
  request_in_progress: 'errors.api.codes.requestInProgress',
  payment_creation_disabled: 'errors.api.codes.paymentCreationDisabled',
  activation_paused: 'errors.api.codes.activationPaused',
  unsupported_media_type: 'errors.api.codes.unsupportedMediaType',
};

export const KIND_MESSAGE_KEYS: Readonly<Record<ApiErrorKind, string>> = {
  auth_required: 'errors.api.authRequired',
  unlock_required: 'errors.api.codes.premiumRequired',
  forbidden: 'errors.api.forbidden',
  not_found: 'errors.api.notFound',
  conflict: 'errors.api.conflict',
  rate_limited: 'errors.api.rateLimited',
  validation: 'errors.api.validation',
  unavailable: 'errors.api.unavailable',
  server: 'errors.api.server',
  network: 'errors.api.network',
  aborted: '',
  unknown: 'errors.api.generic',
};

export const RATE_LIMITED_SECONDS_KEY = 'errors.api.rateLimitedSeconds';

const CODES_BY_KIND: Partial<Record<ApiErrorKind, readonly string[]>> = {
  auth_required: ['unauthorized'],
  unlock_required: ['premium_required', 'quota_exceeded'],
  forbidden: ['forbidden', 'last_active_admin'],
  not_found: ['not_found', 'pipeline_not_found'],
  conflict: [
    'conflict',
    'request_in_progress',
    'request_already_completed',
    'idempotency_conflict',
    'pipeline_not_completed',
    'ask_rin_conversation_busy',
    'ask_rin_request_in_progress',
    'ask_rin_context_stale',
    'llm_config_revision_conflict',
  ],
  rate_limited: ['rate_limit_exceeded', 'llm_probe_rate_limited', 'feedback_frequency_limit'],
  validation: [
    'validation_error',
    'unsupported_media_type',
    'invalid_token',
    'confirmation_mismatch',
    'ask_rin_context_invalid',
    'ask_rin_image_unsupported',
  ],
  unavailable: [
    'service_unavailable',
    'upstream_timeout',
    'entitlement_unavailable',
    'payment_creation_disabled',
    'activation_paused',
    'pipeline_unavailable',
    'llm_route_unavailable',
    'llm_route_not_configured',
    'llm_settings_unavailable',
    'admin_invariant_unavailable',
  ],
  server: [
    'internal_error',
    'upstream_error',
    'upstream_invalid_json',
    'upstream_invalid_envelope',
    'upstream_html_error',
    'invalid_response_envelope',
    'configuration_error',
    'llm_call_failed',
    'llm_route_exhausted',
    'ask_rin_run_failed',
  ],
  aborted: ['request_aborted'],
};

const KIND_BY_CODE = new Map<string, ApiErrorKind>(
  Object.entries(CODES_BY_KIND).flatMap(([kind, codes]) =>
    (codes ?? []).map((code) => [code, kind as ApiErrorKind] as const),
  ),
);

/** Server-side failure families not listed one by one (`pipeline_failed`, `ocr_request_error`, ...). */
const SERVER_CODE_PREFIXES = ['pipeline_', 'ocr_'];

const RETRYABLE_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'conflict',
  'rate_limited',
  'unavailable',
  'server',
  'network',
  'unknown',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function kindFromCode(code: string): ApiErrorKind | null {
  const listed = KIND_BY_CODE.get(code);
  if (listed) return listed;
  return SERVER_CODE_PREFIXES.some((prefix) => code.startsWith(prefix)) ? 'server' : null;
}

function kindFromStatus(status: number): ApiErrorKind {
  const statusCode = CODE_BY_STATUS[String(status)];
  const kind = statusCode ? KIND_BY_CODE.get(statusCode) : undefined;
  if (kind) return kind;
  // Other 4xx are unknown; 5xx and any failed non-error status (a 200 with a broken envelope) are server.
  return status >= 400 && status < 500 ? 'unknown' : 'server';
}

function readCode(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function readStatus(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function readSeconds(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0
    ? Math.ceil(parsed)
    : null;
}

/**
 * `Retry-After` header (delta seconds or HTTP date), else `meta.retryAfterSeconds` /
 * `meta.retry_after_seconds`, else null.
 */
export function parseRetryAfterSeconds(
  headerValue: string | null,
  meta: unknown,
  now: number = Date.now(),
): number | null {
  const header = headerValue?.trim();
  if (header) {
    const seconds = readSeconds(header);
    if (seconds !== null) return seconds;
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - now) / 1000));
  }
  if (!isRecord(meta) || Array.isArray(meta)) return null;
  return readSeconds(meta['retryAfterSeconds']) ?? readSeconds(meta['retry_after_seconds']);
}

function fieldNameFromEntry(entry: unknown): string | null {
  if (!isRecord(entry)) return null;
  if (typeof entry['field'] === 'string' && entry['field']) return entry['field'];
  const loc = entry['loc'];
  if (Array.isArray(loc)) {
    const parts = loc.filter(
      (part, index): part is string | number =>
        (typeof part === 'string' || typeof part === 'number') &&
        !(index === 0 && (part === 'body' || part === 'query' || part === 'path')),
    );
    return parts.length ? parts.join('.') : null;
  }
  return typeof loc === 'string' && loc ? loc : null;
}

/** Field names only; never the server's per-field text. */
export function readFieldErrors(meta: unknown): string[] {
  let names: Array<string | null> = [];
  if (Array.isArray(meta)) {
    names = meta.map(fieldNameFromEntry);
  } else if (isRecord(meta)) {
    const nested = meta['fields'] ?? meta['errors'];
    if (Array.isArray(nested)) return readFieldErrors(nested);
    names = Object.keys(isRecord(nested) ? nested : meta);
  }
  return [...new Set(names.filter((name): name is string => Boolean(name)))];
}

function isAbortError(error: unknown): boolean {
  return isRecord(error) && error['name'] === 'AbortError';
}

function describe(
  kind: ApiErrorKind,
  code: string | null,
  status: number | null,
  retryAfterSeconds: number | null = null,
  fieldErrors: string[] = [],
): DescribedApiError {
  let messageKey = (code && CODE_MESSAGE_KEYS[code]) || KIND_MESSAGE_KEYS[kind];
  let messageValues: Record<string, string | number> | undefined;
  if (kind === 'aborted') {
    messageKey = '';
  } else if (kind === 'rate_limited' && retryAfterSeconds !== null) {
    messageKey = RATE_LIMITED_SECONDS_KEY;
    messageValues = { seconds: retryAfterSeconds };
  }
  return {
    kind,
    code,
    status,
    messageKey,
    ...(messageValues ? { messageValues } : {}),
    retryable: RETRYABLE_KINDS.has(kind),
    retryAfterSeconds,
    fieldErrors,
  };
}

export function describeApiError(error: unknown): DescribedApiError {
  if (isAbortError(error)) return describe('aborted', null, null);
  // `fetch` rejects with a TypeError when there is no response (offline, DNS, CORS).
  if (error instanceof TypeError) return describe('network', null, null);
  if (!isRecord(error)) return describe('unknown', null, null);

  const code = readCode(error['code']);
  const status = readStatus(error['status']);
  const kind =
    (code ? kindFromCode(code) : null) ?? (status !== null ? kindFromStatus(status) : 'unknown');
  const meta = error['meta'];

  return describe(
    kind,
    code,
    kind === 'aborted' ? null : status,
    kind === 'aborted'
      ? null
      : (readSeconds(error['retryAfterSeconds']) ?? parseRetryAfterSeconds(null, meta)),
    kind === 'validation' ? readFieldErrors(meta) : [],
  );
}
