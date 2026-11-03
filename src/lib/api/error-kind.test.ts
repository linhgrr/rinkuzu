import enErrors from '@/../messages/en/errors.json';
import viErrors from '@/../messages/vi/errors.json';
import { AdaptiveApiError } from '@/features/adaptive/lib/adaptive-api-error';
import { describe, expect, it } from 'vitest';
import { ApiResponseError } from './client';
import {
  CODE_MESSAGE_KEYS,
  KIND_MESSAGE_KEYS,
  RATE_LIMITED_SECONDS_KEY,
  USER_SAFE_DETAIL_CODES,
  describeApiError,
  parseRetryAfterSeconds,
  readFieldErrors,
  type ApiErrorKind,
} from './error-kind';

function apiError(status: number, code: string | null, extra: Partial<{ meta: unknown }> = {}) {
  return new ApiResponseError({
    message: 'Server text that must never reach the UI',
    status,
    payload: { success: false, error: { code, message: 'secret@example.com' } },
    code,
    detail: 'Server detail',
    meta: extra.meta,
  });
}

// One row per line of the contract mapping table: [kind, status, codes, messageKey, retryable].
const TABLE: Array<[ApiErrorKind, number[], string[], string, boolean]> = [
  ['auth_required', [401], ['unauthorized'], 'errors.api.authRequired', false],
  ['unlock_required', [], ['premium_required'], 'errors.api.codes.premiumRequired', false],
  ['unlock_required', [], ['quota_exceeded'], 'errors.api.codes.quotaExceeded', false],
  ['forbidden', [403], ['forbidden', 'last_active_admin'], 'errors.api.forbidden', false],
  ['not_found', [404], ['not_found', 'pipeline_not_found'], 'errors.api.notFound', false],
  [
    'conflict',
    [409],
    ['conflict', 'idempotency_conflict', 'ask_rin_context_stale'],
    'errors.api.conflict',
    true,
  ],
  [
    'rate_limited',
    [429],
    ['rate_limit_exceeded', 'llm_probe_rate_limited', 'feedback_frequency_limit'],
    'errors.api.rateLimited',
    true,
  ],
  [
    'validation',
    [400, 422],
    ['validation_error', 'invalid_token', 'ask_rin_image_unsupported'],
    'errors.api.validation',
    false,
  ],
  [
    'unavailable',
    [503, 504],
    ['service_unavailable', 'upstream_timeout', 'llm_route_unavailable'],
    'errors.api.unavailable',
    true,
  ],
  [
    'server',
    [500, 502, 507],
    [
      'internal_error',
      'upstream_html_error',
      'pipeline_failed',
      'ocr_request_error',
      'llm_call_failed',
    ],
    'errors.api.server',
    true,
  ],
  ['unknown', [402, 418], [], 'errors.api.generic', true],
];

describe('describeApiError mapping table', () => {
  it.each(TABLE)('%s: status only', (kind, statuses, _codes, messageKey, retryable) => {
    for (const status of statuses) {
      expect(describeApiError(apiError(status, null))).toMatchObject({
        kind,
        status,
        code: null,
        retryable,
        messageKey,
      });
    }
  });

  it.each(TABLE)('%s: code only', (kind, _statuses, codes, messageKey, retryable) => {
    for (const code of codes) {
      const described = describeApiError({ code });
      expect(described).toMatchObject({ kind, code, status: null, retryable });
      expect(described.messageKey).toBe(CODE_MESSAGE_KEYS[code] ?? messageKey);
    }
  });

  it('code wins over a conflicting status', () => {
    expect(describeApiError(apiError(400, 'premium_required')).kind).toBe('unlock_required');
    expect(describeApiError(apiError(500, 'not_found'))).toMatchObject({
      kind: 'not_found',
      status: 500,
    });
    expect(describeApiError(apiError(200, 'invalid_response_envelope')).kind).toBe('server');
  });

  it('an unknown code falls back to its status row', () => {
    expect(describeApiError(apiError(409, 'brand_new_code'))).toMatchObject({
      kind: 'conflict',
      code: 'brand_new_code',
      messageKey: 'errors.api.conflict',
    });
    expect(describeApiError({ code: 'brand_new_code' }).kind).toBe('unknown');
  });

  it('uses code-specific keys for flow codes, whatever their kind', () => {
    expect(describeApiError(apiError(409, 'pipeline_not_completed'))).toMatchObject({
      kind: 'conflict',
      messageKey: 'errors.api.codes.pipelineNotCompleted',
    });
    expect(describeApiError(apiError(503, 'payment_creation_disabled'))).toMatchObject({
      kind: 'unavailable',
      messageKey: 'errors.api.codes.paymentCreationDisabled',
    });
    expect(describeApiError({ code: 'pipeline_stalled' })).toMatchObject({
      kind: 'server',
      messageKey: 'errors.api.codes.pipelineStalled',
    });
  });
});

