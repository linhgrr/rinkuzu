import { describe, expect, it } from 'vitest';

import {
  buildStandardErrorBody,
  extractApiErrorCode,
  extractApiErrorMessage,
  extractApiErrorMeta,
  extractUnknownErrorMessage,
} from '@/lib/api/error';

describe('buildStandardErrorBody', () => {
  it('puts meta inside error', () => {
    const body = buildStandardErrorBody({
      code: 'validation_error',
      message: 'Invalid request',
      detail: 'bad',
      meta: { fields: { email: 'x' } },
    });
    expect(body).toEqual({
      success: false,
      error: {
        code: 'validation_error',
        message: 'Invalid request',
        detail: 'bad',
        meta: { fields: { email: 'x' } },
      },
    });
  });

  it('omits meta when not provided', () => {
    const body = buildStandardErrorBody({
      code: 'boom',
      message: 'Request failed',
      detail: 'oops',
    });
    expect(body.error).not.toHaveProperty('meta');
  });
});

describe('extractApiErrorMessage', () => {
  it('prefers error.detail then message then code', () => {
    expect(
      extractApiErrorMessage(
        { success: false, error: { code: 'c', message: 'm', detail: 'd' } },
        'fallback',
      ),
    ).toBe('d');
    expect(extractApiErrorMessage({ success: false, error: { message: 'm' } }, 'fallback')).toBe(
      'm',
    );
    expect(extractApiErrorMessage({ success: false, error: { code: 'c' } }, 'fallback')).toBe('c');
  });

  it('returns fallback for non-standard payloads', () => {
    expect(extractApiErrorMessage({ error: 'x' }, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(extractApiErrorMessage({}, 'fallback')).toBe('fallback');
  });
});

describe('extractApiErrorCode / Meta', () => {
  it('reads code and meta from envelope', () => {
    const payload = {
      success: false,
      error: { code: 'validation_error', detail: 'bad', meta: { fields: { email: 'bad' } } },
    };
    expect(extractApiErrorCode(payload)).toBe('validation_error');
    expect(extractApiErrorMeta<{ fields: Record<string, string> }>(payload)?.fields['email']).toBe(
      'bad',
    );
  });

  it('returns null when missing', () => {
    expect(extractApiErrorCode({ error: 'x' })).toBeNull();
    expect(extractApiErrorMeta({ error: { code: 'x' } })).toBeNull();
  });
});

describe('extractUnknownErrorMessage', () => {
  it('reads Error.message and falls back', () => {
    expect(extractUnknownErrorMessage(new Error('boom'), 'fb')).toBe('boom');
    expect(extractUnknownErrorMessage(new Error(''), 'fb')).toBe('fb');
    expect(extractUnknownErrorMessage('not-an-error', 'fb')).toBe('fb');
  });
});
