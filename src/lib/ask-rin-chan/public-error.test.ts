import { describe, expect, it } from 'vitest';
import { getAskRinPublicErrorKey } from './public-error';

describe('getAskRinPublicErrorKey', () => {
  it('maps known domain codes to actionable messages', () => {
    expect(getAskRinPublicErrorKey({ code: 'ask_rin_image_unsupported' })).toBe(
      'errorImageUnsupported',
    );
    expect(getAskRinPublicErrorKey({ code: 'ask_rin_context_stale' })).toBe('errorContextExpired');
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
