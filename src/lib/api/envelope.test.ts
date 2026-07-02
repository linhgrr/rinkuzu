import { describe, expect, it } from 'vitest';
import { isRecord, isStandardErrorEnvelope, isStandardSuccessEnvelope } from '@/lib/api/envelope';

describe('api envelope guards', () => {
  it('accepts only plain object records', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it('detects standard success envelopes', () => {
    expect(isStandardSuccessEnvelope({ success: true, data: { ok: true } })).toBe(true);
    expect(isStandardSuccessEnvelope({ success: true })).toBe(false);
    expect(isStandardSuccessEnvelope({ success: false, error: {} })).toBe(false);
  });

  it('detects standard error envelopes', () => {
    expect(
      isStandardErrorEnvelope({
        success: false,
        error: { code: 'bad_request', message: 'Bad request' },
      }),
    ).toBe(true);
    expect(isStandardErrorEnvelope({ success: false, error: 'bad' })).toBe(false);
    expect(isStandardErrorEnvelope({ success: true, data: null })).toBe(false);
  });
});
