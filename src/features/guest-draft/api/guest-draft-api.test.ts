import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiResponseError } from '@/lib/api/client';
import {
  classifyGuestDraftError,
  classifyGuestTextDraftError,
  createGuestTextDraft,
} from './guest-draft-api';

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

describe('classifyGuestTextDraftError (RIN-1542)', () => {
  const ok = 'a'.repeat(500);

  it('tells a too-long text from a too-short one', () => {
    expect(classifyGuestTextDraftError(refused(413, { reason: 'guest_text_too_long' }), ok)).toBe(
      'too_large',
    );
    expect(classifyGuestTextDraftError(refused(422, { reason: 'guest_text_too_long' }), ok)).toBe(
      'too_large',
    );
    expect(classifyGuestTextDraftError(refused(422, { reason: 'guest_text_too_short' }), ok)).toBe(
      'too_short',
    );
    expect(classifyGuestTextDraftError(refused(422), 'a'.repeat(20_001))).toBe('too_large');
  });

  it('shows the generic error for a 422 that is not about length, and the cap for the cap', () => {
    expect(classifyGuestTextDraftError(refused(422), ok)).toBe('upload_error');
    expect(classifyGuestTextDraftError(refused(429, { reason: 'guest_draft_limit' }), ok)).toBe(
      'cap',
    );
  });
});

describe('createGuestTextDraft (RIN-1538)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the text as JSON with the token in a header and maps the progress', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          success: true,
          data: {
            status: 'processing',
            progressPercent: 12.6,
            title: null,
            questionCount: 0,
            failureReason: null,
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const progress = await createGuestTextDraft({
      text: 'Fake notes',
      token: 'T'.repeat(43),
      locale: 'en',
      entry: 'create',
    });

    expect(progress).toEqual({ status: 'processing', percent: 13, questionCount: 0, title: null });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('/api/guest-drafts/text');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ text: 'Fake notes', locale: 'en', entry: 'create' }));
    expect(new Headers(init?.headers).get('x-guest-draft-token')).toBe('T'.repeat(43));
    expect(String(url)).not.toContain('T'.repeat(43));
  });
});
