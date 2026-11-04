import { describe, expect, it } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { getAskRinPublicErrorKey } from './public-error';

describe('getAskRinPublicErrorKey', () => {
  it('maps known domain codes to actionable messages', () => {
    expect(getAskRinPublicErrorKey({ code: 'ask_rin_image_unsupported' })).toBe(
      'errorImageUnsupported',
    );
    expect(getAskRinPublicErrorKey({ code: 'ask_rin_context_stale' })).toBe('errorContextExpired');
  });

  it('maps a busy conversation and a request already in flight to the busy copy', () => {
    expect(getAskRinPublicErrorKey({ code: 'ask_rin_conversation_busy', status: 409 })).toBe(
      'errorBusy',
    );
    expect(getAskRinPublicErrorKey({ code: 'ask_rin_request_in_progress', status: 409 })).toBe(
      'errorBusy',
    );
  });

  it('maps a failed agent run to its own copy, not the connection copy', () => {
    expect(
      getAskRinPublicErrorKey(
        new ApiResponseError({
          payload: null,
          message: 'LLM provider exploded: model gpt-secret',
          status: 500,
          code: 'ask_rin_run_failed',
        }),
      ),
    ).toBe('errorRunFailed');
  });

  it('classifies uncoded failures by kind', () => {
    expect(getAskRinPublicErrorKey(new TypeError('Failed to fetch'))).toBe('errorConnection');
    expect(getAskRinPublicErrorKey({ status: 429 })).toBe('errorRateLimited');
    expect(getAskRinPublicErrorKey({ status: 403, code: 'premium_required' })).toBe('errorQuota');
  });

  it('leaves server, unavailable, auth and aborted failures to the shared API error layer', () => {
    expect(getAskRinPublicErrorKey({ status: 502, code: 'upstream_error' })).toBeNull();
    expect(getAskRinPublicErrorKey({ status: 503 })).toBeNull();
    expect(getAskRinPublicErrorKey({ status: 401, code: 'unauthorized' })).toBeNull();
    expect(getAskRinPublicErrorKey(new DOMException('aborted', 'AbortError'))).toBeNull();
  });

  it('never derives display text from unknown backend details', () => {
    expect(
      getAskRinPublicErrorKey({
        code: 'unknown_internal_error',
        detail: "Current model 'secret-model' failed",
      }),
    ).toBe('errorConnection');
  });
});
