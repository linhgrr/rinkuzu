import { describe, expect, it } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import { classifyGuestDraftError } from './guest-draft-api';

const refused = (status: number, meta: Record<string, unknown> = {}) =>
  new ApiResponseError({ message: 'refused', status, payload: null, meta });

describe('classifyGuestDraftError (RIN-1448)', () => {
  it('maps the server answers to the page states', () => {
    expect(classifyGuestDraftError(refused(429, { reason: 'guest_draft_limit' }))).toBe('cap');
    expect(classifyGuestDraftError(refused(429))).toBe('upload_error');
    expect(classifyGuestDraftError(refused(413))).toBe('too_large');
    expect(classifyGuestDraftError(refused(400, { limit_pages: 10 }))).toBe('too_large');
    expect(classifyGuestDraftError(refused(415))).toBe('not_pdf');
    expect(classifyGuestDraftError(refused(503))).toBe('upload_error');
    expect(classifyGuestDraftError(new TypeError('Failed to fetch'))).toBe('upload_error');
  });
});
