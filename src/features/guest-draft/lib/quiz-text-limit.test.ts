import { describe, expect, it } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { quizTextRefusal } from './quiz-text-limit';

const refused = (status: number, meta: Record<string, unknown> = {}) =>
  new ApiResponseError({ message: 'refused', status, payload: null, meta });

const SHORT = 'a'.repeat(150);
const OK = 'a'.repeat(500);
const LONG = 'a'.repeat(20_001);

describe('quizTextRefusal (RIN-1542)', () => {
  it('reads the reason the route sends, signed-in or guest', () => {
    expect(quizTextRefusal(refused(422, { reason: 'text_too_short' }), OK)).toBe('too_short');
    expect(quizTextRefusal(refused(422, { reason: 'text_too_long' }), OK)).toBe('too_long');
    expect(quizTextRefusal(refused(413, { reason: 'guest_text_too_long' }), OK)).toBe('too_long');
    expect(quizTextRefusal(refused(422, { reason: 'guest_text_too_short' }), OK)).toBe('too_short');
  });

  it('falls back to the length the client knows when the reason is missing', () => {
    expect(quizTextRefusal(refused(422), LONG)).toBe('too_long');
    expect(quizTextRefusal(refused(422), SHORT)).toBe('too_short');
    expect(quizTextRefusal(refused(413), OK)).toBe('too_long');
  });

  it('leaves any other refusal to the generic copy', () => {
    expect(quizTextRefusal(refused(422), OK)).toBeNull();
    expect(quizTextRefusal(refused(400), SHORT)).toBeNull();
    expect(quizTextRefusal(refused(503), LONG)).toBeNull();
    expect(quizTextRefusal(new TypeError('Failed to fetch'), LONG)).toBeNull();
  });
});