describe('describeApiError inputs', () => {
  it('classifies AdaptiveApiError and plain objects', () => {
    const adaptive = new AdaptiveApiError({ message: 'raw', code: 'QUOTA_EXCEEDED', status: 403 });
    expect(describeApiError(adaptive)).toMatchObject({
      kind: 'unlock_required',
      code: 'quota_exceeded',
    });
    expect(describeApiError({ status: 404, code: 'not_found' }).kind).toBe('not_found');
    expect(describeApiError({ status: 401 }).kind).toBe('auth_required');
  });

  it('classifies aborts, network failures, invalid envelopes and non-errors', () => {
    expect(describeApiError(new DOMException('aborted', 'AbortError'))).toMatchObject({
      kind: 'aborted',
      messageKey: '',
      status: null,
    });
    expect(describeApiError(apiError(499, 'request_aborted')).kind).toBe('aborted');
    expect(describeApiError(new TypeError('Failed to fetch'))).toMatchObject({
      kind: 'network',
      status: null,
      messageKey: 'errors.api.network',
      retryable: true,
    });
    const html = new ApiResponseError({
      message: 'Invalid API response envelope',
      status: 502,
      payload: '<html>Bad gateway</html>',
      code: 'invalid_response_envelope',
      detail: '<html>Bad gateway</html>',
    });
    expect(describeApiError(html)).toMatchObject({
      kind: 'server',
      messageKey: 'errors.api.server',
    });
    expect(describeApiError('boom')).toMatchObject({ kind: 'unknown', code: null, status: null });
    expect(describeApiError(undefined).kind).toBe('unknown');
  });

  it('never carries server text', () => {
    const described = describeApiError(apiError(500, 'internal_error'));
    expect(JSON.stringify(described)).not.toMatch(/Server|secret/);
    expect(USER_SAFE_DETAIL_CODES.size).toBe(0);
  });
});

describe('retry-after and rate limiting', () => {
  const now = Date.parse('2026-11-03T12:00:00Z');

  it('parses header seconds, header HTTP date and meta; null otherwise', () => {
    expect(parseRetryAfterSeconds('30', null, now)).toBe(30);
    expect(parseRetryAfterSeconds('Tue, 03 Nov 2026 12:01:30 GMT', null, now)).toBe(90);
    expect(parseRetryAfterSeconds('Tue, 03 Nov 2026 11:00:00 GMT', null, now)).toBe(0);
    expect(parseRetryAfterSeconds(null, { retryAfterSeconds: 12 }, now)).toBe(12);
    expect(parseRetryAfterSeconds(null, { retry_after_seconds: '7' }, now)).toBe(7);
    expect(parseRetryAfterSeconds('soon', { other: 1 }, now)).toBeNull();
    expect(parseRetryAfterSeconds(null, [{ retryAfterSeconds: 3 }], now)).toBeNull();
    expect(parseRetryAfterSeconds(null, null, now)).toBeNull();
  });

  it('returns rateLimitedSeconds with {seconds} when known', () => {
    const error = apiError(429, 'rate_limit_exceeded');
    error.retryAfterSeconds = 30;
    expect(describeApiError(error)).toMatchObject({
      kind: 'rate_limited',
      retryAfterSeconds: 30,
      messageKey: RATE_LIMITED_SECONDS_KEY,
      messageValues: { seconds: 30 },
    });
    expect(
      describeApiError({ status: 429, meta: { retry_after_seconds: 5 } }).messageValues,
    ).toEqual({
      seconds: 5,
    });
    const unknownWait = describeApiError(apiError(429, null));
    expect(unknownWait).toMatchObject({
      messageKey: 'errors.api.rateLimited',
      retryAfterSeconds: null,
    });
    expect(unknownWait.messageValues).toBeUndefined();
  });
});

describe('fieldErrors', () => {
  it('returns field names only, from both meta shapes', () => {
    const fromArray = describeApiError(
      apiError(422, 'validation_error', {
        meta: [
          { field: 'email', message: 'secret@example.com is taken' },
          { loc: ['body', 'profile', 'name'], msg: 'too long' },
        ],
      }),
    );
    expect(fromArray.fieldErrors).toEqual(['email', 'profile.name']);
    const fromRecord = describeApiError(
      apiError(400, 'validation_error', { meta: { password: 'too short', email: 'bad' } }),
    );
    expect(fromRecord.fieldErrors).toEqual(['password', 'email']);
    expect(readFieldErrors({ fields: { email: 'bad' } })).toEqual(['email']);
    expect(
      describeApiError(apiError(429, null, { meta: { retryAfterSeconds: 1 } })).fieldErrors,
    ).toEqual([]);
  });
});

describe('i18n keys', () => {
  function resolve(messages: unknown, key: string): unknown {
    return key
      .replace(/^errors\./, '')
      .split('.')
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        messages,
      );
  }

  const keys = [
    ...Object.values(KIND_MESSAGE_KEYS).filter(Boolean),
    ...Object.values(CODE_MESSAGE_KEYS),
    RATE_LIMITED_SECONDS_KEY,
  ];

  it.each([
    ['vi', viErrors],
    ['en', enErrors],
  ])('every kind and code key exists in %s', (_locale, messages) => {
    for (const key of keys) {
      expect(typeof resolve(messages, key), key).toBe('string');
    }
    expect(resolve(messages, RATE_LIMITED_SECONDS_KEY)).toContain('{seconds}');
  });

  it('vi and en have the same api keys', () => {
    expect(Object.keys(viErrors.api.codes).sort()).toEqual(Object.keys(enErrors.api.codes).sort());
    expect(Object.keys(viErrors.api).sort()).toEqual(Object.keys(enErrors.api).sort());
  });
});
